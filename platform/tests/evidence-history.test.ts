import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCommand, visibleWorkspace } from '../packages/domain/src/engine';
import { pathProgress } from '../packages/domain/src/purpose';
import { taskStage } from '../packages/domain/src/project-work';
import { historyOf } from '../packages/domain/src/evidence-history';
import { createSeed, DEMO_USER, DEMO_ADMIN } from '../packages/domain/src/seed';
import { DomainError, type Workspace, type TenantContext } from '../packages/contracts/src/index';

const OWNER = 'member_idris', OTHER = 'member_jordan';
const ctx = (userId = DEMO_USER, organizationId = 'org_code_black'): TenantContext => ({ userId, organizationId, requestId: 'evidence_test' });
const run = (command: unknown, s: Workspace, user = DEMO_USER) => applyCommand(s, ctx(user), command, () => '2026-10-03T10:00:00.000Z');
const error = (fn: () => unknown, code: string) => assert.throws(fn, (e: unknown) => e instanceof DomainError && e.code === code);
const text = { title: 'Tested the booking flow', text: 'Recorded three tasks and revised the confusing confirmation step.', evidenceUrl: 'https://example.com/proof' };
/** The wording as recognised, with the review that recognised it. */
const reviewed = { ...text, review: { reviewerId: OWNER, reviewedAt: '2026-10-03T10:00:00.000Z', feedback: 'Checked the notes.' } };
const corrected = { title: 'Tested the booking flow with three creators', text: 'Recorded three observed tasks and revised the confirmation step.', evidenceUrl: 'https://example.com/proof' };

/** Alex's contribution to Common Ground, recognised by the project owner. */
function recognised() {
    let s = run({ type: 'project.join', projectId: 'project_common' }, createSeed()).workspace;
    const c = run({ type: 'contribution.submit', projectId: 'project_common', title: text.title, body: text.text, evidenceUrl: text.evidenceUrl }, s);
    s = run({ type: 'contribution.review', contributionId: c.objectId, decision: 'recognised', feedback: 'Checked the notes.' }, c.workspace, OWNER).workspace;
    return { s, contributionId: c.objectId! };
}
/** ...with a verified outcome built on it, Alex's goal completed by that outcome, and the outcome published as an output. */
function chain() {
    const r = recognised();
    const o = run({ type: 'outcome.submit', purposeId: 'purpose_build', contributionId: r.contributionId, title: 'The booking flow works', summary: 'Three observed tasks informed a usable prototype.', evidenceUrl: '' }, r.s);
    let s = run({ type: 'outcome.review', outcomeId: o.objectId, decision: 'verified', feedback: 'Confirmed.' }, o.workspace, DEMO_ADMIN).workspace;
    s = run({ type: 'goal.status', goalId: 'goal_alex', status: 'completed', outcomeId: o.objectId }, s).workspace;
    s = run({ type: 'output.publish', outcomeId: o.objectId, kind: 'software' }, s, DEMO_ADMIN).workspace;
    return { s, contributionId: r.contributionId, outcomeId: o.objectId! };
}
const correct = (s: Workspace, subjectId: string, subject = 'contribution', user = DEMO_USER, wording = corrected) =>
    run({ type: 'evidence.correct', subject, subjectId, ...wording, reason: 'The first wording undercounted the testers.' }, s, user);
const review = (s: Workspace, changeId: string, decision: 'accepted' | 'declined', user = OWNER) =>
    run({ type: 'evidence.correction.review', changeId, decision, response: 'Checked against the notes.' }, s, user);
const withdraw = (s: Workspace, subjectId: string, subject = 'contribution', user = DEMO_USER) =>
    run({ type: 'evidence.withdraw', subject, subjectId, reason: 'The test notes belonged to another project.' }, s, user);

test('only the author can ask to correct reviewed evidence', () => {
    const { s, contributionId } = recognised();
    error(() => correct(s, contributionId, 'contribution', OTHER), 'FORBIDDEN');
    error(() => correct(s, contributionId, 'contribution', DEMO_ADMIN), 'FORBIDDEN');
    error(() => correct(s, contributionId, 'contribution', OWNER), 'FORBIDDEN');
});

test('a correction waits for review and leaves the reviewed wording in place until accepted', () => {
    const { s, contributionId } = recognised();
    const r = correct(s, contributionId);
    const c = r.workspace.contributions.find(x => x.id === contributionId)!;
    assert.deepEqual([c.title, c.body, c.status], [text.title, text.text, 'recognised']);
    const change = r.workspace.evidenceChanges.find(x => x.id === r.objectId)!;
    assert.deepEqual([change.kind, change.status, change.previous, change.proposed], ['correction', 'pending', reviewed, corrected]);
    assert(r.workspace.notifications.some(n => n.userId === OWNER && n.title === 'A correction to review'), 'the project owner is asked');
    assert(r.workspace.notifications.some(n => n.userId === DEMO_ADMIN && n.title === 'A correction to review'), 'administrators are asked');
    assert(!r.workspace.notifications.some(n => n.userId === DEMO_USER && n.title === 'A correction to review'), 'the author is not asked to review');
    const a = review(r.workspace, r.objectId!, 'accepted');
    const after = a.workspace.contributions.find(x => x.id === contributionId)!;
    assert.deepEqual([after.title, after.body, after.status, after.reviewerId], [corrected.title, corrected.text, 'recognised', OWNER]);
    const decided = a.workspace.evidenceChanges.find(x => x.id === r.objectId)!;
    assert.deepEqual([decided.status, decided.decidedBy, decided.previous], ['accepted', OWNER, reviewed], 'the earlier wording and its review stay in the history');
    assert(a.workspace.notifications.some(n => n.userId === DEMO_USER && n.title === 'Your correction was accepted'));
    assert(a.workspace.audit.some(x => x.action === 'evidence.correction.review' && x.objectId === r.objectId));
});

test('an accepted correction is attributed to the reviewer who accepted it, and the first review stays with the first wording', () => {
    const { s, contributionId } = recognised();
    const r = correct(s, contributionId);
    const a = run({ type: 'evidence.correction.review', changeId: r.objectId, decision: 'accepted', response: 'Matches the observation notes.' }, r.workspace, DEMO_ADMIN).workspace;
    const after = a.contributions.find(x => x.id === contributionId)!;
    assert.deepEqual([after.title, after.reviewerId, after.feedback], [corrected.title, DEMO_ADMIN, 'Matches the observation notes.']);
    assert.deepEqual(a.evidenceChanges.find(x => x.id === r.objectId)!.previous.review, reviewed.review);
});

test('a declined correction keeps the reviewed version', () => {
    const { s, contributionId } = recognised();
    const r = correct(s, contributionId);
    const d = review(r.workspace, r.objectId!, 'declined', DEMO_ADMIN);
    assert.equal(d.workspace.contributions.find(x => x.id === contributionId)!.title, text.title);
    assert.equal(d.workspace.evidenceChanges.find(x => x.id === r.objectId)!.status, 'declined');
    error(() => review(d.workspace, r.objectId!, 'accepted'), 'NOT_PENDING');
});

test('nobody reviews a correction to their own evidence, and ordinary members cannot review', () => {
    const { s, contributionId } = recognised();
    const r = correct(s, contributionId);
    error(() => review(r.workspace, r.objectId!, 'accepted', DEMO_USER), 'FORBIDDEN');
    error(() => review(r.workspace, r.objectId!, 'accepted', OTHER), 'NOT_FOUND');
    // Sofia owns Notes from the process and wrote its contribution: an administrator reviews her correction, not Sofia.
    const own = correct(createSeed(), 'contribution_notes', 'contribution', 'member_sofia');
    error(() => review(own.workspace, own.objectId!, 'accepted', 'member_sofia'), 'FORBIDDEN');
    assert(!own.workspace.notifications.some(n => n.userId === 'member_sofia' && n.title === 'A correction to review'));
    assert.equal(review(own.workspace, own.objectId!, 'accepted', DEMO_ADMIN).workspace.contributions.find(c => c.id === 'contribution_notes')!.title, corrected.title);
});

test('one correction waits at a time, and a correction must change something', () => {
    const { s, contributionId } = recognised();
    error(() => correct(s, contributionId, 'contribution', DEMO_USER, text), 'NO_CHANGE');
    const r = correct(s, contributionId);
    error(() => correct(r.workspace, contributionId, 'contribution', DEMO_USER, { ...corrected, title: 'Yet another wording' }), 'CORRECTION_PENDING');
    const d = review(r.workspace, r.objectId!, 'declined');
    assert.equal(correct(d.workspace, contributionId, 'contribution', DEMO_USER, { ...corrected, title: 'Yet another wording' }).workspace.evidenceChanges.length, 2);
});

test('the original length limits apply to a correction', () => {
    const { s, contributionId } = recognised();
    error(() => correct(s, contributionId, 'contribution', DEMO_USER, { ...corrected, title: 'x'.repeat(150) }), 'TOO_LONG');
});

test('only reviewed evidence is corrected or withdrawn', () => {
    let s = run({ type: 'project.join', projectId: 'project_common' }, createSeed()).workspace;
    const c = run({ type: 'contribution.submit', projectId: 'project_common', title: text.title, body: text.text, evidenceUrl: '' }, s);
    error(() => correct(c.workspace, c.objectId!), 'NOT_REVIEWED');
    error(() => withdraw(c.workspace, c.objectId!), 'NOT_REVIEWED');
    s = withdraw(createSeed(), 'contribution_notes', 'contribution', 'member_sofia').workspace;
    error(() => withdraw(s, 'contribution_notes', 'contribution', 'member_sofia'), 'NOT_REVIEWED');
    error(() => correct(s, 'contribution_notes', 'contribution', 'member_sofia'), 'NOT_REVIEWED');
});

test('withdrawing a contribution withdraws its outcomes, reopens the goal and stops counting everywhere', () => {
    const { s, contributionId, outcomeId } = chain();
    assert.equal(pathProgress(s, DEMO_USER, 'path_product').milestones.at(-1)!.done, true);
    const r = withdraw(s, contributionId);
    const w = r.workspace;
    assert.equal(w.contributions.find(c => c.id === contributionId)!.status, 'withdrawn');
    assert.equal(w.outcomes.find(o => o.id === outcomeId)!.status, 'withdrawn');
    const changes = w.evidenceChanges.filter(c => c.kind === 'withdrawal');
    assert.deepEqual(changes.map(c => [c.subject, c.previousStatus, c.status]), [['contribution', 'recognised', 'applied'], ['outcome', 'verified', 'applied']]);
    assert.equal(changes[0].previous.title, text.title, 'the reviewed wording is kept');
    const goal = w.memberGoals.find(g => g.id === 'goal_alex')!;
    assert.deepEqual([goal.status, goal.completedAt, goal.outcomeId], ['active', null, null]);
    assert.equal(pathProgress(w, DEMO_USER, 'path_product').milestones.at(-1)!.done, false, 'the project milestone no longer counts');
    assert.match(r.message, /1 outcome built on it/);
    for (const viewer of [DEMO_USER, OTHER, DEMO_ADMIN]) {
        const v = visibleWorkspace(w, ctx(viewer));
        assert(!v.communityOutputs.some(o => o.outcomeId === outcomeId), 'the output leaves the archive');
        assert.equal(v.contributions.find(c => c.id === contributionId)?.status, 'withdrawn', 'withdrawn evidence still shows, as withdrawn');
        assert.equal(v.evidenceChanges.filter(c => c.kind === 'withdrawal').length, 2, 'the withdrawal history is visible with the evidence');
    }
    assert(w.notifications.some(n => n.userId === OWNER && n.title === 'Evidence you reviewed was withdrawn'));
    error(() => run({ type: 'outcome.submit', purposeId: 'purpose_build', contributionId, title: 'Again', summary: 'Counted twice.' }, w), 'UNREVIEWED_SOURCE');
    error(() => run({ type: 'goal.status', goalId: 'goal_alex', status: 'completed', outcomeId }, w), 'UNVERIFIED_OUTCOME');
});

test('an administrator can withdraw an outcome; its author is told and the goal reopens', () => {
    const { s, outcomeId } = chain();
    error(() => withdraw(s, outcomeId, 'outcome', OTHER), 'FORBIDDEN');
    error(() => withdraw(s, outcomeId, 'outcome', OWNER), 'FORBIDDEN');
    const w = withdraw(s, outcomeId, 'outcome', DEMO_ADMIN).workspace;
    assert.equal(w.outcomes.find(o => o.id === outcomeId)!.status, 'withdrawn');
    assert.equal(w.memberGoals.find(g => g.id === 'goal_alex')!.status, 'active');
    assert(w.notifications.some(n => n.userId === DEMO_USER && n.title === 'Your evidence was withdrawn'));
    assert(w.notifications.some(n => n.userId === DEMO_USER && n.title === 'A goal is open again'));
    assert.equal(w.contributions.find(c => c.projectId === 'project_common' && c.userId === DEMO_USER)!.status, 'recognised', 'the contribution itself stays');
});

test('withdrawal closes a correction that was waiting', () => {
    const { s, contributionId } = recognised();
    const r = correct(s, contributionId);
    const w = withdraw(r.workspace, contributionId).workspace;
    assert.deepEqual([w.evidenceChanges.find(c => c.id === r.objectId)!.status, w.contributions.find(c => c.id === contributionId)!.title], ['declined', text.title]);
    assert.deepEqual(historyOf(w, contributionId).map(c => c.kind), ['correction', 'withdrawal']);
});

test('published outputs follow an accepted outcome correction', () => {
    const { s, outcomeId } = chain();
    const wording = { title: 'The booking flow works for first-time creators', text: 'Three observed tasks informed a usable prototype, tested again a week later.', evidenceUrl: 'https://example.com/result' };
    const r = correct(s, outcomeId, 'outcome', DEMO_USER, wording);
    error(() => review(r.workspace, r.objectId!, 'accepted', OWNER), 'NOT_FOUND');
    const a = review(r.workspace, r.objectId!, 'accepted', DEMO_ADMIN).workspace;
    const out = a.communityOutputs.find(o => o.outcomeId === outcomeId)!;
    assert.deepEqual([out.title, out.summary, out.evidenceUrl], [wording.title, wording.text, wording.evidenceUrl]);
    assert.equal(a.evidenceChanges.find(c => c.id === r.objectId)!.previous.title, 'The booking flow works');
});

test('pending corrections are seen only by the author and reviewers; decided ones by whoever sees the evidence', () => {
    const { s, contributionId } = recognised();
    const r = correct(s, contributionId);
    const sees = (w: Workspace, user: string) => visibleWorkspace(w, ctx(user)).evidenceChanges.some(c => c.id === r.objectId);
    assert.deepEqual([DEMO_USER, OWNER, DEMO_ADMIN, OTHER, 'member_maya'].map(u => sees(r.workspace, u)), [true, true, true, false, false]);
    const d = review(r.workspace, r.objectId!, 'declined');
    assert.deepEqual([DEMO_USER, OWNER, DEMO_ADMIN, OTHER, 'member_maya'].map(u => sees(d.workspace, u)), [true, true, true, true, true]);
    // An outcome correction is reviewed by administrators only, so a project owner does not see it while it waits.
    const c = chain();
    const o = correct(c.s, c.outcomeId, 'outcome', DEMO_USER, { title: 'A clearer result', text: 'Observed and measured.', evidenceUrl: '' });
    assert.deepEqual([DEMO_USER, DEMO_ADMIN, OWNER].map(u => visibleWorkspace(o.workspace, ctx(u)).evidenceChanges.some(x => x.id === o.objectId)), [true, true, false]);
});

test('history stays inside its community', () => {
    const { s, contributionId } = recognised();
    const foreign = structuredClone(s.contributions.find(c => c.id === contributionId)!);
    Object.assign(foreign, { id: 'contribution_foreign', organizationId: 'org_studio_north' });
    s.contributions.push(foreign);
    error(() => correct(s, 'contribution_foreign'), 'NOT_FOUND');
    error(() => withdraw(s, 'contribution_foreign', 'contribution', DEMO_ADMIN), 'NOT_FOUND');
    const r = correct(s, contributionId);
    const leaked = structuredClone(r.workspace.evidenceChanges[0]);
    Object.assign(leaked, { id: 'change_foreign', organizationId: 'org_studio_north' });
    r.workspace.evidenceChanges.push(leaked);
    error(() => review(r.workspace, 'change_foreign', 'accepted', DEMO_ADMIN), 'NOT_FOUND');
    assert(!visibleWorkspace(r.workspace, ctx(DEMO_ADMIN)).evidenceChanges.some(c => c.id === 'change_foreign'));
    // The other community's own state knows nothing of these records.
    error(() => applyCommand(createSeed('studio-north'), ctx(DEMO_USER, 'org_studio_north'), { type: 'evidence.withdraw', subject: 'contribution', subjectId: contributionId, reason: 'Not here.' }), 'NOT_FOUND');
});

test('suspended and former members cannot correct, withdraw or review', () => {
    const { s, contributionId } = recognised();
    const r = correct(s, contributionId);
    const suspend = (w: Workspace, userId: string, status: 'suspended' | 'left') => { const x = structuredClone(w); x.members.find(m => m.userId === userId)!.status = status; return x; };
    for (const status of ['suspended', 'left'] as const) {
        error(() => withdraw(suspend(s, DEMO_USER, status), contributionId), 'FORBIDDEN');
        error(() => correct(suspend(s, DEMO_USER, status), contributionId), 'FORBIDDEN');
        error(() => review(suspend(r.workspace, OWNER, status), r.objectId!, 'accepted'), 'FORBIDDEN');
        assert.throws(() => visibleWorkspace(suspend(r.workspace, OWNER, status), ctx(OWNER)), (e: unknown) => e instanceof DomainError && e.code === 'FORBIDDEN');
    }
    // A suspended project owner is not asked to review a new correction.
    const asked = correct(suspend(s, OWNER, 'suspended'), contributionId).workspace.notifications.filter(n => n.title === 'A correction to review').map(n => n.userId);
    assert(!asked.includes(OWNER));
});

test('a task whose proof was withdrawn is back in progress and takes new proof', () => {
    let s = createSeed();
    const t = s.projectTasks.find(x => x.id === 'task_test')!;
    s = run({ type: 'project.join', projectId: 'project_common' }, s).workspace;
    s = run({ type: 'task.move', taskId: t.id, expectedVersion: 1, workState: 'doing' }, s).workspace;
    s = run({ type: 'task.submit', taskId: t.id, expectedVersion: 2, body: 'Observed three tests.', evidenceUrl: '' }, s).workspace;
    const first = s.projectTasks.find(x => x.id === t.id)!.contributionId!;
    s = run({ type: 'contribution.review', contributionId: first, decision: 'recognised', feedback: 'Checked.' }, s, OWNER).workspace;
    assert.equal(taskStage(s, s.projectTasks.find(x => x.id === t.id)!), 'done');
    s = withdraw(s, first).workspace;
    const task = s.projectTasks.find(x => x.id === t.id)!;
    assert.equal(taskStage(s, task), 'doing');
    s = run({ type: 'task.submit', taskId: t.id, expectedVersion: task.version, body: 'Observed three new tests.', evidenceUrl: '' }, s).workspace;
    const second = s.projectTasks.find(x => x.id === t.id)!.contributionId!;
    assert.notEqual(second, first);
    assert.deepEqual([s.contributions.find(c => c.id === first)!.status, s.contributions.find(c => c.id === second)!.status], ['withdrawn', 'submitted']);
});

test('commands do not change their input and reject undeclared fields', () => {
    const { s, contributionId } = recognised();
    const before = JSON.stringify(s);
    withdraw(s, contributionId);
    correct(s, contributionId);
    assert.equal(JSON.stringify(s), before);
    assert.throws(() => run({ type: 'evidence.withdraw', subject: 'contribution', subjectId: contributionId, reason: 'x', status: 'recognised' }, s));
    assert.throws(() => run({ type: 'evidence.correction.review', changeId: 'x', decision: 'applied', response: 'x' }, s));
});

test('old browser state without a history still loads', () => {
    const s = createSeed() as Partial<Workspace>;
    delete s.evidenceChanges;
    assert.deepEqual(visibleWorkspace(s as Workspace, ctx()).evidenceChanges, []);
});
