import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase, type Database, type SQL } from '../packages/db/src/connection';
import { migrate } from '../packages/db/src/migrate';
import { WorkspaceRepository, setContext } from '../packages/db/src/repository';
import { grantRuntimeTables } from '../packages/db/src/runtime-role';
import { createSeed, DEMO_ADMIN, DEMO_USER } from '../packages/domain/src/seed';
import { MIGRATION_COUNT } from './helpers/migrations';
import { RETENTION_DAYS } from '../packages/contracts/src/retention';

// Alpha 60: usage counts through the restricted runtime role and row security (migration 0051, decision 060).
const ORG = 'org_code_black', NORTH = 'org_studio_north', SOFIA = 'member_sofia', MAYA = 'member_maya';
/** Today as the migration counts it: the UTC day. */
const TODAY = "(now() AT TIME ZONE 'UTC')::date";
let db: Database, repo: WorkspaceRepository;
/** Runs inside a transaction that is always rolled back. */
async function probe(user: string, fn: (tx: SQL) => Promise<unknown>, org = ORG, mark?: string, worker?: string) {
    try { await db.transaction(async tx => { await tx.query('SET LOCAL ROLE reunir_app'); await setContext(tx, org, user); if (mark) await tx.query("SELECT set_config('app.usage_count',$1,true)", [mark]); if (worker) await tx.query("SELECT set_config('app.worker',$1,true)", [worker]); await fn(tx); throw new Error('rollback'); }); }
    catch (e) { if ((e as Error).message !== 'rollback') throw e; }
}
const counts = async (org = ORG) => (await db.query<{ area: string; count: number }>("SELECT area,count FROM usage_counts WHERE organization_id=$1 ORDER BY area", [org])).rows;

before(async () => {
    db = await openDatabase('pglite:memory'); await migrate(db);
    const owner = new WorkspaceRepository(db); await owner.seed(createSeed()); await owner.seed(createSeed('studio-north'));
    await db.query('CREATE ROLE reunir_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS');
    await db.transaction(grantRuntimeTables);
    const runtime = Object.create(db) as Database;
    runtime.transaction = fn => db.transaction(async tx => { await tx.query('SET LOCAL ROLE reunir_app'); return fn(tx); });
    repo = new WorkspaceRepository(runtime);
    // Both fictional communities share their people; Sofia is not an active member of Studio North here.
    await db.query("UPDATE members SET status='suspended' WHERE organization_id=$1 AND user_id=$2", [NORTH, SOFIA]);
});
after(async () => db?.close());

test('0051 adds an empty table that has no column for a person, a time of day or a page', async () => {
    const columns = (await db.query<{ column_name: string }>("SELECT column_name FROM information_schema.columns WHERE table_name='usage_counts' ORDER BY ordinal_position")).rows.map(r => r.column_name);
    assert.deepEqual(columns, ['organization_id', 'day', 'area', 'count']);
    const old = await openDatabase('pglite:memory');
    try {
        await migrate(old, '0050'); await migrate(old); await migrate(old);
        assert.deepEqual((await old.query('SELECT * FROM usage_counts')).rows, []);
        assert.equal((await old.query('SELECT version FROM schema_migrations')).rows.length, MIGRATION_COUNT);
    } finally { await old.close(); }
});

test('an active member adds to today’s count for their community, and only that', async () => {
    await repo.recordUsage('code-black', DEMO_USER, 'projects');
    await repo.recordUsage('code-black', SOFIA, 'projects');
    await repo.recordUsage('code-black', DEMO_USER, 'messages');
    assert.deepEqual(await counts(), [{ area: 'messages', count: 1 }, { area: 'projects', count: 2 }]);
    assert.deepEqual(await counts(NORTH), []);
    await assert.rejects(() => repo.recordUsage('studio-north', SOFIA, 'projects'), { code: 'NOT_FOUND' }, 'not an active member there');
    await assert.rejects(() => repo.recordUsage('nowhere', DEMO_USER, 'projects'), { code: 'NOT_FOUND' });
    await db.query("UPDATE members SET status='suspended' WHERE organization_id=$1 AND user_id=$2", [ORG, SOFIA]);
    try { await assert.rejects(() => repo.recordUsage('code-black', SOFIA, 'projects'), { code: 'NOT_FOUND' }, 'a suspended member is not counted'); }
    finally { await db.query("UPDATE members SET status='active' WHERE organization_id=$1 AND user_id=$2", [ORG, SOFIA]); }
    assert.deepEqual(await counts(), [{ area: 'messages', count: 1 }, { area: 'projects', count: 2 }]);
});

test('row security: only owners and administrators read counts; nobody writes without the counting mark, or beyond today or one', async () => {
    const read = (tx: SQL) => tx.query('SELECT area FROM usage_counts').then(r => r.rows.length);
    await probe(DEMO_ADMIN, async tx => assert.equal(await read(tx), 2));
    for (const user of [DEMO_USER, MAYA]) await probe(user, async tx => assert.equal(await read(tx), 0, user));
    await probe(DEMO_ADMIN, async tx => assert.equal(await read(tx), 0), NORTH);
    const add = (tx: SQL, day = TODAY, count = 1) => tx.query(`INSERT INTO usage_counts(organization_id,day,area,count) VALUES($1,${day},'events',$2)`, [ORG, count]);
    await assert.rejects(() => probe(DEMO_USER, tx => add(tx)), /row-level security/, 'no mark, no count');
    await assert.rejects(() => probe(DEMO_USER, tx => add(tx), ORG, 'org_studio_north'), /row-level security/, 'the mark names this community');
    await assert.rejects(() => probe(DEMO_USER, tx => add(tx, `${TODAY}-1`), ORG, ORG), /row-level security/, 'only today');
    await assert.rejects(() => probe(DEMO_USER, tx => add(tx, TODAY, 50), ORG, ORG), /row-level security/, 'one at a time');
    await probe(DEMO_USER, async tx => assert.equal((await tx.query("UPDATE usage_counts SET count=count+100 WHERE organization_id=$1 RETURNING area", [ORG])).rows.length, 0), ORG);
    await assert.rejects(() => probe(DEMO_ADMIN, tx => tx.query("UPDATE usage_counts SET area='events' WHERE organization_id=$1", [ORG]), ORG, ORG), /permission denied/);
    await probe(DEMO_ADMIN, async tx => assert.equal((await tx.query('DELETE FROM usage_counts RETURNING area')).rows.length, 0, 'recent counts are never deleted'));
    // Only the retention job clears counts: days past keeping can go, a day sooner cannot, as RETENTION_DAYS.usageCounts says.
    await db.query(`INSERT INTO usage_counts(organization_id,day,area,count) VALUES($1,${TODAY}-$2::int,'saved',3),($1,${TODAY}-$2::int-1,'saved',4)`, [ORG, RETENTION_DAYS.usageCounts]);
    try {
        const clear = (tx: SQL) => tx.query<{ count: number }>('DELETE FROM usage_counts RETURNING count').then(r => r.rows);
        await probe(DEMO_ADMIN, async tx => assert.deepEqual(await clear(tx), [], 'not even an owner'));
        await probe('', async tx => assert.deepEqual(await clear(tx), [{ count: 4 }]), ORG, undefined, 'retention');
        await probe('', async tx => assert.deepEqual(await clear(tx), []), ORG, undefined, 'digest');
    } finally { await db.query("DELETE FROM usage_counts WHERE area='saved'"); }
});

test('owners and administrators get weekly totals with small counts hidden; members get nothing', async () => {
    const report = await repo.usage('code-black', DEMO_ADMIN);
    const row = (area: string) => report.areas.find(a => a.area === area)!.counts.at(-1);
    assert.deepEqual([row('projects'), row('messages'), row('events')], [null, null, 0]);
    for (let i = 0; i < 4; i++) await repo.recordUsage('code-black', DEMO_USER, 'projects');
    assert.equal((await repo.usage('code-black', DEMO_ADMIN)).areas.find(a => a.area === 'projects')!.counts.at(-1), 6);
    await assert.rejects(() => repo.usage('code-black', DEMO_USER), { code: 'FORBIDDEN' });
    await assert.rejects(() => repo.usage('code-black', MAYA), { code: 'FORBIDDEN' }, 'moderators do not see usage');
});

test('runtime grants: read, add and clear old days; never rename a count', async () => {
    const can = async (privilege: string) => (await db.query<{ ok: boolean }>("SELECT has_table_privilege('reunir_app','usage_counts',$1) AS ok", [privilege])).rows[0].ok;
    const column = async (name: string) => (await db.query<{ ok: boolean }>("SELECT has_column_privilege('reunir_app','usage_counts',$1,'UPDATE') AS ok", [name])).rows[0].ok;
    assert.deepEqual([await can('SELECT'), await can('INSERT'), await can('DELETE'), await can('UPDATE')], [true, true, true, false]);
    assert.deepEqual(await Promise.all(['count', 'area', 'day', 'organization_id'].map(column)), [true, false, false, false]);
    const r = await db.query<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>("SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE relname='usage_counts'");
    assert.deepEqual(r.rows, [{ relrowsecurity: true, relforcerowsecurity: true }]);
});
