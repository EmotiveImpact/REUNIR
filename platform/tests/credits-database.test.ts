import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { openDatabase, type Database, type SQL } from '../packages/db/src/connection';
import { migrate } from '../packages/db/src/migrate';
import { WorkspaceRepository, setContext } from '../packages/db/src/repository';
import { grantRuntimeTables } from '../packages/db/src/runtime-role';
import { createSeed, DEMO_ADMIN, DEMO_USER } from '../packages/domain/src/seed';
import { seedBeforeProjectWork } from './helpers/legacy-fixture';

const ORG = 'org_code_black', NORTH = 'org_studio_north', IDRIS = 'member_idris', NIA = 'member_nia', SOFIA = 'member_sofia';
let db: Database, repo: WorkspaceRepository, contributionId = '', creditId = '';
const exec = (cmd: unknown, user = DEMO_USER) => repo.execute('code-black', user, cmd, randomUUID(), 'credits-db');
const as = <T>(user: string, org: string, fn: (tx: SQL) => Promise<T>) => db.transaction(async tx => { await tx.query('SET LOCAL ROLE reunir_app'); await setContext(tx, org, user); return fn(tx); });
const ids = (tx: SQL, sql: string, params: unknown[] = []) => tx.query<{ id: string }>(sql, params).then(r => r.rows.map(x => x.id).sort());
/** Runs inside a transaction that is always rolled back, so probes leave no rows behind. */
async function probe(user: string, fn: (tx: SQL) => Promise<unknown>, org = ORG) {
    try { await db.transaction(async tx => { await tx.query('SET LOCAL ROLE reunir_app'); await setContext(tx, org, user); await fn(tx); throw new Error('rollback'); }); }
    catch (e) { if ((e as Error).message !== 'rollback') throw e; }
}
const insert = (tx: SQL, invitedBy: string, userId: string, id = 'k_probe') => tx.query("INSERT INTO contribution_credits(id,organization_id,created_at,contribution_id,project_id,user_id,invited_by,role,status) VALUES($1,$2,now(),$3,'project_common',$4,$5,'','invited')", [id, ORG, contributionId, userId, invitedBy]);

before(async () => {
    db = await openDatabase('pglite:memory'); await migrate(db);
    const owner = new WorkspaceRepository(db); await owner.seed(createSeed()); await owner.seed(createSeed('studio-north'));
    await db.query('CREATE ROLE reunir_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS');
    await db.transaction(grantRuntimeTables);
    const runtime = Object.create(db) as Database;
    runtime.transaction = fn => db.transaction(async tx => { await tx.query('SET LOCAL ROLE reunir_app'); return fn(tx); });
    repo = new WorkspaceRepository(runtime);
    contributionId = (await exec({ type: 'contribution.submit', projectId: 'project_common', title: 'Ran the first onboarding test', body: 'Observed three sessions with Idris.' })).objectId!;
    creditId = (await exec({ type: 'credit.invite', contributionId, userId: IDRIS, role: 'co-author' })).objectId!;
});
after(async () => db?.close());

test('0033 upgrade keeps every contribution as it was and credits nobody', async () => {
    const old = await openDatabase('pglite:memory');
    try {
        await migrate(old, '0032'); await seedBeforeProjectWork(old);
        const read = async (table: string) => (await old.query(`SELECT * FROM ${table} ORDER BY organization_id,id`)).rows;
        const before = { contributions: await read('contributions'), members: await read('members'), reputation: await read('reputation') };
        await migrate(old); await migrate(old);
        for (const table of ['contributions', 'members', 'reputation'] as const) assert.deepEqual(await read(table), before[table], table);
        assert.deepEqual(await read('contribution_credits'), []);
        assert.equal((await old.query('SELECT version FROM schema_migrations')).rows.length, 26);
    } finally { await old.close(); }
});

test('through the restricted role, an invitation is seen only by the author and the person named', async () => {
    assert.deepEqual((await repo.snapshot('code-black', IDRIS)).contributionCredits.filter(k => k.id === creditId).map(k => [k.status, k.role]), [['invited', 'co-author']]);
    assert(!(await repo.snapshot('code-black', DEMO_ADMIN)).contributionCredits.some(k => k.id === creditId));
    // The database itself withholds the invitation from everyone else, administrators included.
    for (const user of [DEMO_ADMIN, NIA, SOFIA]) await as(user, ORG, async tx => assert.deepEqual(await ids(tx, 'SELECT id FROM contribution_credits WHERE id=$1', [creditId]), [], user));
    await as(IDRIS, ORG, async tx => assert.deepEqual(await ids(tx, 'SELECT id FROM contribution_credits WHERE id=$1', [creditId]), [creditId]));
    // Accepted credits, like the fictional seed's, are readable in the community and nowhere else.
    await as(SOFIA, ORG, async tx => assert.deepEqual(await ids(tx, 'SELECT id FROM contribution_credits'), ['credit_nia_notes']));
    await as(IDRIS, NORTH, async tx => assert(!(await ids(tx, 'SELECT id FROM contribution_credits')).includes(creditId)));
});

test('only the contribution’s author invites, in their own name, an active teammate', async () => {
    await assert.rejects(() => probe(IDRIS, tx => insert(tx, IDRIS, NIA)), /foreign key|row-level security/, 'not the author');
    await assert.rejects(() => probe(IDRIS, tx => insert(tx, DEMO_USER, SOFIA)), /row-level security/, 'never in someone else’s name');
    await assert.rejects(() => probe(DEMO_USER, tx => insert(tx, DEMO_USER, NIA)), /foreign key/, 'Nia is not on the team');
    await assert.rejects(() => probe(DEMO_USER, tx => insert(tx, DEMO_USER, IDRIS)), /contribution_credits_live_idx|duplicate key/, 'one live credit per person');
    await assert.rejects(() => probe(DEMO_USER, tx => insert(tx, DEMO_USER, IDRIS, 'k_cross'), NORTH), /row-level security|foreign key/, 'not into another community');
});

test('the person named answers once; nobody else can, and the offer itself never changes', async () => {
    const answer = (tx: SQL, status: string) => tx.query("UPDATE contribution_credits SET status=$2,responded_at=now() WHERE id=$1 RETURNING id", [creditId, status]).then(r => r.rows.length);
    await probe(DEMO_ADMIN, async tx => assert.equal(await answer(tx, 'accepted'), 0, 'an administrator cannot accept for them'));
    await probe(NIA, async tx => assert.equal(await answer(tx, 'accepted'), 0));
    await assert.rejects(() => probe(DEMO_USER, tx => answer(tx, 'accepted')), /row-level security/, 'the author cannot accept on their behalf');
    await assert.rejects(() => probe(IDRIS, tx => tx.query("UPDATE contribution_credits SET role='lead' WHERE id=$1", [creditId])), /permission denied/);
    await assert.rejects(() => probe(IDRIS, tx => tx.query("UPDATE contribution_credits SET user_id=$2 WHERE id=$1", [creditId, SOFIA])), /permission denied/);
    await exec({ type: 'credit.respond', creditId, decision: 'accepted' }, IDRIS);
    assert.deepEqual((await db.query("SELECT status,responded_at IS NOT NULL AS answered FROM contribution_credits WHERE id=$1", [creditId])).rows, [{ status: 'accepted', answered: true }]);
    await as(NIA, ORG, async tx => assert.deepEqual(await ids(tx, 'SELECT id FROM contribution_credits WHERE id=$1', [creditId]), [creditId], 'accepted credits are readable in the community'));
    const notice = (await db.query<{ user_id: string; title: string }>("SELECT user_id,title FROM notifications WHERE title='Credit accepted'")).rows;
    assert.deepEqual(notice, [{ user_id: DEMO_USER, title: 'Credit accepted' }]);
});

test('suspension ends a member’s ability to answer or withdraw at once', async () => {
    await db.query("UPDATE members SET status='suspended' WHERE organization_id=$1 AND user_id=$2", [ORG, IDRIS]);
    try {
        await probe(IDRIS, async tx => assert.equal((await tx.query("UPDATE contribution_credits SET status='withdrawn',withdrawn_by=$2,withdrawn_at=now() WHERE id=$1 RETURNING id", [creditId, IDRIS])).rows.length, 0));
        await assert.rejects(() => repo.execute('code-black', IDRIS, { type: 'credit.withdraw', creditId }, randomUUID(), 'credits-db'), { code: 'NOT_FOUND' });
        assert(!(await repo.snapshot('code-black', NIA)).contributionCredits.some(k => k.id === creditId), 'members do not see a suspended member’s credit');
        assert((await repo.snapshot('code-black', DEMO_ADMIN)).contributionCredits.some(k => k.id === creditId), 'administrators still do');
    } finally { await db.query("UPDATE members SET status='active' WHERE organization_id=$1 AND user_id=$2", [ORG, IDRIS]); }
});

test('either person withdraws, and no credit is deleted outside the person’s own account deletion', async () => {
    await probe(DEMO_ADMIN, async tx => assert.equal((await tx.query('DELETE FROM contribution_credits RETURNING id')).rows.length, 0));
    await probe(IDRIS, async tx => assert.equal((await tx.query('DELETE FROM contribution_credits WHERE user_id=$1 RETURNING id', [IDRIS])).rows.length, 0, 'no mark, no deletion'));
    await assert.rejects(() => probe(IDRIS, tx => tx.query("UPDATE contribution_credits SET status='withdrawn',withdrawn_by=$2,withdrawn_at=now() WHERE id=$1", [creditId, DEMO_USER])), /row-level security/, 'only in their own name');
    await exec({ type: 'credit.withdraw', creditId }, IDRIS);
    assert.deepEqual((await db.query('SELECT status,withdrawn_by FROM contribution_credits WHERE id=$1', [creditId])).rows, [{ status: 'withdrawn', withdrawn_by: IDRIS }]);
    await assert.rejects(() => exec({ type: 'credit.invite', contributionId, userId: IDRIS }), { code: 'CREDIT_REFUSED' });
});

test('credits never touch recognition, reputation or roles', async () => {
    const reputation = (await db.query("SELECT count(*)::int AS n FROM reputation WHERE organization_id=$1", [ORG])).rows[0];
    const roles = (await db.query("SELECT user_id,role FROM members WHERE organization_id=$1 ORDER BY user_id", [ORG])).rows;
    const k = (await exec({ type: 'credit.invite', contributionId: 'contribution_notes', userId: NIA }, SOFIA).catch(e => e)) as { code?: string };
    assert.equal(k.code, 'ALREADY_CREDITED', 'the seed already credits Nia');
    assert.deepEqual((await db.query("SELECT count(*)::int AS n FROM reputation WHERE organization_id=$1", [ORG])).rows[0], reputation);
    assert.deepEqual((await db.query("SELECT user_id,role FROM members WHERE organization_id=$1 ORDER BY user_id", [ORG])).rows, roles);
});

test('runtime grants allow offering, answering and withdrawing, never rewriting the offer', async () => {
    const can = async (privilege: string) => (await db.query<{ ok: boolean }>("SELECT has_table_privilege('reunir_app','contribution_credits',$1) AS ok", [privilege])).rows[0].ok;
    const column = async (name: string) => (await db.query<{ ok: boolean }>("SELECT has_column_privilege('reunir_app','contribution_credits',$1,'UPDATE') AS ok", [name])).rows[0].ok;
    assert.deepEqual([await can('SELECT'), await can('INSERT'), await can('DELETE'), await can('UPDATE')], [true, true, true, false]);
    assert.deepEqual(await Promise.all(['status', 'responded_at', 'withdrawn_by', 'withdrawn_at'].map(column)), [true, true, true, true]);
    assert.deepEqual(await Promise.all(['user_id', 'invited_by', 'role', 'contribution_id', 'created_at'].map(column)), [false, false, false, false, false]);
    const r = await db.query<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>("SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE relname='contribution_credits'");
    assert.deepEqual(r.rows, [{ relrowsecurity: true, relforcerowsecurity: true }]);
});
