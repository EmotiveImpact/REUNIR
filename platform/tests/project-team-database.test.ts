import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { openDatabase, type Database } from '../packages/db/src/connection';
import { migrate } from '../packages/db/src/migrate';
import { WorkspaceRepository, setContext } from '../packages/db/src/repository';
import { grantRuntimeTables } from '../packages/db/src/runtime-role';
import { createSeed, DEMO_ADMIN, DEMO_USER } from '../packages/domain/src/seed';

// Alpha 54: leaving a project team, and removal by its lead or an administrator, under the restricted runtime role.
let db: Database, repo: WorkspaceRepository;
const ORG = 'org_code_black', LEAD = 'member_idris', PROJECT = 'project_common';
const run = (user: string, cmd: unknown, slug = 'code-black') => repo.execute(slug, user, cmd, randomUUID(), 'project-team-db');
const row = async (userId: string, projectId = PROJECT) => (await db.query<{ left_at: Date | null; removed_by: string | null }>('SELECT left_at,removed_by FROM project_members WHERE organization_id=$1 AND project_id=$2 AND user_id=$3', [ORG, projectId, userId])).rows[0];
/** What row security itself admits to this person, without the domain rules. */
const tasksAdmitted = (userId: string) => db.transaction(async sql => {
    await sql.query('SET LOCAL ROLE reunir_app'); await setContext(sql, ORG, userId);
    return (await sql.query<{ n: number }>('SELECT count(*)::int AS n FROM project_tasks WHERE project_id=$1', [PROJECT])).rows[0].n;
});

before(async () => {
    db = await openDatabase('pglite:memory'); await migrate(db);
    const owner = new WorkspaceRepository(db); await owner.seed(createSeed()); await owner.seed(createSeed('studio-north'));
    await db.query('CREATE ROLE reunir_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS');
    await db.transaction(grantRuntimeTables);
    const runtime = Object.create(db) as Database;
    runtime.transaction = fn => db.transaction(async tx => { await tx.query('SET LOCAL ROLE reunir_app'); return fn(tx); });
    repo = new WorkspaceRepository(runtime);
});
after(async () => db?.close());

test('leaving hands claimed tasks back, keeps the row, and row security stops admitting the person', async () => {
    assert(await tasksAdmitted(DEMO_USER) > 0);
    const left = await run(DEMO_USER, { type: 'project.leave', projectId: PROJECT });
    assert.match(left.message, /claimed tasks are back with the team/);
    assert.equal((await db.query("SELECT count(*)::int AS n FROM project_tasks WHERE organization_id=$1 AND assignee_id=$2", [ORG, DEMO_USER])).rows[0].n, 0, 'released under their own name before the membership ended');
    const mine = await row(DEMO_USER);
    assert(mine.left_at && mine.removed_by === null, 'the row stays, marked as ended');
    assert.equal(await tasksAdmitted(DEMO_USER), 0);
    const alex = await repo.snapshot('code-black', DEMO_USER);
    assert(!alex.projectMembers.some(x => x.projectId === PROJECT && x.userId === DEMO_USER) && !alex.projectTasks.some(t => t.projectId === PROJECT));
    await assert.rejects(run(DEMO_USER, { type: 'task.claim', taskId: 'task_empty', expectedVersion: 1 }), { code: 'NOT_FOUND' });
    assert((await repo.snapshot('code-black', LEAD)).notifications.some(n => n.title === 'Someone left your team'));
    await run(DEMO_USER, { type: 'project.join', projectId: PROJECT });
    assert.equal((await row(DEMO_USER)).left_at, null, 'someone who left by choice may come back');
    assert(await tasksAdmitted(DEMO_USER) > 0);
});

test('the lead removes someone, who cannot rejoin until the lead lets them back', async () => {
    await assert.rejects(run(DEMO_USER, { type: 'project.member.remove', projectId: PROJECT, userId: LEAD }), { code: 'PROJECT_LEAD_REQUIRED' });
    await assert.rejects(run(LEAD, { type: 'project.leave', projectId: PROJECT }), { code: 'PROJECT_LEAD_STAYS' });
    await assert.rejects(run(DEMO_ADMIN, { type: 'project.member.remove', projectId: PROJECT, userId: LEAD }), { code: 'PROJECT_LEAD_STAYS' });
    await run(LEAD, { type: 'project.member.remove', projectId: PROJECT, userId: DEMO_USER });
    assert.equal((await row(DEMO_USER)).removed_by, LEAD);
    await assert.rejects(run(DEMO_USER, { type: 'project.join', projectId: PROJECT }), { code: 'REMOVED_FROM_TEAM' });
    assert((await repo.snapshot('code-black', DEMO_USER)).notifications.some(n => n.title === 'You are no longer on a project team'));
    assert((await repo.snapshot('code-black', LEAD)).projectMembers.some(x => x.userId === DEMO_USER && x.projectId === PROJECT && x.removedBy === LEAD), 'the lead sees whom they removed');
    assert(!(await repo.snapshot('code-black', 'member_maya')).projectMembers.some(x => x.userId === DEMO_USER && x.projectId === PROJECT), 'nobody else does');
    await assert.rejects(run(LEAD, { type: 'project.member.restore', projectId: PROJECT, userId: DEMO_USER }, 'studio-north'), 'never from another community');
    await run(LEAD, { type: 'project.member.restore', projectId: PROJECT, userId: DEMO_USER });
    assert.deepEqual(await row(DEMO_USER), { left_at: null, removed_by: null });
});

test('someone named on recognised work can leave, and their credit and work stay', async () => {
    await run('member_nia', { type: 'project.leave', projectId: 'project_notes' });
    assert((await row('member_nia', 'project_notes')).left_at);
    assert.equal((await db.query("SELECT count(*)::int AS n FROM contribution_credits WHERE organization_id=$1 AND user_id='member_nia' AND status='accepted'", [ORG])).rows[0].n, 1);
});

test('the runtime role can only end or resume a membership, never move it', async () => {
    await assert.rejects(db.transaction(async sql => {
        await sql.query('SET LOCAL ROLE reunir_app'); await setContext(sql, ORG, LEAD);
        await sql.query("UPDATE project_members SET project_id='project_still' WHERE organization_id=$1 AND user_id=$2", [ORG, DEMO_USER]);
    }), /permission denied/);
});
