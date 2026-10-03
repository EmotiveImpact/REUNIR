import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSeed, DEMO_ADMIN, DEMO_USER } from '../packages/domain/src/seed';
import { visibleRecords, visibleWorkspace } from '../packages/domain/src/engine';
import { pageOf, listItems } from '../packages/domain/src/pages';
import { AUDIT_WINDOW, NOTIFICATION_WINDOW, cursorFor, pageQuery, readCursor } from '../packages/contracts/src/pages';
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
