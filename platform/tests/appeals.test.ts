import { test } from 'node:test';
import assert from 'node:assert/strict';
import { commandSchema, type Workspace } from '../packages/contracts/src/index';
import { noticeTopic } from '../packages/contracts/src/notifications';
import { applyCommand, visibleRecords } from '../packages/domain/src/engine';
import { appealDeciders, decisionBlock, mayDecide } from '../packages/domain/src/appeals';
import { reliesOnAdministration } from '../packages/domain/src/administration';
import { eraseFromCommunity } from '../packages/domain/src/account-deletion';
import { createSeed, DEMO_ADMIN, DEMO_USER } from '../packages/domain/src/seed';

const ORG = 'org_code_black', NOW = '2026-10-03T12:00:00.000Z', LATER = '2026-10-04T12:00:00.000Z';
const MAYA = 'member_maya', JORDAN = 'member_jordan', THEO = 'member_theo', SEEDED = 'post_hidden_alex';
let seq = 0;
const ctx = (userId: string, organizationId = ORG) => ({ organizationId, userId, requestId: 'appeals_test' });
const exec = (s: Workspace, cmd: unknown, user: string, at = NOW) => applyCommand(s, ctx(user), cmd, () => at, () => `appeal_${++seq}`);
const run = (s: Workspace, cmd: unknown, user: string, at = NOW) => exec(s, cmd, user, at).workspace;
const throwsCode = (fn: () => unknown, code: string) => assert.throws(fn, (e: { code?: string }) => e.code === code, code);
const member = (s: Workspace, userId: string) => s.members.find(m => m.userId === userId && m.organizationId === ORG)!;
const withRole = (s: Workspace, userId: string, role: 'admin' | 'member' | 'moderator' | 'owner') => { const c = structuredClone(s); member(c, userId).role = role; return c; };
const appeal = (s: Workspace, user = DEMO_USER, postId = SEEDED, reason = 'It was a one-off post to members I know.') => exec(s, { type: 'moderation.appeal', postId, reason }, user);
const decide = (s: Workspace, appealId: string, user: string, decision: 'upheld' | 'reversed', response = 'Thank you for asking. We looked again.') =>
    exec(s, { type: 'moderation.appeal.decide', appealId, decision, response }, user);
const post = (s: Workspace, id = SEEDED) => s.posts.find(p => p.id === id)!;
const notices = (s: Workspace, user: string) => s.notifications.filter(n => n.userId === user);

test('the commands are validated: a reason and a response are required, and decisions are upheld or reversed only', () => {
    assert.equal(commandSchema.safeParse({ type: 'moderation.appeal', postId: SEEDED, reason: '   ' }).success, false);
    assert.equal(commandSchema.safeParse({ type: 'moderation.appeal', postId: SEEDED, reason: 'x'.repeat(2001) }).success, false);
    assert.equal(commandSchema.safeParse({ type: 'moderation.appeal.decide', appealId: 'a', decision: 'withdrawn', response: 'No' }).success, false);
    assert.equal(commandSchema.safeParse({ type: 'moderation.appeal.decide', appealId: 'a', decision: 'reversed', response: '' }).success, false);
    assert.equal(commandSchema.safeParse({ type: 'moderation.appeal.withdraw', appealId: 'a', extra: 1 }).success, false);
});

test('hiding records who moderated and when, tells the author, and the author alone still sees the post', () => {
    let s = createSeed();
    s = run(s, { type: 'post.moderate', postId: 'post_win', hidden: true }, MAYA);
    assert.deepEqual([post(s, 'post_win').hidden, post(s, 'post_win').moderatedBy, post(s, 'post_win').moderatedAt], [true, MAYA, NOW]);
    const notice = notices(s, 'member_nia').at(-1)!;
    assert.equal(notice.title, 'Your post was hidden');
    assert.equal(notice.href, '/appeals');
    assert.equal(noticeTopic(notice.href), 'community', 'moderation of your own work always arrives');
    assert(visibleRecords(s, ctx('member_nia')).posts.some(p => p.id === 'post_win'), 'the author still sees it');
    assert(!visibleRecords(s, ctx(JORDAN)).posts.some(p => p.id === 'post_win'), 'other members do not');
    assert(visibleRecords(s, ctx(MAYA)).posts.some(p => p.id === 'post_win'), 'moderators do');
    // The author cannot keep the conversation going on a hidden post.
    throwsCode(() => run(s, { type: 'post.comment', postId: 'post_win', body: 'Still here?' }, 'member_nia'), 'NOT_FOUND');
    // Restoring records the restorer; hiding again is recorded again.
    s = run(s, { type: 'post.moderate', postId: 'post_win', hidden: false }, DEMO_ADMIN, LATER);
    assert.deepEqual([post(s, 'post_win').hidden, post(s, 'post_win').moderatedBy, post(s, 'post_win').moderatedAt], [false, DEMO_ADMIN, LATER]);
    // A moderator hiding their own post is not told about it.
    const before = notices(s, MAYA).length;
    s = run(s, { type: 'post.moderate', postId: 'post_maya', hidden: true }, MAYA);
    assert.equal(notices(s, MAYA).length, before);
});

test('only the author appeals, only a hidden post, and only while an active member', () => {
    const s = createSeed();
    throwsCode(() => appeal(s, JORDAN), 'NOT_FOUND');
    throwsCode(() => appeal(s, MAYA), 'NOT_AUTHOR');
    throwsCode(() => appeal(s, DEMO_ADMIN), 'NOT_AUTHOR');
    throwsCode(() => appeal(s, 'member_nia', 'post_win'), 'NOT_HIDDEN');
    throwsCode(() => appeal(s, DEMO_USER, 'post_missing'), 'NOT_FOUND');
    const suspended = structuredClone(s); member(suspended, DEMO_USER).status = 'suspended';
    throwsCode(() => appeal(suspended), 'FORBIDDEN');
    const former = structuredClone(s); member(former, DEMO_USER).status = 'left';
    throwsCode(() => appeal(former), 'FORBIDDEN');
    const r = appeal(s);
    const a = r.workspace.moderationAppeals.find(x => x.id === r.objectId)!;
    assert.deepEqual([a.subject, a.subjectId, a.appellantId, a.status, a.decidedBy, a.decidedAt, a.response], ['post', SEEDED, DEMO_USER, 'pending', null, null, '']);
    assert.equal(r.workspace.audit.at(-1)!.action, 'moderation.appeal');
});

test('one open appeal per item; withdrawing allows another, a decision closes that hiding', () => {
    let s = createSeed();
    let r = appeal(s); s = r.workspace; const first = r.objectId!;
    throwsCode(() => appeal(s), 'APPEAL_OPEN');
    throwsCode(() => run(s, { type: 'moderation.appeal.withdraw', appealId: first }, DEMO_ADMIN), 'NOT_APPELLANT');
    r = exec(s, { type: 'moderation.appeal.withdraw', appealId: first }, DEMO_USER); s = r.workspace;
    assert.deepEqual([s.moderationAppeals[0].status, s.moderationAppeals[0].decidedBy, s.moderationAppeals[0].decidedAt], ['withdrawn', null, NOW]);
    assert(post(s).hidden, 'withdrawing leaves the post hidden');
    throwsCode(() => run(s, { type: 'moderation.appeal.withdraw', appealId: first }, DEMO_USER), 'NOT_PENDING');
    r = appeal(s); s = r.workspace;
    s = decide(s, r.objectId!, DEMO_ADMIN, 'upheld').workspace;
    throwsCode(() => appeal(s), 'APPEAL_DECIDED');
    throwsCode(() => decide(s, r.objectId!, DEMO_ADMIN, 'reversed'), 'NOT_PENDING');
    // Restored by a moderator and hidden again later: that new hiding can be appealed.
    s = run(s, { type: 'post.moderate', postId: SEEDED, hidden: false }, MAYA, LATER);
    s = run(s, { type: 'post.moderate', postId: SEEDED, hidden: true }, MAYA, '2026-10-05T12:00:00.000Z');
    assert.equal(appeal(s, DEMO_USER, SEEDED, 'Hidden a second time.').workspace.moderationAppeals.filter(a => a.status === 'pending').length, 1);
});

test('an owner or administrator who is neither moderator nor appellant decides, and is notified of the appeal', () => {
    const s = createSeed();
    const r = appeal(s), a = r.workspace.moderationAppeals[0];
    assert.deepEqual(appealDeciders(r.workspace, a).map(m => m.userId), [DEMO_ADMIN]);
    assert.equal(notices(r.workspace, DEMO_ADMIN).at(-1)!.title, 'An appeal to decide');
    assert.equal(notices(r.workspace, DEMO_ADMIN).at(-1)!.href, '/appeals');
    assert.equal(notices(r.workspace, MAYA).length, notices(s, MAYA).length, 'the moderator is not asked to judge their own decision');
    assert.equal(notices(r.workspace, JORDAN).length, notices(s, JORDAN).length, 'members are not told');
    // A moderator and an ordinary member cannot even see the appeal to decide it.
    throwsCode(() => decide(r.workspace, a.id, MAYA, 'reversed'), 'NOT_FOUND');
    throwsCode(() => decide(r.workspace, a.id, JORDAN, 'reversed'), 'NOT_FOUND');
    // A moderator who is also an administrator still cannot decide an appeal about their own hiding.
    const mayaAdmin = withRole(r.workspace, MAYA, 'admin');
    assert.equal(mayDecide(mayaAdmin, member(mayaAdmin, MAYA), a), false);
    assert.equal(decisionBlock(mayaAdmin, member(mayaAdmin, MAYA), a), 'You hid this post, so another owner or administrator decides.');
    throwsCode(() => decide(mayaAdmin, a.id, MAYA, 'reversed'), 'MODERATOR_CANNOT_DECIDE');
    assert.equal(decisionBlock(r.workspace, member(r.workspace, DEMO_ADMIN), a), null);
});

test('when the moderator is the only administrator the appeal waits, and nobody else is asked', () => {
    let s = run(createSeed(), { type: 'post.moderate', postId: 'post_win', hidden: true }, DEMO_ADMIN);
    const r = appeal(s, 'member_nia', 'post_win');
    assert.match(r.message, /Nobody can decide it yet/);
    const a = r.workspace.moderationAppeals[0];
    assert.deepEqual(appealDeciders(r.workspace, a), []);
    assert.equal(r.workspace.notifications.length, s.notifications.length, 'no notices: nobody may decide');
    throwsCode(() => decide(r.workspace, a.id, DEMO_ADMIN, 'reversed'), 'MODERATOR_CANNOT_DECIDE');
    // A newly appointed administrator can decide it.
    s = withRole(r.workspace, JORDAN, 'admin');
    assert.deepEqual(appealDeciders(s, a).map(m => m.userId), [JORDAN]);
    assert.equal(decide(s, a.id, JORDAN, 'reversed').workspace.posts.find(p => p.id === 'post_win')!.hidden, false);
});

test('the appellant cannot decide their own appeal, even as an administrator', () => {
    let s = withRole(createSeed(), DEMO_USER, 'admin');
    s = appeal(s).workspace;
    const a = s.moderationAppeals[0];
    assert.equal(mayDecide(s, member(s, DEMO_USER), a), false);
    throwsCode(() => decide(s, a.id, DEMO_USER, 'reversed'), 'SELF_DECISION');
    assert.deepEqual(appealDeciders(s, a).map(m => m.userId), [DEMO_ADMIN]);
});

test('an inactive administrator cannot decide', () => {
    let s = withRole(createSeed(), JORDAN, 'admin');
    s = appeal(s).workspace;
    const a = s.moderationAppeals[0];
    member(s, JORDAN).status = 'suspended';
    assert.deepEqual(appealDeciders(s, a).map(m => m.userId), [DEMO_ADMIN]);
    throwsCode(() => decide(s, a.id, JORDAN, 'reversed'), 'FORBIDDEN');
    member(s, JORDAN).status = 'left';
    throwsCode(() => decide(s, a.id, JORDAN, 'reversed'), 'FORBIDDEN');
});

test('reversal restores the post, is audited and tells the appellant; upholding keeps it hidden', () => {
    let s = appeal(createSeed()).workspace;
    const a = s.moderationAppeals[0];
    const r = decide(s, a.id, DEMO_ADMIN, 'reversed', 'Selling to friends is fine here. Restored.');
    s = r.workspace;
    const closed = s.moderationAppeals[0];
    assert.deepEqual([closed.status, closed.decidedBy, closed.decidedAt, closed.response], ['reversed', DEMO_ADMIN, NOW, 'Selling to friends is fine here. Restored.']);
    assert.equal(post(s).hidden, false);
    assert.equal(post(s).moderatedBy, MAYA, 'who hid it stays on the post; the appeal records who restored it');
    assert.deepEqual(s.audit.slice(-2).map(x => [x.action, x.objectId]), [['moderation.appeal.reversed', a.id], ['post.restored', SEEDED]]);
    const notice = notices(s, DEMO_USER).at(-1)!;
    assert.deepEqual([notice.title, notice.body, notice.href], ['Your post is visible again', 'Selling to friends is fine here. Restored.', '/appeals']);
    assert(visibleRecords(s, ctx(JORDAN)).posts.some(p => p.id === SEEDED), 'members see it again');

    let u = appeal(createSeed()).workspace;
    u = decide(u, u.moderationAppeals[0].id, DEMO_ADMIN, 'upheld', 'Sales posts belong elsewhere.').workspace;
    assert.equal(post(u).hidden, true);
    assert.equal(u.moderationAppeals[0].status, 'upheld');
    assert.equal(u.audit.at(-1)!.action, 'moderation.appeal.upheld');
    assert.deepEqual([notices(u, DEMO_USER).at(-1)!.title, notices(u, DEMO_USER).at(-1)!.body], ['Your post stays hidden', 'Sales posts belong elsewhere.']);
});

test('a post restored while its appeal waited cannot be kept hidden by the appeal, but the appeal can be closed', () => {
    let s = appeal(createSeed()).workspace;
    const a = s.moderationAppeals[0];
    s = run(s, { type: 'post.moderate', postId: SEEDED, hidden: false }, MAYA);
    throwsCode(() => decide(s, a.id, DEMO_ADMIN, 'upheld'), 'ALREADY_RESTORED');
    s = decide(s, a.id, DEMO_ADMIN, 'reversed').workspace;
    assert.equal(s.moderationAppeals[0].status, 'reversed');
    assert.notEqual(s.audit.at(-1)!.action, 'post.restored', 'nothing was restored by the decision');
});

test('appeals are private to the appellant and the owners and administrators, and are never community activity', () => {
    const s0 = createSeed();
    const s = appeal(s0).workspace;
    assert.equal(visibleRecords(s, ctx(DEMO_USER)).moderationAppeals.length, 1);
    assert.equal(visibleRecords(s, ctx(DEMO_ADMIN)).moderationAppeals.length, 1);
    assert.equal(visibleRecords(s, ctx(MAYA)).moderationAppeals.length, 0, 'moderators who are not administrators do not see appeals');
    assert.equal(visibleRecords(s, ctx(JORDAN)).moderationAppeals.length, 0);
    assert.equal(s.posts.length, s0.posts.length);
    assert.equal(s.comments.length, s0.comments.length);
    assert(!JSON.stringify(visibleRecords(s, ctx(JORDAN))).includes('one-off post to members I know'), 'the reason never reaches other members');
    assert.equal(visibleRecords(s, ctx(JORDAN)).outbox.length, 0);
});

test('cross-tenant: another community neither sees nor acts on an appeal', () => {
    const s = appeal(createSeed()).workspace;
    const a = s.moderationAppeals[0];
    throwsCode(() => applyCommand(s, ctx(DEMO_ADMIN, 'org_studio_north'), { type: 'moderation.appeal.decide', appealId: a.id, decision: 'reversed', response: 'From elsewhere.' }), 'NOT_FOUND');
    // An appeal row stamped with another community is invisible here and cannot be decided or withdrawn here.
    const mixed = structuredClone(s);
    mixed.moderationAppeals.push({ ...a, id: 'foreign_appeal', organizationId: 'org_studio_north' });
    assert.deepEqual(visibleRecords(mixed, ctx(DEMO_ADMIN)).moderationAppeals.map(x => x.id), [a.id]);
    throwsCode(() => decide(mixed, 'foreign_appeal', DEMO_ADMIN, 'reversed'), 'NOT_FOUND');
    throwsCode(() => run(mixed, { type: 'moderation.appeal.withdraw', appealId: 'foreign_appeal' }, DEMO_USER), 'NOT_FOUND');
    // Studio North has no hidden post of Alex's to appeal.
    const north = createSeed('studio-north');
    throwsCode(() => applyCommand(north, ctx(DEMO_USER, 'org_studio_north'), { type: 'moderation.appeal', postId: SEEDED, reason: 'Wrong place.' }), 'NOT_FOUND');
});

test('deciding needs owner or administrator authority; appealing and withdrawing do not', () => {
    const s = withRole(appeal(createSeed()).workspace, DEMO_USER, 'admin');
    const a = s.moderationAppeals[0];
    assert.equal(reliesOnAdministration(s, ctx(DEMO_ADMIN), { type: 'moderation.appeal.decide', appealId: a.id, decision: 'reversed', response: 'Restored.' }), true);
    assert.equal(reliesOnAdministration(s, ctx(DEMO_USER), { type: 'moderation.appeal.withdraw', appealId: a.id }), false);
});

test('deleting the appellant’s account removes their appeals and keeps the decision in the audit trail', () => {
    let s = appeal(createSeed()).workspace;
    s = decide(s, s.moderationAppeals[0].id, DEMO_ADMIN, 'upheld').workspace;
    const { workspace, removed } = eraseFromCommunity(s, DEMO_USER, LATER, () => `erase_${++seq}`);
    assert.equal(removed.moderationAppeals, 1);
    assert.equal(workspace.moderationAppeals.length, 0);
    assert(workspace.audit.some(x => x.action === 'moderation.appeal.upheld'));
    assert(workspace.posts.some(p => p.id === SEEDED && p.hidden), 'the post stays, still hidden');
});
