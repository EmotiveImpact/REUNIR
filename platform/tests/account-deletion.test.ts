import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Workspace } from '../packages/contracts/src/index';
import { ACCOUNT_DELETION_PHRASE, FORMER_MEMBER, accountDeletionRequest, confirmsAccountDeletion } from '../packages/contracts/src/account';
import { actorFor, applyCommand, visibleWorkspace } from '../packages/domain/src/engine';
import { createSeed, DEMO_ADMIN, DEMO_USER } from '../packages/domain/src/seed';
import { PERSONAL_COLLECTIONS, eraseFromCommunity, isFormer } from '../packages/domain/src/account-deletion';

const ORG = 'org_code_black', NOW = '2026-10-03T12:00:00.000Z';
let seq = 0;
const ids = () => `deletion_${++seq}`;
const ctx = (userId = DEMO_USER) => ({ organizationId: ORG, userId, requestId: 'account-deletion-test' });
const run = (s: Workspace, cmd: unknown, user = DEMO_USER) => applyCommand(s, ctx(user), cmd, () => NOW, ids).workspace;
const alex = (s: Workspace) => s.members.find(m => m.userId === DEMO_USER)!;
const mine = (s: Workspace, key: typeof PERSONAL_COLLECTIONS[number]) => (s[key] as { userId: string }[]).filter(r => r.userId === DEMO_USER).length;

test('the confirmation is the typed phrase, and a password is required', () => {
    assert.equal(ACCOUNT_DELETION_PHRASE, 'delete my account');
    assert(confirmsAccountDeletion('  Delete my account ') && !confirmsAccountDeletion('delete') && !confirmsAccountDeletion('delete my account now'));
    assert.equal(accountDeletionRequest.safeParse({ password: 'x', confirmation: 'delete my account' }).success, true);
    assert.equal(accountDeletionRequest.safeParse({ password: '', confirmation: 'delete my account' }).success, false);
    assert.equal(accountDeletionRequest.safeParse({ password: 'x', confirmation: 'yes' }).success, false);
    assert.equal(accountDeletionRequest.safeParse({ password: 'x', confirmation: 'delete my account', extra: 1 }).success, false);
});

test('the membership is scrubbed to Former member, and posts, comments and project work stay', () => {
    const before = createSeed();
    const posts = before.posts.filter(p => p.authorId === DEMO_USER).length, comments = before.comments.filter(c => c.authorId === DEMO_USER).length;
    const { workspace: after, removed, memberId } = eraseFromCommunity(before, DEMO_USER, NOW, ids);
    const m = alex(after);
    assert.equal(m.id, memberId);
    assert.deepEqual({ name: m.name, headline: m.headline, bio: m.bio, skills: m.skills, avatar: m.avatar, role: m.role, status: m.status }, { name: FORMER_MEMBER, headline: '', bio: '', skills: [], avatar: '', role: 'member', status: 'left' });
    assert.equal(m.createdAt, alex(before).createdAt, 'the joining date and identifiers stay, so kept work still points at a membership');
    assert.equal(after.posts.filter(p => p.authorId === DEMO_USER).length, posts);
    assert.equal(after.comments.filter(c => c.authorId === DEMO_USER).length, comments);
    assert.ok(comments > 0, 'the seed has a comment by the person');
    assert.deepEqual(after.projectMembers.filter(x => x.userId === DEMO_USER), before.projectMembers.filter(x => x.userId === DEMO_USER), 'team places stay with the project work');
    for (const key of PERSONAL_COLLECTIONS) assert.equal(mine(after, key), 0, `${key} are removed`);
    assert.deepEqual(removed, { memberGoals: 1, bookmarks: 0, notifications: 2, reactions: 1, rsvps: 0, enrolments: 1, completions: 1, pathEnrolments: 1, quizAttempts: 0, reputation: 1, spaceMembers: 0, trackInstructors: 0, notificationPreferences: 0 });
    assert.equal(after.revision, before.revision + 1);
    const entry = after.audit.at(-1)!;
    assert.deepEqual([entry.action, entry.actorId, entry.objectId], ['member.account.deleted', DEMO_USER, memberId]);
    assert(!JSON.stringify(entry).includes('Alex'), 'the audit entry holds counts, never the name');
    assert.equal(before.members.find(x => x.userId === DEMO_USER)!.name, 'Alex Morgan', 'the input is not changed');
});

test('owners are refused, and nobody else is touched', () => {
    assert.throws(() => eraseFromCommunity(createSeed(), DEMO_ADMIN, NOW, ids), { code: 'OWNER_CANNOT_DELETE', message: /You own Code Black/ });
    assert.throws(() => eraseFromCommunity(createSeed(), 'someone_else', NOW, ids), { code: 'NOT_FOUND' });
    const { workspace } = eraseFromCommunity(createSeed(), DEMO_USER, NOW, ids), seed = createSeed();
    for (const m of workspace.members.filter(x => x.userId !== DEMO_USER)) assert.deepEqual(m, seed.members.find(x => x.id === m.id));
    assert.deepEqual(workspace.enrolments.filter(e => e.userId !== DEMO_USER), seed.enrolments.filter(e => e.userId !== DEMO_USER));
});

test('claimed tasks without proof return to the team; tasks with submitted proof keep their contributor', () => {
    let s = createSeed();
    const v = (id: string) => s.projectTasks.find(t => t.id === id)!.version;
    s = run(s, { type: 'task.move', taskId: 'task_test', expectedVersion: v('task_test'), workState: 'doing' });
    s = run(s, { type: 'task.submit', taskId: 'task_test', expectedVersion: v('task_test'), body: 'Observed three first-run sessions and recorded where people hesitated.' });
    const { workspace: after, releasedTasks } = eraseFromCommunity(s, DEMO_USER, NOW, ids);
    const t = (id: string) => after.projectTasks.find(x => x.id === id)!;
    assert.equal(releasedTasks, 1);
    assert.deepEqual([t('task_notes').assigneeId, t('task_notes').workState, t('task_notes').version], [null, 'todo', s.projectTasks.find(x => x.id === 'task_notes')!.version + 1]);
    assert.equal(t('task_test').assigneeId, DEMO_USER, 'proof under review keeps its contributor');
    assert.equal(after.contributions.filter(c => c.userId === DEMO_USER).length, 1, 'the contribution itself stays');
    assert.equal(t('task_flow').assigneeId, 'member_idris');
});

test('notices in other inboxes lose the name, unless another member shares it', () => {
    const s = run(createSeed(), { type: 'post.comment', postId: 'post_welcome', body: 'Thank you. Glad to be here.' });
    assert.equal(s.notifications.filter(n => n.userId === DEMO_ADMIN).at(-1)!.body, 'Alex Morgan replied to your post.');
    const { workspace, rewordedNotices } = eraseFromCommunity(s, DEMO_USER, NOW, ids);
    assert.equal(rewordedNotices, 1);
    assert.equal(workspace.notifications.filter(n => n.userId === DEMO_ADMIN).at(-1)!.body, 'A former member replied to your post.');
    const twin = structuredClone(s); twin.members.find(m => m.userId === 'member_jordan')!.name = 'Alex Morgan';
    const kept = eraseFromCommunity(twin, DEMO_USER, NOW, ids);
    assert.equal(kept.rewordedNotices, 0);
    assert.equal(kept.workspace.notifications.filter(n => n.userId === DEMO_ADMIN).at(-1)!.body, 'Alex Morgan replied to your post.', 'it could be about the other Alex Morgan');
    // A longer name that begins with theirs belongs to someone else.
    let longer = structuredClone(s); longer.members.find(m => m.userId === 'member_jordan')!.name = 'Alex Morgan Lee';
    longer = run(longer, { type: 'post.comment', postId: 'post_welcome', body: 'Welcome from me too.' }, 'member_jordan');
    const both = eraseFromCommunity(longer, DEMO_USER, NOW, ids).workspace.notifications.filter(n => n.userId === DEMO_ADMIN).map(n => n.body);
    assert(both.includes('A former member replied to your post.') && both.includes('Alex Morgan Lee replied to your post.'));
});

test('everyone sees the former member as Former member, and they get no new notices, points or access', () => {
    let s = run(createSeed(), { type: 'mission.submit', missionId: 'mission_prototype', body: 'A first version in two people’s hands, with notes on what they tried first.' });
    const submission = s.submissions.find(x => x.authorId === DEMO_USER)!;
    s = eraseFromCommunity(s, DEMO_USER, NOW, ids).workspace;
    assert(isFormer(s, DEMO_USER) && !isFormer(s, 'member_sofia'));
    for (const viewer of ['member_sofia', DEMO_ADMIN]) {
        const seen = visibleWorkspace(s, ctx(viewer)).members.find(m => m.userId === DEMO_USER);
        assert.deepEqual([seen?.name, seen?.status], [FORMER_MEMBER, 'left'], `${viewer} sees the kept record`);
    }
    const suspended = structuredClone(s); suspended.members.find(m => m.userId === 'member_theo')!.status = 'suspended';
    assert.equal(visibleWorkspace(suspended, ctx('member_sofia')).members.some(m => m.userId === 'member_theo'), false, 'suspended members stay hidden from members');
    assert.equal(visibleWorkspace(suspended, ctx(DEMO_ADMIN)).members.some(m => m.userId === 'member_theo'), true, 'administrators still see them');
    const reviewed = run(s, { type: 'submission.review', submissionId: submission.id, decision: 'approved', feedback: 'Clear evidence and a useful next step.' }, DEMO_ADMIN);
    assert.equal(reviewed.submissions.find(x => x.id === submission.id)!.status, 'approved', 'kept work can still be reviewed');
    assert.equal(reviewed.reputation.filter(r => r.userId === DEMO_USER).length, 0, 'no recognition points for a deleted account');
    assert.equal(reviewed.notifications.filter(n => n.userId === DEMO_USER).length, 0, 'no notices for a deleted account');
    const replied = run(s, { type: 'post.comment', postId: 'post_common', body: 'Picking this up while the first-run work continues.' }, 'member_jordan');
    assert.equal(replied.notifications.filter(n => n.userId === DEMO_USER).length, 0);
    assert.throws(() => actorFor(s, ctx()), { code: 'FORBIDDEN' });
    const memberId = alex(s).id;
    assert.throws(() => run(s, { type: 'member.status', memberId, status: 'active', reason: 'Restore please.' }, DEMO_ADMIN), { code: 'REJOIN_REQUIRED' });
    assert.throws(() => run(s, { type: 'member.role', memberId, role: 'admin' }, DEMO_ADMIN), { code: 'INACTIVE_MEMBER' });
    assert.throws(() => run(s, { type: 'track.instructor.add', trackId: 'track_product', userId: DEMO_USER }, DEMO_ADMIN), { code: 'MEMBER_UNAVAILABLE' });
});

test('erasing a membership that is already scrubbed changes nothing further', () => {
    const once = eraseFromCommunity(createSeed(), DEMO_USER, NOW, ids).workspace;
    const twice = eraseFromCommunity(once, DEMO_USER, NOW, ids);
    assert.deepEqual(Object.values(twice.removed).reduce((a, b) => a + b, 0), 0);
    assert.deepEqual([twice.releasedTasks, twice.rewordedNotices], [0, 0]);
    assert.deepEqual(alex(twice.workspace), alex(once));
});

test('a membership that left before account deletion existed reaches the browser only as Former member', () => {
    const s = createSeed(), legacy = alex(s);
    Object.assign(legacy, { status: 'left' });
    for (const viewer of ['member_sofia', DEMO_ADMIN]) {
        const seen = visibleWorkspace(s, ctx(viewer)).members.find(m => m.userId === DEMO_USER)!;
        assert.deepEqual({ name: seen.name, headline: seen.headline, bio: seen.bio, skills: seen.skills, avatar: seen.avatar, colour: seen.colour, role: seen.role, status: seen.status }, { name: FORMER_MEMBER, headline: '', bio: '', skills: [], avatar: '', colour: 'neutral', role: 'member', status: 'left' }, viewer);
        assert(!JSON.stringify(visibleWorkspace(s, ctx(viewer)).members).includes('Alex Morgan'));
    }
    assert.equal(legacy.name, 'Alex Morgan', 'the stored record is not rewritten by a read');
});
