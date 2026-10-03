import { test } from 'node:test';
import assert from 'node:assert/strict';
import { commandSchema, type Workspace } from '../packages/contracts/src/index';
import { withNames } from '../packages/contracts/src/credits';
import { applyCommand, visibleWorkspace, reputationTotals } from '../packages/domain/src/engine';
import { pathProgress } from '../packages/domain/src/purpose';
import { creditLine, creditedOn } from '../packages/domain/src/credits';
import { eraseFromCommunity } from '../packages/domain/src/account-deletion';
import { normalisePurposeState } from '../packages/domain/src/purpose';
import { createSeed, DEMO_ADMIN, DEMO_USER } from '../packages/domain/src/seed';

const ORG = 'org_code_black', NOW = '2026-10-03T12:00:00.000Z', IDRIS = 'member_idris', NIA = 'member_nia', SOFIA = 'member_sofia', MAYA = 'member_maya';
let seq = 0;
const ctx = (userId = DEMO_USER, organizationId = ORG) => ({ organizationId, userId, requestId: 'credits_test' });
const exec = (s: Workspace, cmd: unknown, user = DEMO_USER) => applyCommand(s, ctx(user), cmd, () => NOW, () => `credit_${++seq}`);
const run = (s: Workspace, cmd: unknown, user = DEMO_USER) => exec(s, cmd, user).workspace;
const throwsCode = (fn: () => unknown, code: string) => assert.throws(fn, (e: { code?: string }) => e.code === code, code);
/** Alex records a contribution on Common Ground, where Idris is also on the team. */
function contributed() {
    const r = exec(createSeed(), { type: 'contribution.submit', projectId: 'project_common', title: 'Ran the first onboarding test', body: 'Observed three sessions with Idris and wrote up what changed.' });
    return { s: r.workspace, contributionId: r.objectId! };
}
function invited(role = 'co-author') {
    const { s, contributionId } = contributed();
    const r = exec(s, { type: 'credit.invite', contributionId, userId: IDRIS, role });
    return { s: r.workspace, contributionId, creditId: r.objectId! };
}
const credit = (s: Workspace, id: string) => s.contributionCredits.find(k => k.id === id)!;

test('the credit commands are strict, and the role is short and on one line', () => {
    assert.equal(commandSchema.safeParse({ type: 'credit.invite', contributionId: 'c1', userId: IDRIS }).success, true);
    assert.equal(commandSchema.safeParse({ type: 'credit.invite', contributionId: 'c1', userId: IDRIS, role: 'x'.repeat(61) }).success, false);
    assert.equal(commandSchema.safeParse({ type: 'credit.invite', contributionId: 'c1', userId: IDRIS, role: 'co-\nauthor' }).success, false);
    assert.equal(commandSchema.safeParse({ type: 'credit.invite', contributionId: 'c1', userId: IDRIS, status: 'accepted' }).success, false);
    assert.equal(commandSchema.safeParse({ type: 'credit.respond', creditId: 'k1', decision: 'withdrawn' }).success, false);
    assert.equal(commandSchema.safeParse({ type: 'credit.withdraw', creditId: 'k1' }).success, true);
    assert.deepEqual([withNames([]), withNames(['Nia']), withNames(['Nia', 'Theo']), withNames(['Nia', 'Theo', 'Maya'])], ['', 'With Nia', 'With Nia and Theo', 'With Nia, Theo and Maya']);
});

test('the author invites a teammate, who is notified and alone with the author in seeing it', () => {
    const { s, creditId, contributionId } = invited();
    const k = credit(s, creditId);
    assert.deepEqual([k.userId, k.invitedBy, k.role, k.status, k.projectId, k.respondedAt], [IDRIS, DEMO_USER, 'co-author', 'invited', 'project_common', null]);
    const notice = s.notifications.at(-1)!;
    assert.deepEqual([notice.userId, notice.href], [IDRIS, '/projects/project_common']);
    assert.match(notice.body, /^Alex Morgan would like to credit you on “Ran the first onboarding test”/);
    assert.equal(visibleWorkspace(s, ctx(IDRIS)).contributionCredits.filter(x => x.id === creditId).length, 1, 'the invitee sees it');
    assert(visibleWorkspace(s, ctx(IDRIS)).contributions.some(c => c.id === contributionId), 'and can read the contribution to decide');
    assert.equal(visibleWorkspace(s, ctx(DEMO_USER)).contributionCredits.filter(x => x.id === creditId).length, 1, 'the author sees it');
    for (const other of [DEMO_ADMIN, NIA, SOFIA]) assert(!visibleWorkspace(s, ctx(other)).contributionCredits.some(x => x.id === creditId), `${other} does not`);
    assert.equal(creditLine(visibleWorkspace(s, ctx(DEMO_USER)), contributionId), '', 'nothing shows on the contribution yet');
});

test('only the author invites, and only active members of the project team who are not the author', () => {
    const { s, contributionId } = contributed();
    throwsCode(() => exec(s, { type: 'credit.invite', contributionId, userId: DEMO_USER }, IDRIS), 'AUTHOR_REQUIRED');
    throwsCode(() => exec(s, { type: 'credit.invite', contributionId, userId: IDRIS }, DEMO_ADMIN), 'AUTHOR_REQUIRED');
    throwsCode(() => exec(s, { type: 'credit.invite', contributionId, userId: DEMO_USER }), 'SELF_CREDIT');
    throwsCode(() => exec(s, { type: 'credit.invite', contributionId, userId: NIA }), 'INVALID_CREDIT');
    throwsCode(() => exec(s, { type: 'credit.invite', contributionId, userId: 'nobody' }), 'INVALID_CREDIT');
    const suspended = structuredClone(s); suspended.members.find(m => m.userId === IDRIS)!.status = 'suspended';
    throwsCode(() => exec(suspended, { type: 'credit.invite', contributionId, userId: IDRIS }), 'INVALID_CREDIT');
    throwsCode(() => exec(s, { type: 'credit.invite', contributionId: 'contribution_missing', userId: IDRIS }), 'NOT_FOUND');
});

test('no duplicate live credit, and a refusal is not asked again', () => {
    const { s, contributionId, creditId } = invited();
    throwsCode(() => exec(s, { type: 'credit.invite', contributionId, userId: IDRIS }), 'ALREADY_CREDITED');
    const declined = run(s, { type: 'credit.respond', creditId, decision: 'declined' }, IDRIS);
    throwsCode(() => exec(declined, { type: 'credit.invite', contributionId, userId: IDRIS }), 'CREDIT_REFUSED');
    const accepted = run(s, { type: 'credit.respond', creditId, decision: 'accepted' }, IDRIS);
    throwsCode(() => exec(accepted, { type: 'credit.invite', contributionId, userId: IDRIS }), 'ALREADY_CREDITED');
    const removedByThem = run(accepted, { type: 'credit.withdraw', creditId }, IDRIS);
    throwsCode(() => exec(removedByThem, { type: 'credit.invite', contributionId, userId: IDRIS }), 'CREDIT_REFUSED');
    // When the author withdrew, the author may ask again.
    const withdrawn = run(s, { type: 'credit.withdraw', creditId });
    assert.equal(exec(withdrawn, { type: 'credit.invite', contributionId, userId: IDRIS }).workspace.contributionCredits.filter(k => k.status === 'invited').length, 1);
});

test('at most ten people are credited on one contribution', () => {
    let { s, contributionId } = contributed();
    for (let i = 0; i < 11; i++) {
        const userId = `member_extra_${i}`;
        s.members.push({ ...s.members.find(m => m.userId === IDRIS)!, id: `m_extra_${i}`, userId, name: `Extra ${i}` });
        s.projectMembers.push({ id: `pm_extra_${i}`, organizationId: ORG, createdAt: NOW, projectId: 'project_common', userId });
    }
    for (let i = 0; i < 10; i++) s = run(s, { type: 'credit.invite', contributionId, userId: `member_extra_${i}` });
    throwsCode(() => exec(s, { type: 'credit.invite', contributionId, userId: 'member_extra_10' }), 'CREDIT_LIMIT');
});

test('accepting shows the credit on the contribution and the profile, and notifies the author', () => {
    const { s, creditId, contributionId } = invited();
    throwsCode(() => exec(s, { type: 'credit.respond', creditId, decision: 'accepted' }), 'NOT_FOUND');
    throwsCode(() => exec(s, { type: 'credit.respond', creditId, decision: 'accepted' }, DEMO_ADMIN), 'NOT_FOUND');
    const after = run(s, { type: 'credit.respond', creditId, decision: 'accepted' }, IDRIS);
    assert.deepEqual([credit(after, creditId).status, credit(after, creditId).respondedAt], ['accepted', NOW]);
    const notice = after.notifications.at(-1)!;
    assert.deepEqual([notice.userId, notice.title, notice.body], [DEMO_USER, 'Credit accepted', 'Idris Cole accepted the credit on “Ran the first onboarding test”.']);
    assert.equal(creditLine(visibleWorkspace(after, ctx(DEMO_USER)), contributionId), 'With Idris Cole');
    assert.deepEqual(creditedOn(visibleWorkspace(after, ctx(IDRIS)), IDRIS).map(x => x.contribution.id), [contributionId]);
    throwsCode(() => exec(after, { type: 'credit.respond', creditId, decision: 'declined' }, IDRIS), 'NOT_PENDING');
});

test('a declined credit stays between the two people and shows nowhere', () => {
    const { s, creditId, contributionId } = invited();
    const after = run(s, { type: 'credit.respond', creditId, decision: 'declined' }, IDRIS);
    assert.equal(after.notifications.at(-1)!.title, 'Credit declined');
    assert.equal(creditLine(visibleWorkspace(after, ctx(DEMO_USER)), contributionId), '');
    assert.deepEqual(creditedOn(visibleWorkspace(after, ctx(IDRIS)), IDRIS), []);
    assert(!visibleWorkspace(after, ctx(DEMO_ADMIN)).contributionCredits.some(k => k.id === creditId));
});

test('either person withdraws an accepted credit; the invitee declines rather than withdraws an invitation', () => {
    const { s, creditId } = invited();
    throwsCode(() => exec(s, { type: 'credit.withdraw', creditId }, IDRIS), 'NOT_LIVE');
    throwsCode(() => exec(s, { type: 'credit.withdraw', creditId }, DEMO_ADMIN), 'NOT_FOUND');
    const accepted = run(s, { type: 'credit.respond', creditId, decision: 'accepted' }, IDRIS);
    const byAuthor = run(accepted, { type: 'credit.withdraw', creditId });
    assert.deepEqual([credit(byAuthor, creditId).status, credit(byAuthor, creditId).withdrawnBy, credit(byAuthor, creditId).withdrawnAt], ['withdrawn', DEMO_USER, NOW]);
    assert.equal(byAuthor.notifications.at(-1)!.userId, IDRIS);
    const byThem = run(accepted, { type: 'credit.withdraw', creditId }, IDRIS);
    assert.equal(credit(byThem, creditId).withdrawnBy, IDRIS);
    throwsCode(() => exec(byThem, { type: 'credit.withdraw', creditId }), 'NOT_LIVE');
    const invitationWithdrawn = run(s, { type: 'credit.withdraw', creditId });
    assert.equal(credit(invitationWithdrawn, creditId).status, 'withdrawn');
    throwsCode(() => exec(invitationWithdrawn, { type: 'credit.respond', creditId, decision: 'accepted' }, IDRIS), 'NOT_PENDING');
});

test('credits never count toward paths, recognition, reputation or outcomes', () => {
    // Nia accepted a credit on Sofia's recognised contribution in the seed.
    const seed = createSeed();
    assert.equal(seed.contributionCredits[0].status, 'accepted');
    const nia = seed.members.find(m => m.userId === NIA)!;
    const notesMilestone = { id: 'm', organizationId: ORG, createdAt: NOW, pathId: 'p', title: 't', description: '', position: 1, lessonId: null, missionId: null, projectId: 'project_notes' };
    seed.milestones.push(notesMilestone); seed.paths.push({ id: 'p', organizationId: ORG, createdAt: NOW, purposeId: 'purpose_build', spaceId: null, title: 'P', summary: 'S', status: 'published' });
    assert.equal(pathProgress(seed, nia.userId, 'p').completed, 0, 'a credit is not a recognised contribution by the credited person');
    assert.equal(pathProgress(seed, SOFIA, 'p').completed, 1, 'the author’s recognised contribution still counts for the author');
    assert.deepEqual(reputationTotals(seed, NIA), reputationTotals(createSeed(), NIA));
    // A credited person cannot record an outcome from someone else's contribution.
    throwsCode(() => exec(seed, { type: 'outcome.submit', purposeId: 'purpose_build', submissionId: null, contributionId: 'contribution_notes', title: 'Mine', summary: 'Not mine.' }, NIA), 'NOT_FOUND');
    // Accepting adds no reputation, and recognition is still only about the contribution and its author.
    const { s: inv, creditId } = invited();
    const accepted = run(inv, { type: 'credit.respond', creditId, decision: 'accepted' }, IDRIS);
    assert.deepEqual(accepted.reputation, inv.reputation);
    assert.equal(accepted.members.find(m => m.userId === IDRIS)!.role, 'member');
    // A person sharing the credit does not review the work; another reviewer does, and the review is about the contribution.
    const contributionId = credit(accepted, creditId).contributionId;
    assert.throws(() => exec(accepted, { type: 'contribution.review', contributionId, decision: 'recognised', feedback: 'Looks good.' }, IDRIS), (e: { code?: string; message?: string }) => e.code === 'FORBIDDEN' && /credited/.test(e.message ?? ''));
    const reviewed = run(accepted, { type: 'contribution.review', contributionId, decision: 'recognised', feedback: 'Clear evidence.' }, DEMO_ADMIN);
    assert.equal(pathProgress(reviewed, IDRIS, 'path_product').completed, pathProgress(accepted, IDRIS, 'path_product').completed, 'recognition counts for the author only');
    assert.deepEqual(reviewed.reputation, accepted.reputation);
});

test('a suspended member can neither invite nor answer, and their accepted credit is hidden from members', () => {
    const { s, creditId, contributionId } = invited();
    const accepted = run(s, { type: 'credit.respond', creditId, decision: 'accepted' }, IDRIS);
    const suspendedInvitee = structuredClone(s); suspendedInvitee.members.find(m => m.userId === IDRIS)!.status = 'suspended';
    throwsCode(() => exec(suspendedInvitee, { type: 'credit.respond', creditId, decision: 'accepted' }, IDRIS), 'FORBIDDEN');
    const suspendedAuthor = structuredClone(s); suspendedAuthor.members.find(m => m.userId === DEMO_USER)!.status = 'suspended';
    throwsCode(() => exec(suspendedAuthor, { type: 'credit.withdraw', creditId }), 'FORBIDDEN');
    const hidden = structuredClone(accepted); hidden.members.find(m => m.userId === IDRIS)!.status = 'suspended';
    assert.equal(creditLine(visibleWorkspace(hidden, ctx(MAYA)), contributionId), '', 'members do not see a suspended member’s credit');
    assert.equal(creditLine(visibleWorkspace(hidden, ctx(DEMO_ADMIN)), contributionId), 'With Idris Cole', 'administrators, who see suspended members, do');
});

test('deleting an account removes the person’s credits; the author’s contribution and other credits stay', () => {
    const { s, creditId, contributionId } = invited();
    const accepted = run(s, { type: 'credit.respond', creditId, decision: 'accepted' }, IDRIS);
    const erased = eraseFromCommunity(accepted, IDRIS, NOW);
    assert.equal(erased.removed.contributionCredits, 1);
    assert.equal(erased.workspace.contributionCredits.filter(k => k.userId === IDRIS).length, 0);
    assert(erased.workspace.contributions.some(c => c.id === contributionId));
    assert.equal(erased.workspace.contributionCredits.filter(k => k.userId === NIA).length, 1, 'Nia’s credit on another contribution stays');
    // The author's deletion keeps their contribution as Former member and the credits they gave, which belong to others.
    const authorGone = eraseFromCommunity(accepted, DEMO_USER, NOW).workspace;
    assert.equal(authorGone.contributionCredits.find(k => k.id === creditId)!.status, 'accepted');
    // Nobody can invite on a former member's contribution, and responses to them send no notices.
    const pending = eraseFromCommunity(s, DEMO_USER, NOW).workspace;
    const before = pending.notifications.length;
    assert.equal(run(pending, { type: 'credit.respond', creditId, decision: 'accepted' }, IDRIS).notifications.length, before);
});

test('a reviewer is never also credited, and a credited person never reviews a correction', () => {
    // Idris owns Common Ground and recognises Alex's contribution: he cannot then be credited on it.
    const { s, contributionId } = contributed();
    const reviewed = run(s, { type: 'contribution.review', contributionId, decision: 'recognised', feedback: 'Seen.' }, IDRIS);
    throwsCode(() => exec(reviewed, { type: 'credit.invite', contributionId, userId: IDRIS, role: '' }), 'REVIEWER_NOT_CREDITED');
    // Invited first and reviewing before answering: accepting is refused, declining still works.
    const i = invited();
    const later = run(i.s, { type: 'contribution.review', contributionId: i.contributionId, decision: 'recognised', feedback: 'Seen.' }, IDRIS);
    throwsCode(() => exec(later, { type: 'credit.respond', creditId: i.creditId, decision: 'accepted' }, IDRIS), 'REVIEWER_NOT_CREDITED');
    assert.equal(credit(run(later, { type: 'credit.respond', creditId: i.creditId, decision: 'declined' }, IDRIS), i.creditId).status, 'declined');
    // Credited, then recognised by an administrator: a correction is decided by someone other than Idris.
    let t = run(i.s, { type: 'credit.respond', creditId: i.creditId, decision: 'accepted' }, IDRIS);
    t = run(t, { type: 'contribution.review', contributionId: i.contributionId, decision: 'recognised', feedback: 'Seen.' }, DEMO_ADMIN);
    const asked = exec(t, { type: 'evidence.correct', subject: 'contribution', subjectId: i.contributionId, title: 'Ran the first two onboarding tests', text: 'Observed five sessions with Idris.', evidenceUrl: '', reason: 'Two more sessions.' });
    throwsCode(() => exec(asked.workspace, { type: 'evidence.correction.review', changeId: asked.objectId, decision: 'accepted', response: 'Looks right.' }, IDRIS), 'FORBIDDEN');
    const decided = run(asked.workspace, { type: 'evidence.correction.review', changeId: asked.objectId, decision: 'accepted', response: 'Fine.' }, DEMO_ADMIN);
    assert.equal(decided.contributions.find(c => c.id === i.contributionId)!.reviewerId, DEMO_ADMIN);
    // Whoever decided a correction cannot be credited afterwards either.
    const joined = run(decided, { type: 'project.join', projectId: 'project_common' }, DEMO_ADMIN);
    throwsCode(() => exec(joined, { type: 'credit.invite', contributionId: i.contributionId, userId: DEMO_ADMIN, role: '' }), 'REVIEWER_NOT_CREDITED');
});

test('credits stay inside their community', () => {
    const { s, creditId } = invited();
    const north = createSeed('studio-north');
    north.contributionCredits.push(credit(s, creditId));
    assert(!visibleWorkspace(north, ctx(IDRIS, 'org_studio_north')).contributionCredits.some(k => k.id === creditId));
    throwsCode(() => exec(north, { type: 'credit.respond', creditId, decision: 'accepted' }, IDRIS), 'NOT_FOUND');
    throwsCode(() => applyCommand(north, ctx(IDRIS, 'org_studio_north'), { type: 'credit.respond', creditId, decision: 'accepted' }), 'NOT_FOUND');
});

test('an older browser state without credits gains an empty list', () => {
    const s = createSeed() as Partial<Workspace>; delete s.contributionCredits;
    assert.deepEqual(normalisePurposeState(s as Workspace).contributionCredits, []);
});
