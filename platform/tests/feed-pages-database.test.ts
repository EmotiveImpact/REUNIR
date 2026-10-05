import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { openDatabase, type Database } from '../packages/db/src/connection';
import { migrate } from '../packages/db/src/migrate';
import { WorkspaceRepository } from '../packages/db/src/repository';
import { grantRuntimeTables } from '../packages/db/src/runtime-role';
import { createSeed, DEMO_ADMIN, DEMO_USER } from '../packages/domain/src/seed';
import { POST_WINDOW } from '../packages/contracts/src/pages';

let db: Database, repo: WorkspaceRepository;
const ORG = 'org_code_black';
const at = (n: number) => new Date(Date.UTC(2026, 8, 1) + n * 1000).toISOString();

before(async () => {
    db = await openDatabase('pglite:memory'); await migrate(db);
    const seed = createSeed();
    // 80 posts for the feeds, one in the private studio, and 30 archived tasks with a note on one of them.
    for (let i = 0; i < 80; i++) seed.posts.push({ id: `feed_${String(i).padStart(3, '0')}`, organizationId: ORG, createdAt: at(i), spaceId: i % 2 ? 'space_build' : 'space_general', authorId: 'member_maya', kind: 'update', title: `Post ${i}`, body: 'Body', pinned: false, hidden: false, cover: '' });
    seed.posts.push({ id: 'feed_studio', organizationId: ORG, createdAt: at(500), spaceId: 'space_studio', authorId: DEMO_ADMIN, kind: 'update', title: 'Team only', body: 'Body', pinned: false, hidden: false, cover: '' });
    seed.comments.push({ id: 'feed_reply', organizationId: ORG, createdAt: at(2), postId: 'feed_001', authorId: DEMO_USER, body: 'An old reply' });
    const task = seed.projectTasks.find(t => t.id === 'task_empty')!;
    for (let i = 0; i < 30; i++) seed.projectTasks.push({ ...structuredClone(task), id: `archived_${String(i).padStart(3, '0')}`, createdAt: at(i), archived: true });
    seed.taskNotes.push({ id: 'archived_note', organizationId: ORG, createdAt: at(1), projectId: 'project_common', taskId: 'archived_001', authorId: DEMO_USER, body: 'Kept with the task', hidden: false });
    const owner = new WorkspaceRepository(db); await owner.seed(seed); await owner.seed(createSeed('studio-north'));
    await db.query('CREATE ROLE reunir_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS');
    await db.transaction(grantRuntimeTables);
    const runtime = Object.create(db) as Database;
    runtime.transaction = fn => db.transaction(async tx => { await tx.query('SET LOCAL ROLE reunir_app'); return fn(tx); });
    repo = new WorkspaceRepository(runtime);
});
after(async () => db?.close());

test('under the runtime role the snapshot carries a window of posts and only active tasks, with exact counts', async () => {
    const alex = await repo.snapshot('code-black', DEMO_USER);
    const visible = (await db.query<{ n: number }>("SELECT count(*)::int AS n FROM posts WHERE organization_id=$1 AND space_id<>'space_studio' AND NOT hidden", [ORG])).rows[0].n;
    assert.equal(alex.summary!.posts, visible);
    assert(alex.posts.length >= POST_WINDOW && alex.posts.length < visible, 'a window, not every post');
    assert(alex.posts.some(p => p.id === 'feed_079') && !alex.posts.some(p => p.id === 'feed_001'), 'the newest end');
    assert(!alex.comments.some(c => c.id === 'feed_reply'), 'replies travel with their post');
    assert(alex.projectTasks.every(t => !t.archived) && alex.projectTasks.length > 0);
    assert.equal(alex.summary!.archivedTasks.project_common, 30);
    assert(!alex.taskNotes.some(n => n.id === 'archived_note'));
});

test('feeds and archived tasks page under the runtime role, and one item reads alone', async () => {
    const seen = new Set<string>();
    let page = await repo.page('code-black', DEMO_USER, 'posts', { limit: 50 });
    for (;;) { for (const p of page.items) { assert(!seen.has(p.id)); seen.add(p.id); } if (!page.nextCursor) break; page = await repo.page('code-black', DEMO_USER, 'posts', { limit: 50, cursor: page.nextCursor }); }
    assert.equal(seen.size, page.total);
    assert(!seen.has('feed_studio'), 'never a private space they are not in');
    const build = await repo.page('code-black', DEMO_USER, 'posts', { space: 'space_build', limit: 50 });
    assert(build.items.length && build.items.every(p => p.spaceId === 'space_build'));
    const old = await repo.item('code-black', DEMO_USER, 'posts', 'feed_001');
    assert.deepEqual(old.records.comments?.map(c => c.id), ['feed_reply']);
    await assert.rejects(repo.item('code-black', DEMO_USER, 'posts', 'feed_studio'), { code: 'NOT_FOUND' });
    const tasks = await repo.page('code-black', DEMO_USER, 'archived-tasks', { project: 'project_common', limit: 50 });
    assert.equal(tasks.total, 30);
    assert.deepEqual(tasks.records?.taskNotes?.map(n => n.id), ['archived_note']);
    await assert.rejects(repo.page('code-black', 'member_maya', 'archived-tasks', { project: 'project_common' }), { code: 'NOT_FOUND' }, 'not on the team');
    await assert.rejects(repo.page('code-black', 'stranger', 'posts'), 'someone outside the community reads nothing');
    const north = await repo.page('studio-north', DEMO_USER, 'posts', { limit: 50 });
    assert(north.items.length && north.items.every(p => p.organizationId !== ORG), 'another community’s feed never carries this one’s posts');
    await assert.rejects(repo.item('studio-north', DEMO_USER, 'posts', 'feed_001'), { code: 'NOT_FOUND' }, 'nor reads one by ID');
});

test('restoring an archived task brings it back to the snapshot, and a reply to an old post shows on its page', async () => {
    const task = (await repo.item('code-black', DEMO_ADMIN, 'archived-tasks', 'archived_005')).item;
    await repo.execute('code-black', DEMO_ADMIN, { type: 'task.archive', taskId: task.id, expectedVersion: task.version, archived: false }, randomUUID(), 'feed-pages-db');
    assert((await repo.snapshot('code-black', DEMO_USER)).projectTasks.some(t => t.id === 'archived_005'));
    assert.equal((await repo.page('code-black', DEMO_USER, 'archived-tasks', { project: 'project_common' })).total, 29);
    await repo.execute('code-black', DEMO_USER, { type: 'post.comment', postId: 'feed_000', body: 'Late to this, but thank you.' }, randomUUID(), 'feed-pages-db');
    const general = await repo.page('code-black', DEMO_USER, 'posts', { space: 'space_general', limit: 50 });
    const oldest = (await repo.page('code-black', DEMO_USER, 'posts', { space: 'space_general', limit: 50, cursor: general.nextCursor ?? undefined }));
    const records = [...(general.records?.comments ?? []), ...(general.nextCursor ? oldest.records?.comments ?? [] : [])];
    assert(records.some(c => c.postId === 'feed_000' && c.body.startsWith('Late')));
});
