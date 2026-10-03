import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSeed, DEMO_ADMIN, DEMO_USER } from '../packages/domain/src/seed';
import { applyCommand, visibleWorkspace } from '../packages/domain/src/engine';
import { noticeTopic } from '../packages/contracts/src/notifications';
import type { Workspace } from '../packages/contracts/src/index';

const ORG = 'org_code_black', T0 = '2026-10-01T09:00:00.000Z';
const ctx = (userId: string) => ({ organizationId: ORG, userId, requestId: 'notifications-test' });
let n = 0;
const run = (s: Workspace, user: string, cmd: unknown) => applyCommand(s, ctx(user), cmd, () => T0, () => `id_${++n}`);
const save = (s: Workspace, user: string, muted: string[], digest = 'off') => run(s, user, { type: 'notification.preferences.save', muted, digest });
const noticesFor = (s: Workspace, user: string) => s.notifications.filter(x => x.userId === user);

test('notices are grouped by where they lead; unknown places count as community notices', () => {
    assert.equal(noticeTopic('/post/post_welcome'), 'conversations');
    assert.equal(noticeTopic('/spaces/space_general?tab=new'), 'conversations');
    assert.equal(noticeTopic('/learn/track_product'), 'learning');
    assert.equal(noticeTopic('/learn/track_product/studio'), 'community', 'teaching access always arrives');
    assert.equal(noticeTopic('/admin/knowledge-checks'), 'learning');
    assert.equal(noticeTopic('/projects/project_common#tasks'), 'projects');
    assert.equal(noticeTopic('/outputs'), 'projects');
    assert.equal(noticeTopic('/events/event_open'), 'events');
    for (const other of ['/access', '/settings', '/home', '/postscript', '/', 'https://elsewhere.example/post/1']) assert.equal(noticeTopic(other), 'community', other);
});

test('a muted topic stops new notices for that person only, and earlier notices stay', () => {
    let s = createSeed();
    const before = noticesFor(s, DEMO_USER).length;
    s = save(s, 'member_amina', ['conversations']).workspace;
    s = run(s, DEMO_USER, { type: 'post.comment', postId: 'post_welcome', body: 'Thank you for the welcome.' }).workspace;
    assert.equal(noticesFor(s, 'member_amina').filter(x => x.href === '/post/post_welcome').length, 0, 'Amina muted conversations');
    assert.equal(noticesFor(s, DEMO_USER).length, before, 'Alex’s own notices are untouched');
    // Unmuting brings new notices back; nothing muted earlier reappears.
    s = save(s, 'member_amina', []).workspace;
    s = run(s, 'member_jordan', { type: 'post.comment', postId: 'post_welcome', body: 'Glad to be here.' }).workspace;
    assert.equal(noticesFor(s, 'member_amina').filter(x => x.href === '/post/post_welcome').length, 1);
});

test('muting never removes existing notices, and access notices always arrive', () => {
    let s = createSeed();
    const existing = noticesFor(s, DEMO_USER).map(x => x.id);
    s = save(s, DEMO_USER, ['conversations', 'learning', 'projects', 'events']).workspace;
    assert.deepEqual(noticesFor(s, DEMO_USER).map(x => x.id), existing);
    s = run(s, DEMO_ADMIN, { type: 'track.instructor.add', trackId: 'track_story', userId: DEMO_USER }).workspace;
    const access = noticesFor(s, DEMO_USER).filter(x => !existing.includes(x.id));
    assert.equal(access.length, 1, 'being asked to teach still reaches the person');
    assert(access.every(x => noticeTopic(x.href) === 'community'));
});

test('settings are validated, private to the member and saved without an audit entry', () => {
    let s = createSeed();
    assert.throws(() => save(s, DEMO_USER, ['community']), 'access notices cannot be muted');
    assert.throws(() => save(s, DEMO_USER, ['events', 'events']));
    assert.throws(() => save(s, DEMO_USER, [], 'hourly'));
    const audits = s.audit.length;
    const r = save(s, DEMO_USER, ['events', 'conversations'], 'weekly');
    s = r.workspace;
    assert.equal(s.audit.length, audits, 'personal settings are not administrative actions');
    assert.deepEqual(s.notificationPreferences.find(p => p.userId === DEMO_USER)?.muted, ['conversations', 'events'], 'stored in a stable order');
    assert.equal(save(s, DEMO_USER, ['conversations', 'events'], 'weekly').message, 'Your notification settings are unchanged.');
    s = save(s, 'member_jordan', ['learning'], 'daily').workspace;
    const alex = visibleWorkspace(s, ctx(DEMO_USER)), amina = visibleWorkspace(s, ctx(DEMO_ADMIN));
    assert.deepEqual(alex.notificationPreferences.map(p => p.userId), [DEMO_USER], 'members see only their own settings');
    assert.deepEqual(amina.notificationPreferences, [], 'administrators do not see other people’s settings');
});

test('suspended members cannot change settings', () => {
    let s = createSeed();
    const jordan = s.members.find(m => m.userId === 'member_jordan')!;
    s = run(s, DEMO_ADMIN, { type: 'member.status', memberId: jordan.id, status: 'suspended', reason: 'A reviewed test case.' }).workspace;
    assert.throws(() => save(s, 'member_jordan', ['events']));
});
