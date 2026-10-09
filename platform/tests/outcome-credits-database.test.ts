import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { openDatabase, type Database, type SQL } from '../packages/db/src/connection';
import { migrate } from '../packages/db/src/migrate';
import { WorkspaceRepository, setContext } from '../packages/db/src/repository';
import { grantRuntimeTables } from '../packages/db/src/runtime-role';
import { createSeed, DEMO_ADMIN, DEMO_USER } from '../packages/domain/src/seed';
import { seedBeforeProjectWork } from './helpers/legacy-fixture';
import { MIGRATION_COUNT } from './helpers/migrations';

// Alpha 59: credits on outcomes through the restricted runtime role and row security (migration 0050, decision 059).
const ORG = 'org_code_black', NORTH = 'org_studio_north', IDRIS = 'member_idris', NIA = 'member_nia', SOFIA = 'member_sofia';
let db: Database, repo: WorkspaceRepository, outcomeId = '', creditId = '';
const exec = (cmd: unknown, user = DEMO_USER) => repo.execute('code-black', user, cmd, randomUUID(), 'outcome-credits-db');
const as = <T>(user: string, org: string, fn: (tx: SQL) => Promise<T>) => db.transaction(async tx => { await tx.query('SET LOCAL ROLE reunir_app'); await setContext(tx, org, user); return fn(tx); });
const ids = (tx: SQL, sql: string, params: unknown[] = []) => tx.query<{ id: string }>(sql, params).then(r => r.rows.map(x => x.id).sort());
/** Runs inside a transaction that is always rolled back, so probes leave no rows behind. `setup` runs as the owner first. */
async function probe(user: string, fn: (tx: SQL) => Promise<unknown>, org = ORG, setup?: (tx: SQL) => Promise<unknown>) {
    try { await db.transaction(async tx => { await setup?.(tx); await tx.query('SET LOCAL ROLE reunir_app'); await setContext(tx, org, user); await fn(tx); throw new Error('rollback'); }); }
    catch (e) { if ((e as Error).message !== 'rollback') throw e; }
}
const insert = (tx: SQL, invitedBy: string, userId: string, o = outcomeId, project: string | null = 'project_common', id = 'k_probe') =>
    tx.query("INSERT INTO outcome_credits(id,organization_id,created_at,outcome_id,project_id,user_id,invited_by,role,status) VALUES($1,$2,now(),$3,$4,$5,$6,'','invited')", [id, ORG, o, project, userId, invitedBy]);

before(async () => {
    db = await openDatabase('pglite:memory'); await migrate(db);
    const owner = new WorkspaceRepository(db); await owner.seed(createSeed()); await owner.seed(createSeed('studio-north'));
    await db.query('CREATE ROLE reunir_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS');
    await db.transaction(grantRuntimeTables);
    const runtime = Object.create(db) as Database;
    runtime.transaction = fn => db.transaction(async tx => { await tx.query('SET LOCAL ROLE reunir_app'); return fn(tx); });
    repo = new WorkspaceRepository(runtime);
    const contributionId = (await exec({ type: 'contribution.submit', projectId: 'project_common', title: 'Ran the first onboarding test', body: 'Observed three sessions with Idris.' })).objectId!;
    await exec({ type: 'contribution.review', contributionId, decision: 'recognised', feedback: 'Clear notes from three sessions.' }, DEMO_ADMIN);
    outcomeId = (await exec({ type: 'outcome.submit', purposeId: 'purpose_build', contributionId, title: 'A clearer first-run experience', summary: 'Three observed sessions led to a simpler first screen.' })).objectId!;
    creditId = (await exec({ type: 'outcome.credit.invite', outcomeId, userId: IDRIS, role: 'co-author' })).objectId!;
});
after(async () => db?.close());

test('0050 upgrade keeps every outcome and member as they were and credits nobody', async () => {
    const old = await openDatabase('pglite:memory');
    try {
        await migrate(old, '0049'); await seedBeforeProjectWork(old);
        const read = async (table: string) => (await old.query(`SELECT * FROM ${table} ORDER BY organization_id,id`)).rows;
        const before = { outcomes: await read('outcomes'), members: await read('members'), community_outputs: await read('community_outputs') };
        await migrate(old); await migrate(old);
        for (const table of ['outcomes', 'members', 'community_outputs'] as const) assert.deepEqual(await read(table), before[table], table);
        assert.deepEqual(await read('outcome_credits'), []);
        assert.equal((await old.query('SELECT version FROM schema_migrations')).rows.length, MIGRATION_COUNT);
    } finally { await old.close(); }
});

test('through the restricted role, an invitation is seen only by the author and the person named', async () => {
    assert.deepEqual((await repo.snapshot('code-black', IDRIS)).outcomeCredits.filter(k => k.id === creditId).map(k => [k.status, k.role, k.projectId]), [['invited', 'co-author', 'project_common']]);
    assert((await repo.snapshot('code-black', IDRIS)).outcomes.some(o => o.id === outcomeId), 'the invited person reads the outcome before it is reviewed');
    assert(!(await repo.snapshot('code-black', SOFIA)).outcomes.some(o => o.id === outcomeId));
    assert(!(await repo.snapshot('code-black', DEMO_ADMIN)).outcomeCredits.some(k => k.id === creditId));
    for (const user of [DEMO_ADMIN, NIA, SOFIA]) await as(user, ORG, async tx => assert.deepEqual(await ids(tx, 'SELECT id FROM outcome_credits WHERE id=$1', [creditId]), [], user));
    await as(IDRIS, ORG, async tx => assert.deepEqual(await ids(tx, 'SELECT id FROM outcome_credits WHERE id=$1', [creditId]), [creditId]));
    // Accepted credits, like the fictional seed's, are readable in the community and nowhere else.
    await as(SOFIA, ORG, async tx => assert.deepEqual(await ids(tx, 'SELECT id FROM outcome_credits'), ['outcome_credit_nia_notes']));
    await as(IDRIS, NORTH, async tx => assert(!(await ids(tx, 'SELECT id FROM outcome_credits')).includes(creditId)));
});

test('only the outcome’s author invites, in their own name, on the outcome’s own project and while it stands', async () => {
    await assert.rejects(() => probe(IDRIS, tx => insert(tx, IDRIS, DEMO_USER)), /foreign key|row-level security/, 'not the author');
    await assert.rejects(() => probe(IDRIS, tx => insert(tx, DEMO_USER, IDRIS)), /row-level security/, 'never in someone else’s name');
    await assert.rejects(() => probe(DEMO_USER, tx => insert(tx, DEMO_USER, SOFIA)), /foreign key/, 'Sofia is not on the team');
    await assert.rejects(() => probe(DEMO_USER, tx => insert(tx, DEMO_USER, IDRIS)), /outcome_credits_live_idx|duplicate key/, 'one live credit per person');
    await assert.rejects(() => probe(DEMO_USER, tx => insert(tx, DEMO_USER, IDRIS, outcomeId, null, 'k_unteamed')), /row-level security/, 'dropping the project skips no team check');
    await assert.rejects(() => probe(DEMO_USER, tx => insert(tx, DEMO_USER, IDRIS, outcomeId, 'project_common', 'k_cross'), NORTH), /row-level security|foreign key/, 'not into another community');
    await assert.rejects(() => probe(SOFIA, tx => insert(tx, SOFIA, NIA, 'outcome_notes', 'project_notes', 'k_withdrawn'), ORG,
        tx => tx.query("UPDATE outcomes SET status='withdrawn' WHERE organization_id=$1 AND id='outcome_notes'", [ORG])), /row-level security/, 'a withdrawn outcome takes no new credits');
});

test('the person named answers once; nobody else can, and the offer itself never changes', async () => {
    const answer = (tx: SQL, status: string) => tx.query("UPDATE outcome_credits SET status=$2,responded_at=now() WHERE id=$1 RETURNING id", [creditId, status]).then(r => r.rows.length);
    await probe(DEMO_ADMIN, async tx => assert.equal(await answer(tx, 'accepted'), 0, 'an administrator cannot accept for them'));
    await assert.rejects(() => probe(DEMO_USER, tx => answer(tx, 'accepted')), /row-level security/, 'the author cannot accept on their behalf');
    await assert.rejects(() => probe(IDRIS, tx => tx.query("UPDATE outcome_credits SET role='lead' WHERE id=$1", [creditId])), /permission denied/);
    await assert.rejects(() => probe(IDRIS, tx => tx.query("UPDATE outcome_credits SET outcome_id='outcome_notes' WHERE id=$1", [creditId])), /permission denied/);
    await exec({ type: 'outcome.credit.respond', creditId, decision: 'accepted' }, IDRIS);
    assert.deepEqual((await db.query("SELECT status,responded_at IS NOT NULL AS answered FROM outcome_credits WHERE id=$1", [creditId])).rows, [{ status: 'accepted', answered: true }]);
    await as(NIA, ORG, async tx => assert.deepEqual(await ids(tx, 'SELECT id FROM outcome_credits WHERE id=$1', [creditId]), [creditId], 'accepted credits are readable in the community'));
    assert.deepEqual((await db.query("SELECT user_id,href FROM notifications WHERE title='Credit accepted'")).rows, [{ user_id: DEMO_USER, href: '/outputs' }]);
    await assert.rejects(() => exec({ type: 'outcome.review', outcomeId, decision: 'verified', feedback: 'Looks right.' }, IDRIS), { code: 'FORBIDDEN' });
});

test('either person withdraws, and no credit is deleted outside the person’s own account deletion', async () => {
    await probe(DEMO_ADMIN, async tx => assert.equal((await tx.query('DELETE FROM outcome_credits RETURNING id')).rows.length, 0));
    await probe(IDRIS, async tx => assert.equal((await tx.query('DELETE FROM outcome_credits WHERE user_id=$1 RETURNING id', [IDRIS])).rows.length, 0, 'no mark, no deletion'));
    await assert.rejects(() => probe(IDRIS, tx => tx.query("UPDATE outcome_credits SET status='withdrawn',withdrawn_by=$2,withdrawn_at=now() WHERE id=$1", [creditId, DEMO_USER])), /row-level security/, 'only in their own name');
    await exec({ type: 'outcome.credit.withdraw', creditId }, IDRIS);
    assert.deepEqual((await db.query('SELECT status,withdrawn_by FROM outcome_credits WHERE id=$1', [creditId])).rows, [{ status: 'withdrawn', withdrawn_by: IDRIS }]);
    await assert.rejects(() => exec({ type: 'outcome.credit.invite', outcomeId, userId: IDRIS }), { code: 'CREDIT_REFUSED' });
});

test('runtime grants allow offering, answering and withdrawing, never rewriting the offer', async () => {
    const can = async (privilege: string) => (await db.query<{ ok: boolean }>("SELECT has_table_privilege('reunir_app','outcome_credits',$1) AS ok", [privilege])).rows[0].ok;
    const column = async (name: string) => (await db.query<{ ok: boolean }>("SELECT has_column_privilege('reunir_app','outcome_credits',$1,'UPDATE') AS ok", [name])).rows[0].ok;
    assert.deepEqual([await can('SELECT'), await can('INSERT'), await can('DELETE'), await can('UPDATE')], [true, true, true, false]);
    assert.deepEqual(await Promise.all(['status', 'responded_at', 'withdrawn_by', 'withdrawn_at'].map(column)), [true, true, true, true]);
    assert.deepEqual(await Promise.all(['user_id', 'invited_by', 'role', 'outcome_id', 'project_id', 'created_at'].map(column)), [false, false, false, false, false, false]);
    const r = await db.query<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>("SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE relname='outcome_credits'");
    assert.deepEqual(r.rows, [{ relrowsecurity: true, relforcerowsecurity: true }]);
});
