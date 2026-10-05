import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSeed, DEMO_ADMIN, DEMO_USER } from '../packages/domain/src/seed';
import { visibleRecords, visibleWorkspace } from '../packages/domain/src/engine';
import { itemOf, pageOf, listItems } from '../packages/domain/src/pages';
import { AUDIT_WINDOW, NOTIFICATION_WINDOW, POST_WINDOW, cursorFor, pageQuery, readCursor } from '../packages/contracts/src/pages';
import type { Workspace } from '../packages/contracts/src/index';

const ORG = 'org_code_black';
const ctx = (userId: string) => ({ organizationId: ORG, userId, requestId: 'pages-test' });
const at = (n: number) => new Date(Date.UTC(2026, 8, 1) + n * 60000).toISOString();
/** A community with many notices for Alex, some for Amina, a long audit trail and many waiting answers. */
function busy(): Workspace {
    const s = createSeed();
    for (let i = 0; i < 75; i++) s.notifications.push({ id: `n_${String(i).padStart(3, '0')}`, organizationId: ORG, createdAt: at(i), userId: DEMO_USER, title: `Notice ${i}`, body: 'Body', href: '/home', readAt: i % 3 ? at(i) : null });
    for (let i = 0; i < 5; i++) s.notifications.push({ id: `amina_${i}`, organizationId: ORG, createdAt: at(i), userId: DEMO_ADMIN, title: `For Amina ${i}`, body: 'Body', href: '/home', readAt: null });
    for (let i = 0; i < 40; i++) s.audit.push({ id: `a_${String(i).padStart(3, '0')}`, organizationId: ORG, createdAt: at(i), actorId: DEMO_ADMIN, action: 'test.action', objectId: 'x', metadata: {} });
    const template = s.quizAttempts.find(a => a.id === 'attempt_sofia')!;
    for (let i = 0; i < 45; i++) s.quizAttempts.push({ ...structuredClone(template), id: `wait_${String(i).padStart(3, '0')}`, createdAt: at(i), userId: 'member_sofia', attemptNumber: i + 2 });
    return s;
}

test('cursors are opaque keyset positions; anything else is refused', () => {
    const c = cursorFor({ createdAt: '2026-09-01T00:00:00.000Z', id: 'n_001' });
    assert.match(c, /^[A-Za-z0-9_-]+$/);
    assert.deepEqual(readCursor(c), { createdAt: '2026-09-01T00:00:00.000Z', id: 'n_001' });
    for (const bad of ['', 'abc', cursorFor({ createdAt: 'not a date', id: 'x' }), cursorFor({ createdAt: '2026-09-01T00:00:00.000Z', id: '../x' })]) assert.equal(readCursor(bad), null, bad);
    assert.throws(() => pageQuery.parse({ limit: 51 }));
    assert.throws(() => pageQuery.parse({ cursor: 'a/b' }));
    assert.throws(() => pageQuery.parse({ offset: 20 }), 'no offsets');
    assert.equal(pageQuery.parse({}).limit, 20);
    assert.throws(() => pageOf(visibleRecords(busy(), ctx(DEMO_USER)), ctx(DEMO_USER), 'notifications', { cursor: 'abc' }), { code: 'INVALID_CURSOR' });
});

test('notices page newest first, exactly once each, and items added meanwhile never shift a page', () => {
    let s = busy();
    const first = pageOf(visibleRecords(s, ctx(DEMO_USER)), ctx(DEMO_USER), 'notifications');
    assert.equal(first.total, 75 + createSeed().notifications.filter(n => n.userId === DEMO_USER).length);
    assert.equal(first.items.length, 20);
    assert(first.items.every((n, i, all) => i === 0 || Date.parse(all[i - 1].createdAt) >= Date.parse(n.createdAt)), 'newest first');
    assert(first.items.every(n => n.userId === DEMO_USER), 'only their own notices');
    // A new notice arrives between pages: the next page continues after the last one shown.
    s.notifications.push({ id: 'n_new', organizationId: ORG, createdAt: at(500), userId: DEMO_USER, title: 'New', body: 'B', href: '/', readAt: null });
    const seen = new Set(first.items.map(n => n.id));
    let cursor = first.nextCursor;
    while (cursor) {
        const next = pageOf(visibleRecords(s, ctx(DEMO_USER)), ctx(DEMO_USER), 'notifications', { cursor });
        for (const n of next.items) { assert(!seen.has(n.id), 'no repeats'); seen.add(n.id); }
        cursor = next.nextCursor;
    }
    assert.equal(seen.size, first.total, 'every notice once, the new one waiting at the top for the next reload');
    assert(!seen.has('n_new'));
});

test('the review queue pages waiting answers oldest first, only on taught tracks and never the reviewer’s own', () => {
    const s = busy(), view = visibleRecords(s, ctx(DEMO_ADMIN));
    const waiting = pageOf(view, ctx(DEMO_ADMIN), 'review-waiting');
    assert.equal(waiting.total, 46, 'the seeded answer and 45 more');
    assert.equal(waiting.items[0].id, 'wait_000', 'oldest first');
    const second = pageOf(view, ctx(DEMO_ADMIN), 'review-waiting', { cursor: waiting.nextCursor! });
    assert.equal(second.items[0].id, 'wait_020');
    assert.deepEqual(pageOf(visibleRecords(s, ctx(DEMO_USER)), ctx(DEMO_USER), 'review-waiting'), { items: [], total: 0, nextCursor: null }, 'a member reviews nothing');
    assert.equal(pageOf(visibleRecords(s, ctx('member_sofia')), ctx('member_sofia'), 'review-waiting').total, 0, 'never your own');
    assert.equal(listItems(view, ctx(DEMO_ADMIN), 'review-scored').every(a => a.status === 'scored'), true);
});

test('the snapshot carries recent notices and audit entries and only the person’s own attempts, with exact totals', () => {
    const s = busy();
    const alex = visibleWorkspace(s, ctx(DEMO_USER)), amina = visibleWorkspace(s, ctx(DEMO_ADMIN));
    assert.equal(alex.notifications.length, NOTIFICATION_WINDOW);
    assert.equal(alex.summary!.notifications, pageOf(visibleRecords(s, ctx(DEMO_USER)), ctx(DEMO_USER), 'notifications').total);
    assert.equal(alex.summary!.unreadNotifications, visibleRecords(s, ctx(DEMO_USER)).notifications.filter(n => !n.readAt).length, 'unread counts every notice, not only the window');
    assert(alex.notifications.every(n => n.userId === DEMO_USER));
    assert.equal(alex.audit.length, 0, 'members see no audit');
    assert.equal(amina.audit.length, AUDIT_WINDOW);
    assert.deepEqual(amina.quizAttempts.filter(a => a.userId !== DEMO_ADMIN), [], 'reviewers page other people’s attempts');
    assert.deepEqual([amina.summary!.review.waiting, amina.summary!.waitingByTrack.track_product], [46, 46]);
    assert.throws(() => pageOf(visibleRecords(s, ctx(DEMO_USER)), ctx(DEMO_USER), 'audit'), { code: 'FORBIDDEN' });
    const audit = pageOf(visibleRecords(s, ctx(DEMO_ADMIN)), ctx(DEMO_ADMIN), 'audit', { limit: 50 });
    assert.equal(audit.items[0].id, amina.audit.at(-1)!.id, 'the snapshot window is the newest end of the trail');
});

/** A busy conversation: many posts across two spaces, one pinned old post, a private-space post and archived tasks. */
function chatty(): Workspace {
    const s = createSeed();
    for (let i = 0; i < 70; i++) s.posts.push({ id: `p_${String(i).padStart(3, '0')}`, organizationId: ORG, createdAt: at(i), spaceId: i % 2 ? 'space_build' : 'space_general', authorId: 'member_maya', kind: i % 5 ? 'update' : 'resource', title: `Post ${i}`, body: 'Body', pinned: false, hidden: false, cover: '' });
    s.posts.push({ id: 'p_pinned_old', organizationId: ORG, createdAt: at(-10), spaceId: 'space_general', authorId: DEMO_ADMIN, kind: 'update', title: 'Pinned', body: 'B', pinned: true, hidden: false, cover: '' });
    s.posts.push({ id: 'p_studio', organizationId: ORG, createdAt: at(200), spaceId: 'space_studio', authorId: DEMO_ADMIN, kind: 'update', title: 'Team only', body: 'B', pinned: false, hidden: false, cover: '' });
    s.posts.push({ id: 'p_hidden_mine', organizationId: ORG, createdAt: at(-20), spaceId: 'space_general', authorId: DEMO_USER, kind: 'update', title: 'Mine, hidden', body: 'B', pinned: false, hidden: true, cover: '' });
    s.comments.push({ id: 'c_old', organizationId: ORG, createdAt: at(3), postId: 'p_002', authorId: DEMO_USER, body: 'An old reply' });
    s.reactions.push({ id: 'r_old', organizationId: ORG, createdAt: at(3), postId: 'p_002', userId: DEMO_USER });
    s.bookmarks.push({ id: 'b_old', organizationId: ORG, createdAt: at(3), postId: 'p_002', userId: DEMO_USER }, { id: 'b_amina', organizationId: ORG, createdAt: at(3), postId: 'p_004', userId: DEMO_ADMIN });
    const task = s.projectTasks.find(t => t.id === 'task_empty')!;
    for (let i = 0; i < 25; i++) s.projectTasks.push({ ...structuredClone(task), id: `t_${String(i).padStart(3, '0')}`, createdAt: at(i), archived: true });
    s.taskNotes.push({ id: 'note_archived', organizationId: ORG, createdAt: at(1), projectId: 'project_common', taskId: 't_001', authorId: DEMO_USER, body: 'Kept with the task', hidden: false });
    return s;
}

test('the snapshot carries a window of posts plus pinned, own hidden and named ones, with replies only for those', () => {
    const s = chatty(), alex = visibleWorkspace(s, ctx(DEMO_USER)), all = visibleRecords(s, ctx(DEMO_USER));
    const window = new Set([...all.posts].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, POST_WINDOW).map(p => p.id));
    assert(alex.posts.length < all.posts.length, 'shortened');
    for (const id of window) assert(alex.posts.some(p => p.id === id), `window keeps ${id}`);
    assert(alex.posts.some(p => p.id === 'p_pinned_old'), 'pinned posts always travel');
    assert(alex.posts.some(p => p.id === 'p_hidden_mine'), 'the author keeps their hidden post, to appeal');
    assert(!alex.posts.some(p => p.id === 'p_studio'), 'never a post from a space they cannot see');
    const kept = new Set(alex.posts.map(p => p.id));
    assert(alex.comments.every(c => kept.has(c.postId)) && alex.reactions.every(r => kept.has(r.postId)) && alex.bookmarks.every(b => kept.has(b.postId)));
    assert.equal(alex.summary!.posts, all.posts.filter(p => !p.hidden).length, 'the exact count of visible posts');
});

test('feeds page every unpinned post newest first, by space, kind or saved, with the records each needs', () => {
    const s = chatty(), view = visibleRecords(s, ctx(DEMO_USER));
    const seen: string[] = [];
    let page = pageOf(view, ctx(DEMO_USER), 'posts');
    const total = page.total;
    assert.equal(total, view.posts.filter(p => !p.pinned).length);
    for (;;) { seen.push(...page.items.map(p => p.id)); if (!page.nextCursor) break; page = pageOf(view, ctx(DEMO_USER), 'posts', { cursor: page.nextCursor }); }
    assert.equal(new Set(seen).size, total, 'every post once');
    assert(!seen.includes('p_pinned_old') && !seen.includes('p_studio'));
    assert(seen.includes('p_hidden_mine'), 'their own hidden post, as on its page');
    const build = pageOf(view, ctx(DEMO_USER), 'posts', { space: 'space_build', limit: 50 });
    assert(build.items.every(p => p.spaceId === 'space_build'));
    assert(pageOf(view, ctx(DEMO_USER), 'posts', { kind: 'resource', limit: 50 }).items.every(p => p.kind === 'resource'));
    const saved = pageOf(view, ctx(DEMO_USER), 'posts', { saved: '1' });
    assert.deepEqual(saved.items.map(p => p.id), ['p_002'], 'only what they saved, never someone else’s bookmark');
    assert.deepEqual(saved.records?.comments?.map(c => c.id), ['c_old']);
    assert.deepEqual(saved.records?.reactions?.map(r => r.id), ['r_old']);
    assert.deepEqual(saved.records?.bookmarks?.map(b => b.id), ['b_old']);
    const amina = pageOf(visibleRecords(s, ctx(DEMO_ADMIN)), ctx(DEMO_ADMIN), 'posts', { limit: 50 });
    assert(amina.items.some(p => p.id === 'p_studio'), 'the community team sees its private space');
    assert(!amina.records?.bookmarks?.some(b => b.userId !== DEMO_ADMIN), 'bookmarks are private');
});

test('a post outside the window is read alone with every reply, and a hidden or private one is not found', () => {
    const s = chatty(), view = visibleRecords(s, ctx(DEMO_USER));
    const old = itemOf(view, ctx(DEMO_USER), 'posts', 'p_002');
    assert.equal(old.item.id, 'p_002');
    assert.deepEqual(old.records.comments?.map(c => c.id), ['c_old']);
    assert.throws(() => itemOf(view, ctx(DEMO_USER), 'posts', 'p_studio'), { code: 'NOT_FOUND' });
    s.posts.find(p => p.id === 'p_003')!.hidden = true;
    assert.throws(() => itemOf(visibleRecords(s, ctx(DEMO_USER)), ctx(DEMO_USER), 'posts', 'p_003'), { code: 'NOT_FOUND' });
});

test('archived tasks leave the snapshot and page per project for the team only, with their notes', () => {
    const s = chatty(), alex = visibleWorkspace(s, ctx(DEMO_USER));
    assert(alex.projectTasks.length > 0 && alex.projectTasks.every(t => !t.archived), 'active tasks stay on the board');
    assert(!alex.taskNotes.some(n => n.id === 'note_archived'), 'notes go with the archived task');
    assert.equal(alex.summary!.archivedTasks.project_common, 25);
    const view = visibleRecords(s, ctx(DEMO_USER));
    const first = pageOf(view, ctx(DEMO_USER), 'archived-tasks', { project: 'project_common' });
    assert.equal(first.total, 25);
    assert.equal(first.items[0].id, 't_024', 'newest first');
    const second = pageOf(view, ctx(DEMO_USER), 'archived-tasks', { project: 'project_common', cursor: first.nextCursor! });
    assert.deepEqual(second.items.map(t => t.id), ['t_004', 't_003', 't_002', 't_001', 't_000']);
    assert.deepEqual(second.records?.taskNotes?.map(n => n.id), ['note_archived']);
    assert.equal(itemOf(view, ctx(DEMO_USER), 'archived-tasks', 't_001').records.taskNotes?.length, 1);
    assert.throws(() => pageOf(view, ctx(DEMO_USER), 'archived-tasks'), { code: 'PROJECT_REQUIRED' });
    const maya = visibleRecords(s, ctx('member_maya'));
    assert.throws(() => pageOf(maya, ctx('member_maya'), 'archived-tasks', { project: 'project_common' }), { code: 'NOT_FOUND' }, 'not on the team');
    assert.throws(() => itemOf(maya, ctx('member_maya'), 'archived-tasks', 't_001'), { code: 'NOT_FOUND' });
});
