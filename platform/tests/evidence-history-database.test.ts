import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { openDatabase, type Database } from '../packages/db/src/connection';
import { migrate } from '../packages/db/src/migrate';
import { grantRuntimeTables } from '../packages/db/src/runtime-role';
import { WorkspaceRepository, setContext } from '../packages/db/src/repository';
import { createSeed, DEMO_USER, DEMO_ADMIN } from '../packages/domain/src/seed';

const ORG = 'org_code_black', OWNER = 'member_idris';
let db: Database, repo: WorkspaceRepository;
const exec = (cmd: unknown, user = DEMO_USER, slug = 'code-black') => repo.execute(slug, user, cmd, randomUUID(), 'evidence-db');
/** Runs one statement as the restricted role in a tenant context. */
const asRuntime = <T>(fn: (sql: Database) => Promise<T>, org = ORG, user = DEMO_USER) => db.transaction(async tx => {
    await tx.query('SET LOCAL ROLE reunir_app');
    await setContext(tx, org, user);
    return fn(tx as unknown as Database);
});
const wording = { title: 'A tested contribution, with three testers', text: 'An actual persisted record, corrected.', evidenceUrl: 'https://example.com/evidence' };
let contributionId = '', outcomeId = '';

before(async () => {
    db = await openDatabase('pglite:memory'); await migrate(db);
    const owner = new WorkspaceRepository(db); await owner.seed(createSeed()); await owner.seed(createSeed('studio-north'));
    await db.query('CREATE ROLE reunir_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS');
    await db.transaction(grantRuntimeTables);
    const runtime = Object.create(db) as Database;
    runtime.transaction = fn => db.transaction(async tx => { await tx.query('SET LOCAL ROLE reunir_app'); return fn(tx); });
    repo = new WorkspaceRepository(runtime);
    await exec({ type: 'project.join', projectId: 'project_common' });
    contributionId = (await exec({ type: 'contribution.submit', projectId: 'project_common', title: 'A tested contribution', body: 'An actual persisted record.', evidenceUrl: 'https://example.com/evidence' })).objectId!;
    await exec({ type: 'contribution.review', contributionId, decision: 'recognised', feedback: 'Reviewed the evidence.' }, OWNER);
    outcomeId = (await exec({ type: 'outcome.submit', purposeId: 'purpose_build', contributionId, title: 'A usable first version', summary: 'Verified within our community.' })).objectId!;
    await exec({ type: 'outcome.review', outcomeId, decision: 'verified', feedback: 'Checked the linked work.' }, DEMO_ADMIN);
    await exec({ type: 'goal.status', goalId: 'goal_alex', status: 'completed', outcomeId });
    await exec({ type: 'output.publish', outcomeId, kind: 'software' }, DEMO_ADMIN);
});
after(async () => db?.close());

test('a correction persists under the restricted role, waits, and its acceptance keeps the earlier wording', async () => {
    const r = await exec({ type: 'evidence.correct', subject: 'contribution', subjectId: contributionId, ...wording, reason: 'The tester count was missing.' });
    const row = async () => (await db.query<Record<string, unknown>>('SELECT kind,status,previous,proposed,previous_status,decided_by FROM evidence_changes WHERE id=$1', [r.objectId])).rows[0];
    assert.deepEqual(await row(), { kind: 'correction', status: 'pending', previous: { title: 'A tested contribution', text: 'An actual persisted record.', evidenceUrl: 'https://example.com/evidence' }, proposed: wording, previous_status: 'recognised', decided_by: null });
    assert(!(await repo.snapshot('code-black', 'member_jordan')).evidenceChanges.some(c => c.id === r.objectId), 'another member does not see a waiting correction');
    assert((await repo.snapshot('code-black', OWNER)).evidenceChanges.some(c => c.id === r.objectId), 'the project owner does');
    await assert.rejects(() => exec({ type: 'evidence.correct', subject: 'contribution', subjectId: contributionId, ...wording, title: 'Another', reason: 'Again.' }), { code: 'CORRECTION_PENDING' });
    await exec({ type: 'evidence.correction.review', changeId: r.objectId, decision: 'accepted', response: 'Matches the notes.' }, OWNER);
    assert.equal((await row()).status, 'accepted');
    assert.equal((await db.query<{ title: string }>('SELECT title FROM contributions WHERE id=$1', [contributionId])).rows[0].title, wording.title);
    const seen = await repo.snapshot('code-black', 'member_jordan');
    assert.equal(seen.evidenceChanges.find(c => c.id === r.objectId)?.previous.title, 'A tested contribution', 'the decided change is visible with the evidence');
});

test('an outcome correction updates the published output in the same transaction', async () => {
    const r = await exec({ type: 'evidence.correct', subject: 'outcome', subjectId: outcomeId, title: 'A usable first version, tested twice', text: 'Verified within our community, twice.', evidenceUrl: '', reason: 'A second test happened.' });
    await exec({ type: 'evidence.correction.review', changeId: r.objectId, decision: 'accepted', response: 'Confirmed.' }, DEMO_ADMIN);
    assert.deepEqual((await db.query('SELECT title,summary FROM community_outputs WHERE organization_id=$1 AND outcome_id=$2', [ORG, outcomeId])).rows, [{ title: 'A usable first version, tested twice', summary: 'Verified within our community, twice.' }]);
});

test('withdrawal persists through the constraints: the outcome follows and the goal reopens', async () => {
    await exec({ type: 'evidence.withdraw', subject: 'contribution', subjectId: contributionId, reason: 'The notes belonged to another project.' });
    assert.equal((await db.query<{ status: string }>('SELECT status FROM contributions WHERE id=$1', [contributionId])).rows[0].status, 'withdrawn');
    assert.equal((await db.query<{ status: string }>('SELECT status FROM outcomes WHERE id=$1', [outcomeId])).rows[0].status, 'withdrawn');
    assert.deepEqual((await db.query('SELECT status,outcome_id,completed_at FROM member_goals WHERE organization_id=$1 AND id=$2', [ORG, 'goal_alex'])).rows, [{ status: 'active', outcome_id: null, completed_at: null }]);
    assert.equal((await db.query<{ n: number }>("SELECT count(*)::int AS n FROM evidence_changes WHERE kind='withdrawal' AND status='applied'")).rows[0].n, 2);
    const s = await repo.snapshot('code-black', 'member_jordan');
    assert(!s.communityOutputs.some(o => o.outcomeId === outcomeId));
    assert.equal(s.contributions.find(c => c.id === contributionId)?.status, 'withdrawn');
});

test('status checks accept withdrawn and reject anything else', async () => {
    await assert.rejects(() => db.query("UPDATE contributions SET status='retracted' WHERE organization_id=$1 AND id='contribution_notes'", [ORG]), /contributions_status_check/);
    await assert.rejects(() => db.query("UPDATE outcomes SET status='retracted' WHERE organization_id=$1 AND id='outcome_notes'", [ORG]), /outcomes_status_check/);
    for (const [table, id, back] of [['outcomes', 'outcome_notes', 'verified'], ['contributions', 'contribution_notes', 'recognised']]) {
        await db.query(`UPDATE ${table} SET status='withdrawn' WHERE organization_id=$1 AND id=$2`, [ORG, id]);
        await db.query(`UPDATE ${table} SET status=$3 WHERE organization_id=$1 AND id=$2`, [ORG, id, back]);
    }
    // Withdrawn evidence was reviewed: the existing reviewer checks still hold.
    await assert.rejects(() => db.query("UPDATE contributions SET status='withdrawn',reviewer_id=NULL,reviewed_at=NULL WHERE organization_id=$1 AND id='contribution_notes'", [ORG]));
    const insert = (id: string, extra: string) => db.query(`INSERT INTO evidence_changes(id,organization_id,created_at,subject,subject_id,kind,requested_by,reason,previous,proposed,previous_status,status,decided_by,decided_at,response) VALUES($1,$2,now(),${extra})`, [id, ORG]);
    const previous = `'{"title":"t","text":"x","evidenceUrl":""}'::jsonb`;
    await assert.rejects(() => insert('bad_status', `'contribution','contribution_notes','correction','member_sofia','r',${previous},${previous},'recognised','reviewed',NULL,NULL,''`));
    await assert.rejects(() => insert('bad_withdrawal', `'contribution','contribution_notes','withdrawal','member_sofia','r',${previous},${previous},'recognised','applied','member_sofia',now(),''`), 'a withdrawal proposes nothing');
    await assert.rejects(() => insert('bad_previous', `'outcome','outcome_notes','correction','member_sofia','r','{"title":"t"}'::jsonb,${previous},'verified','pending',NULL,NULL,''`), 'the earlier wording is complete');
    await assert.rejects(() => insert('bad_pair', `'outcome','outcome_notes','correction','member_sofia','r',${previous},${previous},'recognised','pending',NULL,NULL,''`), 'an outcome was verified, not recognised');
    await insert('one_pending', `'contribution','contribution_notes','correction','member_sofia','r',${previous},${previous},'recognised','pending',NULL,NULL,''`);
    await assert.rejects(() => insert('two_pending', `'contribution','contribution_notes','correction','member_sofia','r',${previous},${previous},'recognised','pending',NULL,NULL,''`), /evidence_changes_one_pending_idx/);
    await db.query("DELETE FROM evidence_changes WHERE id='one_pending'");
});

test('the runtime role records decisions only: no rewording, no deletion, no other community', async () => {
    const id = (await db.query<{ id: string }>("SELECT id FROM evidence_changes WHERE organization_id=$1 ORDER BY created_at LIMIT 1", [ORG])).rows[0].id;
    await assert.rejects(() => asRuntime(sql => sql.query("UPDATE evidence_changes SET previous='{}'::jsonb WHERE id=$1", [id])), /permission denied/);
    await assert.rejects(() => asRuntime(sql => sql.query('UPDATE evidence_changes SET reason=$2 WHERE id=$1', [id, 'Rewritten'])), /permission denied/);
    await assert.rejects(() => asRuntime(sql => sql.query('DELETE FROM evidence_changes WHERE id=$1', [id])), /permission denied/);
    await asRuntime(sql => sql.query("UPDATE evidence_changes SET response=response WHERE id=$1", [id]));
    assert.equal((await asRuntime(sql => sql.query('SELECT id FROM evidence_changes'), 'org_studio_north', DEMO_USER)).rows.length, 0, 'another community sees none');
    assert.equal((await asRuntime(sql => sql.query('SELECT id FROM evidence_changes'), '', '')).rows.length, 0, 'no tenant context, no rows');
    await assert.rejects(() => asRuntime(sql => sql.query("INSERT INTO evidence_changes(id,organization_id,created_at,subject,subject_id,kind,requested_by,reason,previous,proposed,previous_status,status,decided_by,decided_at,response) SELECT 'forged','org_studio_north',created_at,subject,subject_id,kind,requested_by,reason,previous,proposed,previous_status,status,decided_by,decided_at,response FROM evidence_changes WHERE id=$1", [id])), /row-level security/);
    for (const action of ['SELECT', 'INSERT']) assert.equal((await db.query<{ ok: boolean }>("SELECT has_table_privilege('reunir_app','evidence_changes',$1) AS ok", [action])).rows[0].ok, true, action);
    assert.equal((await db.query<{ ok: boolean }>("SELECT has_column_privilege('reunir_app','evidence_changes','status','UPDATE') AS ok")).rows[0].ok, true);
});

test('suspended members cannot change the history', async () => {
    await exec({ type: 'member.status', memberId: (await repo.snapshot('code-black', DEMO_ADMIN)).members.find(m => m.userId === 'member_sofia')!.id, status: 'suspended', reason: 'A reviewed test case.' }, DEMO_ADMIN);
    await assert.rejects(() => exec({ type: 'evidence.withdraw', subject: 'contribution', subjectId: 'contribution_notes', reason: 'Not while suspended.' }, 'member_sofia'), { code: 'NOT_FOUND' });
    assert.equal((await db.query<{ status: string }>("SELECT status FROM contributions WHERE organization_id=$1 AND id='contribution_notes'", [ORG])).rows[0].status, 'recognised');
});
