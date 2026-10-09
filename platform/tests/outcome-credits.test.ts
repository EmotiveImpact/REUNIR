import { test } from 'node:test';
import assert from 'node:assert/strict';
import { commandSchema, type Workspace } from '../packages/contracts/src/index';
import { applyCommand, visibleWorkspace } from '../packages/domain/src/engine';
import { creditedOnOutcomes, outcomeCreditLine } from '../packages/domain/src/outcome-credits';
import { eraseFromCommunity } from '../packages/domain/src/account-deletion';
import { normalisePurposeState } from '../packages/domain/src/purpose';
import { createSeed, DEMO_ADMIN, DEMO_USER } from '../packages/domain/src/seed';

// Alpha 59: credits on outcomes, with consent (decision 059).
const ORG = 'org_code_black', NOW = '2026-10-09T12:00:00.000Z', IDRIS = 'member_idris', NIA = 'member_nia', SOFIA = 'member_sofia';
let seq = 0;
const ctx = (userId = DEMO_USER) => ({ organizationId: ORG, userId, requestId: 'outcome_credits_test' });
const exec = (s: Workspace, cmd: unknown, user = DEMO_USER) => applyCommand(s, ctx(user), cmd, () => NOW, () => `oc_${++seq}`);
const run = (s: Workspace, cmd: unknown, user = DEMO_USER) => exec(s, cmd, user).workspace;
const throwsCode = (fn: () => unknown, code: string) => assert.throws(fn, (e: { code?: string }) => e.code === code, code);
const memberId = (s: Workspace, userId: string) => s.members.find(m => m.userId === userId)!.id;
const seen = (s: Workspace, user: string) => visibleWorkspace(s, ctx(user));
/** Alex's recognised contribution on Common Ground (Idris is also on the team) supports an outcome waiting for review. */
function outcome(s = createSeed()) {
    const c = exec(s, { type: 'contribution.submit', projectId: 'project_common', title: 'Ran the first onboarding test', body: 'Observed three sessions with Idris.' });
    s = run(c.workspace, { type: 'contribution.review', contributionId: c.objectId, decision: 'recognised', feedback: 'Clear notes from three sessions.' }, DEMO_ADMIN);
    const o = exec(s, { type: 'outcome.submit', purposeId: 'purpose_build', contributionId: c.objectId, title: 'A clearer first-run experience', summary: 'Three observed sessions led to a simpler first screen.' });
    return { s: o.workspace, outcomeId: o.objectId! };
}
const invite = (s: Workspace, outcomeId: string, userId = IDRIS, by = DEMO_USER, role = 'co-author') => exec(s, { type: 'outcome.credit.invite', outcomeId, userId, role }, by);
const credit = (s: Workspace, id: string) => s.outcomeCredits.find(k => k.id === id)!;
/** The owner makes Idris an administrator, so the community has two people who can review outcomes. */
const twoAdmins = () => run(createSeed(), { type: 'member.role', memberId: memberId(createSeed(), IDRIS), role: 'admin' }, DEMO_ADMIN);

test('the outcome credit commands are strict', () => {
    assert.equal(commandSchema.safeParse({ type: 'outcome.credit.invite', outcomeId: 'o1', userId: IDRIS }).success, true);
    assert.equal(commandSchema.safeParse({ type: 'outcome.credit.invite', outcomeId: 'o1', userId: IDRIS, role: 'x'.repeat(61) }).success, false);
    assert.equal(commandSchema.safeParse({ type: 'outcome.credit.invite', outcomeId: 'o1', userId: IDRIS, status: 'accepted' }).success, false);
    assert.equal(commandSchema.safeParse({ type: 'outcome.credit.respond', creditId: 'k1', decision: 'withdrawn' }).success, false);
    assert.equal(commandSchema.safeParse({ type: 'outcome.credit.withdraw', creditId: 'k1' }).success, true);
    assert.deepEqual(normalisePurposeState({ ...createSeed(), outcomeCredits: undefined } as unknown as Workspace).outcomeCredits, []);
});

test('only the author invites, only a teammate on the outcome’s project, who may then read the outcome before review', () => {
    const { s: base, outcomeId } = outcome();
    throwsCode(() => invite(base, outcomeId, DEMO_USER), 'SELF_CREDIT');
    throwsCode(() => invite(base, outcomeId, SOFIA), 'INVALID_CREDIT');
    throwsCode(() => invite(base, outcomeId, DEMO_USER, IDRIS), 'AUTHOR_REQUIRED');
    throwsCode(() => invite(base, 'missing', IDRIS), 'NOT_FOUND');
    const r = invite(base, outcomeId);
    assert.match(r.message, /Idris Cole is credited only after accepting/);
    const s = r.workspace;
    assert.deepEqual([credit(s, r.objectId!).status, credit(s, r.objectId!).projectId, credit(s, r.objectId!).role], ['invited', 'project_common', 'co-author']);
    const notice = s.notifications.at(-1)!;
    assert.deepEqual([notice.userId, notice.title, notice.href], [IDRIS, 'You have been asked to share credit', '/outputs']);
    throwsCode(() => invite(s, outcomeId), 'ALREADY_CREDITED');
    // The invited person reads the outcome waiting for review; another member does not see it yet.
    assert.deepEqual(seen(s, IDRIS).outcomes.map(o => o.id).filter(id => id === outcomeId), [outcomeId]);
    assert.equal(seen(s, SOFIA).outcomes.some(o => o.id === outcomeId), false);
    // The invitation is between the two of them: an administrator sees the outcome but not the invitation.
    assert.equal(seen(s, DEMO_ADMIN).outcomes.some(o => o.id === outcomeId), true);
    assert.equal(seen(s, DEMO_ADMIN).outcomeCredits.some(k => k.id === r.objectId), false);
    assert.equal(seen(s, IDRIS).outcomeCredits.some(k => k.id === r.objectId), true);
});

test('an accepted credit shows on the outcome, its archived output and the profile, and is never evidence', () => {
    let { s, outcomeId } = outcome();
    const k = invite(s, outcomeId); s = k.workspace;
    const accepted = exec(s, { type: 'outcome.credit.respond', creditId: k.objectId, decision: 'accepted' }, IDRIS);
    assert.match(accepted.message, /shows on the outcome and your profile/);
    s = accepted.workspace;
    assert.deepEqual([s.notifications.at(-1)!.userId, s.notifications.at(-1)!.title], [DEMO_USER, 'Credit accepted']);
    const reputation = structuredClone(s.reputation), roles = s.members.map(m => m.role);
    s = run(s, { type: 'outcome.review', outcomeId, decision: 'verified', feedback: 'The notes support this.' }, DEMO_ADMIN);
    s = run(s, { type: 'output.publish', outcomeId, kind: 'software' }, DEMO_ADMIN);
    for (const viewer of [SOFIA, NIA, DEMO_ADMIN]) assert.equal(outcomeCreditLine(seen(s, viewer), outcomeId), 'With Idris Cole', viewer);
    assert.deepEqual(creditedOnOutcomes(seen(s, SOFIA), IDRIS).map(x => [x.outcome.id, x.credit.role]), [[outcomeId, 'co-author']]);
    // The seed's own credit reads on its archived output too.
    assert.equal(outcomeCreditLine(seen(s, SOFIA), 'outcome_notes'), 'With Nia James');
    // A credit is not the credited person's evidence: Idris cannot complete a goal with Alex's outcome.
    s = run(s, { type: 'goal.set', purposeId: 'purpose_build', title: 'Help ship a clearer first run.' }, IDRIS);
    const goal = s.memberGoals.find(g => g.userId === IDRIS)!;
    throwsCode(() => exec(s, { type: 'goal.status', goalId: goal.id, status: 'completed', outcomeId }, IDRIS), 'NOT_FOUND');
    assert.deepEqual([s.reputation, s.members.map(m => m.role)], [reputation, roles]);
});

test('someone credited cannot verify the outcome or decide a correction to it, and its reviewer cannot be credited', () => {
    let { s, outcomeId } = outcome(twoAdmins());
    const k = invite(s, outcomeId); s = k.workspace;
    s = run(s, { type: 'outcome.credit.respond', creditId: k.objectId, decision: 'accepted' }, IDRIS);
    throwsCode(() => exec(s, { type: 'outcome.review', outcomeId, decision: 'verified', feedback: 'Looks right.' }, IDRIS), 'FORBIDDEN');
    s = run(s, { type: 'outcome.review', outcomeId, decision: 'verified', feedback: 'The notes support this.' }, DEMO_ADMIN);
    s = run(s, { type: 'project.join', projectId: 'project_common' }, DEMO_ADMIN);
    throwsCode(() => invite(s, outcomeId, DEMO_ADMIN), 'REVIEWER_NOT_CREDITED');
    const corrected = exec(s, { type: 'evidence.correct', subject: 'outcome', subjectId: outcomeId, title: 'A clearer first-run experience', text: 'Three observed sessions led to a simpler first screen and a shorter form.', reason: 'Add the form change.' });
    s = corrected.workspace;
    throwsCode(() => exec(s, { type: 'evidence.correction.review', changeId: corrected.objectId, decision: 'accepted', response: 'Fine.' }, IDRIS), 'FORBIDDEN');
    s = run(s, { type: 'evidence.correction.review', changeId: corrected.objectId, decision: 'accepted', response: 'The form change is in the notes.' }, DEMO_ADMIN);
    assert.equal(s.outcomes.find(o => o.id === outcomeId)!.status, 'verified');
});

test('an invited administrator who reviewed the outcome cannot accept, and a refusal is not asked again', () => {
    let { s, outcomeId } = outcome(run(twoAdmins(), { type: 'project.join', projectId: 'project_common' }, DEMO_ADMIN));
    const asked = invite(s, outcomeId, DEMO_ADMIN); s = asked.workspace;
    s = run(s, { type: 'outcome.review', outcomeId, decision: 'verified', feedback: 'The notes support this.' }, DEMO_ADMIN);
    throwsCode(() => exec(s, { type: 'outcome.credit.respond', creditId: asked.objectId, decision: 'accepted' }, DEMO_ADMIN), 'REVIEWER_NOT_CREDITED');
    s = run(s, { type: 'outcome.credit.respond', creditId: asked.objectId, decision: 'declined' }, DEMO_ADMIN);
    const k = invite(s, outcomeId); s = k.workspace;
    s = run(s, { type: 'outcome.credit.respond', creditId: k.objectId, decision: 'declined' }, IDRIS);
    throwsCode(() => invite(s, outcomeId), 'CREDIT_REFUSED');
    throwsCode(() => exec(s, { type: 'outcome.credit.respond', creditId: k.objectId, decision: 'accepted' }, IDRIS), 'NOT_PENDING');
    assert.equal(seen(s, SOFIA).outcomeCredits.filter(x => x.outcomeId === outcomeId).length, 0, 'refusals are private to the two people');
});

test('either person withdraws; the author may ask again after withdrawing, and a withdrawn outcome takes no new credits', () => {
    let { s, outcomeId } = outcome();
    let k = invite(s, outcomeId); s = k.workspace;
    throwsCode(() => exec(s, { type: 'outcome.credit.withdraw', creditId: k.objectId }, IDRIS), 'NOT_LIVE');
    assert.equal(exec(s, { type: 'outcome.credit.withdraw', creditId: k.objectId }).message, 'Invitation withdrawn.');
    s = run(s, { type: 'outcome.credit.withdraw', creditId: k.objectId });
    k = invite(s, outcomeId); s = k.workspace;
    s = run(s, { type: 'outcome.credit.respond', creditId: k.objectId, decision: 'accepted' }, IDRIS);
    throwsCode(() => exec(s, { type: 'outcome.credit.withdraw', creditId: k.objectId }, SOFIA), 'NOT_FOUND');
    const removed = exec(s, { type: 'outcome.credit.withdraw', creditId: k.objectId }, IDRIS);
    assert.equal(removed.message, 'You are no longer credited on this outcome.');
    s = removed.workspace;
    assert.deepEqual([credit(s, k.objectId!).status, credit(s, k.objectId!).withdrawnBy], ['withdrawn', IDRIS]);
    assert.deepEqual([s.notifications.at(-1)!.userId, s.notifications.at(-1)!.title], [DEMO_USER, 'A credit was removed']);
    throwsCode(() => invite(s, outcomeId), 'CREDIT_REFUSED');
    s = run(s, { type: 'outcome.review', outcomeId, decision: 'verified', feedback: 'The notes support this.' }, DEMO_ADMIN);
    s = run(s, { type: 'evidence.withdraw', subject: 'outcome', subjectId: outcomeId, reason: 'The prototype was replaced.' });
    throwsCode(() => invite(s, outcomeId, NIA), 'OUTCOME_WITHDRAWN');
});

test('an outcome from a mission proof credits an active member who can see the mission, not only a project team', () => {
    let s = createSeed();
    const proof = exec(s, { type: 'mission.submit', missionId: 'mission_prototype', body: 'A first prototype, tested with two people.' });
    s = run(proof.workspace, { type: 'submission.review', submissionId: proof.objectId, decision: 'approved', feedback: 'A real first version.' }, DEMO_ADMIN);
    const o = exec(s, { type: 'outcome.submit', purposeId: 'purpose_build', submissionId: proof.objectId, title: 'A first prototype in use', summary: 'Two people used it for a week.' });
    s = o.workspace;
    const k = invite(s, o.objectId!, SOFIA, DEMO_USER, 'testing');
    assert.equal(credit(k.workspace, k.objectId!).projectId, null);
    s = run(s, { type: 'member.status', memberId: memberId(s, SOFIA), status: 'suspended', reason: 'A note for the audit trail.' }, DEMO_ADMIN);
    throwsCode(() => invite(s, o.objectId!, SOFIA), 'INVALID_CREDIT');
});

test('deleting an account removes the credits naming the person; credits they gave stay with their outcome', () => {
    let { s, outcomeId } = outcome();
    const k = invite(s, outcomeId); s = k.workspace;
    s = run(s, { type: 'outcome.credit.respond', creditId: k.objectId, decision: 'accepted' }, IDRIS);
    const idris = eraseFromCommunity(s, IDRIS, NOW, () => `erase_${++seq}`);
    assert.equal(idris.removed.outcomeCredits, 1);
    assert.equal(idris.workspace.outcomeCredits.some(x => x.id === k.objectId), false);
    const alex = eraseFromCommunity(s, DEMO_USER, NOW, () => `erase_${++seq}`);
    assert.equal(alex.removed.outcomeCredits, 0);
    assert.equal(alex.workspace.outcomeCredits.some(x => x.id === k.objectId), true);
    assert.equal(outcomeCreditLine(seen(alex.workspace, SOFIA), 'outcome_notes'), 'With Nia James');
});
