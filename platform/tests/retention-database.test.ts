import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase, type Database } from '../packages/db/src/connection';
import { migrate } from '../packages/db/src/migrate';
import { WorkspaceRepository } from '../packages/db/src/repository';
import { grantRuntimeTables } from '../packages/db/src/runtime-role';
import { RetentionJob } from '../packages/db/src/retention';
import { createSeed } from '../packages/domain/src/seed';
import { RETENTION_DAYS, RETENTION_POLICY, RETENTION_RULES, retentionCutoff } from '../packages/contracts/src/retention';
import { createApp } from '../apps/api/src/app';

const NOW = new Date('2026-09-01T12:00:00Z'), DAY = 864e5, cron = 'retention-cron-secret-0123456789abcdef';
const ago = (days: number) => new Date(NOW.getTime() - days * DAY).toISOString();
const ORGS = ['org_code_black', 'org_studio_north'];
let db: Database, runtime: Database;
const count = async (query: string, params: unknown[] = []) => (await db.query<{ n: number }>(query, params)).rows[0].n;

/** Old and recent housekeeping in both communities, so each rule has something to clear and something to keep. */
async function plant() {
    await db.query("INSERT INTO auth_user(id,name,email,email_verified,created_at,updated_at) VALUES('retention_user','R','r@example.test',true,now(),now()) ON CONFLICT DO NOTHING");
    for (const [id, expires] of [['s_old', ago(2)], ['s_recent', ago(0.5)], ['s_live', ago(-3)]])
        await db.query("INSERT INTO auth_session(id,expires_at,token,created_at,updated_at,user_id) VALUES($1,$2,$1,now(),now(),'retention_user')", [id, expires]);
    for (const [id, expires] of [['v_old', ago(3)], ['v_live', ago(-1)]])
        await db.query('INSERT INTO auth_verification(id,identifier,value,expires_at,created_at,updated_at) VALUES($1,$1,$1,$2,now(),now())', [id, expires]);
    await db.query('INSERT INTO request_limits(key,count,window_start) VALUES($1,1,$2),($3,1,$4)', ['limit:old', ago(2), 'limit:new', ago(0)]);
    await db.query('INSERT INTO auth_rate_limit(id,key,count,last_request) VALUES($1,$1,1,$2),($3,$3,1,$4)', ['rl_old', NOW.getTime() - 2 * DAY, 'rl_new', NOW.getTime()]);
    const mail = [['m_sent_old', 'sent', '', ago(100)], ['m_sent_new', 'sent', '', ago(10)], ['m_cancel_old', 'cancelled', '', ago(91)],
        ['m_failed_old', 'failed', 'sealed', ago(95)], ['m_failed_mid', 'failed', 'sealed', ago(40)], ['m_failed_new', 'failed', 'sealed', ago(5)], ['m_queued_old', 'queued', 'sealed', ago(200)]];
    for (const [id, status, payload, at] of mail)
        await db.query('INSERT INTO email_outbox(id,payload,status,created_at,sent_at) VALUES($1,$2,$3,$4,$5)', [id, payload, status, at, status === 'sent' ? at : null]);
    for (const org of ORGS) {
        const member = (await db.query<{ user_id: string }>('SELECT user_id FROM members WHERE organization_id=$1 ORDER BY user_id LIMIT 1', [org])).rows[0].user_id;
        await db.query("INSERT INTO command_receipts(organization_id,user_id,request_key,body_hash,result,created_at) VALUES($1,$2,'r_old','h','{}',$3),($1,$2,'r_new','h','{}',$4)", [org, member, ago(31), ago(29)]);
        await db.query("INSERT INTO outbox(id,organization_id,created_at,actor_id,type,object_id,payload) VALUES('o_old',$1,$3,$2,'t','x','{}'),('o_new',$1,$4,$2,'t','x','{}')", [org, member, ago(91), ago(89)]);
        await db.query(`INSERT INTO notifications(id,organization_id,created_at,user_id,title,body,href,read_at) VALUES
            ('n_read_old',$1,$3,$2,'t','b','/',$3),('n_read_new',$1,$4,$2,'t','b','/',$4),('n_unread_old',$1,$3,$2,'t','b','/',NULL)`, [org, member, ago(200), ago(100)]);
    }
}

before(async () => {
    db = await openDatabase('pglite:memory'); await migrate(db);
    const owner = new WorkspaceRepository(db); await owner.seed(createSeed()); await owner.seed(createSeed('studio-north'));
    await db.query('CREATE ROLE reunir_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS');
    await db.transaction(grantRuntimeTables);
    runtime = Object.create(db) as Database;
    runtime.transaction = fn => db.transaction(async tx => { await tx.query('SET LOCAL ROLE reunir_app'); return fn(tx); });
    runtime.query = (q, p) => runtime.transaction(tx => tx.query(q, p)) as never;
});
after(async () => db?.close());

test('one list of rules serves the job and the wording people read', () => {
    assert.deepEqual(RETENTION_RULES.sort(), Object.keys(RETENTION_DAYS).sort());
    assert.equal(retentionCutoff('readNotices', NOW).toISOString(), ago(180));
    assert.ok(RETENTION_POLICY.some(p => p.kept.includes(String(RETENTION_DAYS.readNotices))), 'read notices wording follows the rule');
    assert.ok(RETENTION_POLICY.some(p => /audit/i.test(p.what) && /as long as the community exists/i.test(p.kept)), 'the audit trail is kept');
    for (const p of RETENTION_POLICY) assert.doesNotMatch(p.what + p.kept + p.why, /—/, 'no em dashes');
});

test('the restricted role lists communities only as the retention worker', async () => {
    const list = (worker?: string) => runtime.transaction(async tx => {
        if (worker) await tx.query("SELECT set_config('app.worker',$1,true)", [worker]);
        return (await tx.query<{ id: string }>('SELECT id FROM organisations ORDER BY id')).rows.map(r => r.id);
    });
    assert.deepEqual(await list(), [], 'no tenant context, no communities');
    assert.deepEqual(await list('digest'), [], 'another worker sees none');
    assert.deepEqual(await list('retention'), [...ORGS].sort());
    const changed = await runtime.transaction(async tx => {
        await tx.query("SELECT set_config('app.worker','retention',true)");
        return (await tx.query("UPDATE organisations SET name='changed' RETURNING id")).rows.length + (await tx.query('DELETE FROM organisations RETURNING id')).rows.length;
    });
    assert.equal(changed, 0, 'the worker policy only reads');
});

test('a dry run counts exactly and changes nothing; applying clears only what the rules name', async () => {
    await plant();
    const job = new RetentionJob(runtime);
    const before = await count('SELECT (SELECT count(*) FROM auth_session)+(SELECT count(*) FROM email_outbox)+(SELECT count(*) FROM notifications)+(SELECT count(*) FROM outbox)+(SELECT count(*) FROM command_receipts) AS n');
    const expected = { expiredSessions: 1, expiredLinks: 1, rateCounters: 2, requestReceipts: 2, changeEvents: 2, finishedMail: 3, failedMailContents: 2, readNotices: 2 };
    const dry = await job.run(NOW, false);
    assert.equal(dry.applied, false);
    assert.equal(dry.communities, 2);
    for (const [rule, n] of Object.entries(expected)) assert.ok(dry.counts[rule as keyof typeof expected] >= n, `${rule}: at least ${n}, counted ${dry.counts[rule as keyof typeof expected]}`);
    assert.equal(await count('SELECT (SELECT count(*) FROM auth_session)+(SELECT count(*) FROM email_outbox)+(SELECT count(*) FROM notifications)+(SELECT count(*) FROM outbox)+(SELECT count(*) FROM command_receipts) AS n'), before, 'nothing changed');
    assert.equal(await count("SELECT count(*)::int AS n FROM email_outbox WHERE payload<>'' AND status='failed'"), 3, 'failed mail contents untouched by the dry run');

    const auditBefore = await count('SELECT count(*)::int AS n FROM audit');
    const applied = await job.run(NOW, true);
    assert.equal(applied.applied, true);
    assert.deepEqual(applied.counts, dry.counts, 'the dry run predicted the real run');
    assert.deepEqual((await db.query<{ id: string }>('SELECT id FROM auth_session ORDER BY id')).rows.map(r => r.id), ['s_live', 's_recent'], 'an expired session is kept a day');
    assert.deepEqual((await db.query<{ id: string }>('SELECT id FROM auth_verification ORDER BY id')).rows.map(r => r.id), ['v_live']);
    assert.equal(await count("SELECT count(*)::int AS n FROM request_limits WHERE key='limit:old'"), 0);
    assert.equal(await count("SELECT count(*)::int AS n FROM request_limits WHERE key='limit:new'"), 1);
    assert.deepEqual((await db.query<{ id: string }>('SELECT id FROM auth_rate_limit ORDER BY id')).rows.map(r => r.id), ['rl_new']);
    assert.deepEqual((await db.query<{ id: string; payload: string }>('SELECT id,payload FROM email_outbox ORDER BY id')).rows,
        [{ id: 'm_failed_mid', payload: '' }, { id: 'm_failed_new', payload: 'sealed' }, { id: 'm_queued_old', payload: 'sealed' }, { id: 'm_sent_new', payload: '' }],
        'finished mail goes after 90 days, failed contents after 30, queued mail is never touched');
    for (const org of ORGS) {
        assert.deepEqual((await db.query<{ request_key: string }>('SELECT request_key FROM command_receipts WHERE organization_id=$1 AND request_key IN ($2,$3)', [org, 'r_old', 'r_new'])).rows.map(r => r.request_key), ['r_new']);
        assert.deepEqual((await db.query<{ id: string }>("SELECT id FROM outbox WHERE organization_id=$1 AND id IN ('o_old','o_new') ORDER BY id", [org])).rows.map(r => r.id), ['o_new']);
        assert.deepEqual((await db.query<{ id: string }>("SELECT id FROM notifications WHERE organization_id=$1 AND id IN ('n_read_old','n_read_new','n_unread_old') ORDER BY id", [org])).rows.map(r => r.id), ['n_read_new', 'n_unread_old'], 'unread notices stay however old');
    }
    assert.equal(await count('SELECT count(*)::int AS n FROM audit'), auditBefore, 'the audit trail is never cleared');
    const observed = (await db.query<{ state: string; last_success_at: unknown }>("SELECT state,last_success_at FROM service_observations WHERE name='retention-job'")).rows[0];
    assert.equal(observed.state, 'ok'); assert.ok(observed.last_success_at);
    const again = await job.run(NOW, true);
    assert.ok(Object.values(again.counts).every(n => n === 0), 'a second run finds nothing more');
});

test('the scheduled route needs the scheduler secret, applies by default and only counts with dry=1', async () => {
    const job = new RetentionJob(runtime);
    const app = createApp({ repository: new WorkspaceRepository(runtime), origin: 'https://ferven.test', resolveSession: async () => null, cronSecret: cron, retention: job });
    assert.equal((await app.request('/api/internal/retention')).status, 403);
    assert.equal((await app.request('/api/internal/retention', { headers: { Authorization: 'Bearer wrong' } })).status, 403);
    await db.query("INSERT INTO request_limits(key,count,window_start) VALUES('limit:route',1,now() - interval '3 days')");
    const dry = await (await app.request('/api/internal/retention?dry=1', { headers: { Authorization: 'Bearer ' + cron } })).json();
    assert.equal(dry.configured, true); assert.equal(dry.applied, false); assert.ok(dry.counts.rateCounters >= 1);
    assert.equal(await count("SELECT count(*)::int AS n FROM request_limits WHERE key='limit:route'"), 1);
    const real = await (await app.request('/api/internal/retention', { headers: { Authorization: 'Bearer ' + cron } })).json();
    assert.equal(real.applied, true);
    assert.equal(await count("SELECT count(*)::int AS n FROM request_limits WHERE key='limit:route'"), 0);
    assert.doesNotMatch(JSON.stringify(real), /@|sealed|token/, 'counts only, never contents');
    const bare = createApp({ repository: new WorkspaceRepository(runtime), origin: 'https://ferven.test', resolveSession: async () => null, cronSecret: cron });
    assert.deepEqual(await (await bare.request('/api/internal/retention', { headers: { Authorization: 'Bearer ' + cron } })).json(), { configured: false });
});
