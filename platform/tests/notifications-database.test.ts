import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { openDatabase, type Database } from '../packages/db/src/connection';
import { migrate } from '../packages/db/src/migrate';
import { WorkspaceRepository, setContext } from '../packages/db/src/repository';
import { grantRuntimeTables } from '../packages/db/src/runtime-role';
import { createSeed, DEMO_ADMIN, DEMO_USER } from '../packages/domain/src/seed';
import { MailQueue } from '../apps/api/src/mail';
import { DigestService } from '../apps/api/src/digests';
import { createApp } from '../apps/api/src/app';

const ORG = 'org_code_black', secret = 'notification-digest-test-secret-0123456789', cron = 'digest-cron-secret-0123456789abcdef';
let db: Database, runtime: Database, repo: WorkspaceRepository, mail: MailQueue;
const save = (user: string, muted: string[], digest: string, slug = 'code-black') => repo.execute(slug, user, { type: 'notification.preferences.save', muted, digest }, randomUUID(), 'notifications-db');
const count = async (query: string, params: unknown[] = []) => (await db.query<{ n: number }>(query, params)).rows[0].n;
/** Runs one query as the restricted role, in a tenant context or none. */
const asRuntime = <T>(fn: (sql: Database) => Promise<T>, org?: string, user?: string, worker?: string) => db.transaction(async tx => {
    await tx.query('SET LOCAL ROLE reunir_app');
    if (org && user) await setContext(tx, org, user);
    if (worker) await tx.query("SELECT set_config('app.worker',$1,true)", [worker]);
    return fn(tx as unknown as Database);
});

before(async () => {
    db = await openDatabase('pglite:memory'); await migrate(db);
    const owner = new WorkspaceRepository(db); await owner.seed(createSeed()); await owner.seed(createSeed('studio-north'));
    await db.query('CREATE ROLE reunir_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS');
    await db.transaction(grantRuntimeTables);
    runtime = Object.create(db) as Database;
    runtime.transaction = fn => db.transaction(async tx => { await tx.query('SET LOCAL ROLE reunir_app'); return fn(tx); });
    repo = new WorkspaceRepository(runtime);
    mail = new MailQueue(runtime, secret);
    for (const [id, email] of [[DEMO_USER, 'alex@example.test'], ['member_jordan', 'jordan@example.test'], ['member_sofia', 'sofia@example.test'], [DEMO_ADMIN, 'amina@example.test']])
        await db.query('INSERT INTO auth_user(id,name,email,email_verified,created_at,updated_at) VALUES($1,$1,$2,true,now(),now())', [id, email]);
});
after(async () => db?.close());

test('members save their own settings under the restricted role, and muted notices are never written', async () => {
    await save('member_amina', ['conversations'], 'off');
    const before = await count("SELECT count(*)::int AS n FROM notifications WHERE user_id='member_amina'");
    await repo.execute('code-black', DEMO_USER, { type: 'post.comment', postId: 'post_welcome', body: 'Thank you for the welcome.' }, randomUUID(), 'notifications-db');
    assert.equal(await count("SELECT count(*)::int AS n FROM notifications WHERE user_id='member_amina'"), before, 'Amina muted conversations');
    await save('member_amina', [], 'off');
    await repo.execute('code-black', 'member_jordan', { type: 'post.comment', postId: 'post_welcome', body: 'Glad to be here.' }, randomUUID(), 'notifications-db');
    assert.equal(await count("SELECT count(*)::int AS n FROM notifications WHERE user_id='member_amina'"), before + 1);
    const snapshot = await repo.snapshot('code-black', DEMO_USER);
    assert.deepEqual(snapshot.notificationPreferences, [], 'Alex does not see Amina’s settings');
});

test('row security: own rows only, inside the community, and the digest job sees only who asked for one', async () => {
    await save(DEMO_USER, ['events'], 'weekly');
    await save('member_jordan', [], 'off');
    await save(DEMO_USER, [], 'daily', 'studio-north');
    // Another member cannot change or remove Alex's row, even knowing it is there.
    const alexRow = () => db.query<{ digest: string }>('SELECT digest FROM notification_preferences WHERE organization_id=$1 AND user_id=$2', [ORG, DEMO_USER]);
    await asRuntime(sql => sql.query("UPDATE notification_preferences SET digest='off' WHERE user_id=$1", [DEMO_USER]), ORG, 'member_jordan');
    await asRuntime(sql => sql.query('DELETE FROM notification_preferences WHERE user_id=$1', [DEMO_USER]), ORG, 'member_jordan');
    assert.deepEqual((await alexRow()).rows, [{ digest: 'weekly' }], 'untouched by another member');
    await assert.rejects(() => asRuntime(sql => sql.query("INSERT INTO notification_preferences(id,organization_id,created_at,user_id,muted,digest,updated_at) VALUES('forged',$1,now(),$2,'[]','daily',now())", [ORG, 'member_sofia']), ORG, 'member_jordan'), 'no rows for other people');
    // Cross-tenant: a Studio North context reads none of Code Black's rows.
    const north = await asRuntime(sql => sql.query<{ organization_id: string }>('SELECT organization_id FROM notification_preferences'), 'org_studio_north', DEMO_USER);
    assert(north.rows.every(r => r.organization_id === 'org_studio_north'));
    // Without a context nothing is visible; the digest job sees only rows with a digest, and cannot write.
    assert.equal((await asRuntime(sql => sql.query('SELECT 1 FROM notification_preferences'))).rows.length, 0);
    const due = await asRuntime(sql => sql.query<{ user_id: string; digest: string }>('SELECT user_id,digest FROM notification_preferences'), undefined, undefined, 'digest');
    assert(due.rows.length >= 2 && due.rows.every(r => r.digest !== 'off'));
    await asRuntime(sql => sql.query("UPDATE notification_preferences SET digest='off'"), undefined, undefined, 'digest');
    assert.deepEqual((await alexRow()).rows, [{ digest: 'weekly' }], 'the digest job cannot write');
    // Values outside the allowed topics are refused by the table itself.
    await assert.rejects(() => db.query("UPDATE notification_preferences SET muted='[\"community\"]' WHERE user_id=$1", [DEMO_USER]));
});

test('a suspended member keeps their settings but cannot create new ones', async () => {
    const sofia = (await db.query<{ id: string }>("SELECT id FROM members WHERE organization_id=$1 AND user_id='member_sofia'", [ORG])).rows[0].id;
    await repo.execute('code-black', DEMO_ADMIN, { type: 'member.status', memberId: sofia, status: 'suspended', reason: 'A reviewed test case.' }, randomUUID(), 'notifications-db');
    await assert.rejects(() => save('member_sofia', ['events'], 'daily'));
    await assert.rejects(() => asRuntime(sql => sql.query("INSERT INTO notification_preferences(id,organization_id,created_at,user_id,muted,digest,updated_at) VALUES('suspended',$1,now(),'member_sofia','[]','daily',now())", [ORG]), ORG, 'member_sofia'));
    await repo.execute('code-black', DEMO_ADMIN, { type: 'member.status', memberId: sofia, status: 'active', reason: 'Restored after the test.' }, randomUUID(), 'notifications-db');
});

test('digests queue one encrypted email per due member, list only unread notices, and never repeat', async () => {
    const past = new Date(Date.UTC(2026, 8, 20)).toISOString(), now = new Date(Date.UTC(2026, 8, 28));
    await db.query('UPDATE notification_preferences SET updated_at=$1,last_digest_at=NULL', [past]);
    await db.query("UPDATE notifications SET read_at=now() WHERE user_id IN ($1,'member_amina')", [DEMO_USER]);
    for (let i = 0; i < 25; i++) await db.query("INSERT INTO notifications(id,organization_id,created_at,user_id,title,body,href,read_at) VALUES($1,$2,$3,$4,$5,'Body','/post/post_welcome',NULL)", [`digest_${i}`, ORG, new Date(Date.UTC(2026, 8, 21, 0, i)).toISOString(), DEMO_USER, `Unread ${i}`]);
    await db.query("INSERT INTO notifications(id,organization_id,created_at,user_id,title,body,href,read_at) VALUES('digest_old',$1,$2,$3,'Before the period','Body','/home',NULL)", [ORG, new Date(Date.UTC(2026, 8, 1)).toISOString(), DEMO_USER]);
    const outbox = await count('SELECT count(*)::int AS n FROM email_outbox');
    const digests = new DigestService(runtime, mail, 'https://ferven.test');
    const first = await digests.run(now);
    assert.equal(first.queued, 1, 'Alex in Code Black has unread notices');
    assert.equal(first.quiet, 1, 'Alex in Studio North has none, so nothing is sent');
    assert.equal(await count('SELECT count(*)::int AS n FROM email_outbox'), outbox + 1);
    const row = (await db.query<{ payload: string; organization_id: string }>('SELECT payload,organization_id FROM email_outbox ORDER BY created_at DESC LIMIT 1')).rows[0];
    assert.equal(row.organization_id, ORG);
    assert(!row.payload.includes('alex@example.test'), 'the recipient is sealed');
    const message = mail.open(row.payload);
    assert.equal(message.to, 'alex@example.test');
    assert.match(message.subject, /weekly Code Black digest: 25 notices/);
    assert.match(message.text, /Unread 24/);
    assert.match(message.text, /And 5 more/);
    assert(!message.text.includes('Before the period'), 'only notices since the last digest');
    assert(message.text.includes('https://ferven.test/post/post_welcome'));
    // A second run in the same period, or an overlapping one, queues nothing more.
    assert.deepEqual(await digests.run(now), { due: 0, queued: 0, quiet: 0, skipped: 0 });
    // The next period lists only what arrived since.
    await db.query("INSERT INTO notifications(id,organization_id,created_at,user_id,title,body,href,read_at) VALUES('digest_new',$1,$2,$3,'Newer','Body','/events/event_open',NULL)", [ORG, new Date(Date.UTC(2026, 9, 1)).toISOString(), DEMO_USER]);
    const later = await digests.run(new Date(Date.UTC(2026, 9, 6)));
    assert.equal(later.queued, 1);
    const next = mail.open((await db.query<{ payload: string }>('SELECT payload FROM email_outbox ORDER BY created_at DESC LIMIT 1')).rows[0].payload);
    assert.match(next.subject, /1 notice you have not read/);
});

test('suspended members get no digest; the scheduled route needs the scheduler secret', async () => {
    const sofia = (await db.query<{ id: string }>("SELECT id FROM members WHERE organization_id=$1 AND user_id='member_sofia'", [ORG])).rows[0].id;
    await save('member_sofia', [], 'daily');
    await db.query("UPDATE notification_preferences SET updated_at=$1 WHERE user_id='member_sofia'", [new Date(Date.UTC(2026, 9, 1)).toISOString()]);
    await db.query("INSERT INTO notifications(id,organization_id,created_at,user_id,title,body,href,read_at) VALUES('sofia_unread',$1,$2,'member_sofia','Unread','Body','/home',NULL)", [ORG, new Date(Date.UTC(2026, 9, 1, 12)).toISOString()]);
    await repo.execute('code-black', DEMO_ADMIN, { type: 'member.status', memberId: sofia, status: 'suspended', reason: 'A reviewed test case.' }, randomUUID(), 'notifications-db');
    const outbox = await count('SELECT count(*)::int AS n FROM email_outbox');
    const result = await new DigestService(runtime, mail, 'https://ferven.test').run(new Date(Date.UTC(2026, 9, 3)));
    assert.equal(result.skipped, 1);
    assert.equal(await count('SELECT count(*)::int AS n FROM email_outbox'), outbox);
    const app = createApp({ repository: new WorkspaceRepository(db), origin: 'https://ferven.test', resolveSession: async () => null, mail, cronSecret: cron, digests: new DigestService(runtime, mail, 'https://ferven.test') });
    assert.equal((await app.request('/api/internal/digests')).status, 403);
    assert.equal((await app.request('/api/internal/digests', { headers: { Authorization: 'Bearer wrong' } })).status, 403);
    const ok = await app.request('/api/internal/digests', { headers: { Authorization: 'Bearer ' + cron } });
    assert.equal(ok.status, 200);
    assert.equal((await ok.json()).configured, true);
    assert.equal((await (await app.request('/api/account/capabilities')).json()).emailDigests, false, 'no mail transport, so digests are not offered as sent');
    const bare = createApp({ repository: new WorkspaceRepository(db), origin: 'https://ferven.test', resolveSession: async () => null, cronSecret: cron });
    assert.deepEqual(await (await bare.request('/api/internal/digests', { headers: { Authorization: 'Bearer ' + cron } })).json(), { configured: false, due: 0, queued: 0, quiet: 0, skipped: 0 });
});
