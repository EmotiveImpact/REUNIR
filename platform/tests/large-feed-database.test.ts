import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { openDatabase, type Database } from '../packages/db/src/connection';
import { migrate } from '../packages/db/src/migrate';
import { WorkspaceRepository } from '../packages/db/src/repository';
import { grantRuntimeTables } from '../packages/db/src/runtime-role';
import { createSeed, DEMO_USER } from '../packages/domain/src/seed';
import { MAX_PAGE_SIZE, POST_WINDOW } from '../packages/contracts/src/pages';

// Alpha 53: a community with more posts and replies than a whole-workspace read ever carried (5,000 rows a table).
let db: Database, repo: WorkspaceRepository;
const ORG = 'org_code_black', POSTS = 6000, MAYA = 'member_maya';
const count = async (query: string, params: unknown[] = []) => (await db.query<{ n: number }>(query, params)).rows[0].n;
const run = (user: string, cmd: unknown) => repo.execute('code-black', user, cmd, randomUUID(), 'large-feed-db');

before(async () => {
    db = await openDatabase('pglite:memory'); await migrate(db);
    const owner = new WorkspaceRepository(db); await owner.seed(createSeed()); await owner.seed(createSeed('studio-north'));
    // Pairs of posts share a second, so the ID decides their order. Every post has one reply. One old post is hidden.
    await db.query(`INSERT INTO posts(id,organization_id,created_at,space_id,author_id,kind,title,body,pinned,hidden,cover)
        SELECT 'bulk_'||lpad(i::text,5,'0'),$1,timestamptz '2025-01-01' + (i/2) * interval '1 second',
               CASE WHEN i%2=0 THEN 'space_general' ELSE 'space_build' END,'member_jordan',
               CASE WHEN i%3=0 THEN 'question' ELSE 'update' END,'Bulk '||i,'Body',false,i=100,''
        FROM generate_series(0,$2-1) AS i`, [ORG, POSTS]);
    await db.query(`INSERT INTO comments(id,organization_id,created_at,post_id,author_id,body)
        SELECT 'bulk_reply_'||i,$1,timestamptz '2025-01-01' + (i/2) * interval '1 second','bulk_'||lpad(i::text,5,'0'),'member_theo','Reply'
        FROM generate_series(0,$2-1) AS i`, [ORG, POSTS]);
    await db.query("INSERT INTO bookmarks(id,organization_id,created_at,post_id,user_id) VALUES('bulk_saved',$1,'2025-02-01','bulk_00020',$2)", [ORG, DEMO_USER]);
    await db.query('CREATE ROLE reunir_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS');
    await db.transaction(grantRuntimeTables);
    const runtime = Object.create(db) as Database;
    runtime.transaction = fn => db.transaction(async tx => { await tx.query('SET LOCAL ROLE reunir_app'); return fn(tx); });
    repo = new WorkspaceRepository(runtime);
});
after(async () => db?.close());

test('a community past 5,000 posts and replies still opens, with exact counts and a window of the newest', async () => {
    const alex = await repo.snapshot('code-black', DEMO_USER);
    const visible = await count("SELECT count(*)::int AS n FROM posts WHERE organization_id=$1 AND space_id<>'space_studio' AND NOT hidden", [ORG]);
    assert(visible > POSTS);
    assert.equal(alex.summary!.posts, visible);
    assert(alex.posts.length >= POST_WINDOW && alex.posts.length < 400, 'a window, not every post');
    assert(alex.posts.some(p => p.id === 'bulk_05999') && !alex.posts.some(p => p.id === 'bulk_00001'));
    assert(alex.comments.every(c => alex.posts.some(p => p.id === c.postId)), 'replies travel with their post');
});

test('the feed pages through every visible post in order, in SQL, for members and moderators alike', async () => {
    // A hidden post shows to moderators and to its own author.
    const expected = async (user: string, moderator: boolean) => (await db.query<{ id: string }>(
        `SELECT id FROM posts WHERE organization_id=$1 AND space_id<>'space_studio' AND NOT pinned ${moderator ? '' : 'AND (NOT hidden OR author_id=$2)'} ORDER BY date_trunc('milliseconds',created_at) DESC,id DESC`, moderator ? [ORG] : [ORG, user])).rows.map(r => r.id);
    for (const [user, moderator] of [[DEMO_USER, false], [MAYA, true]] as const) {
        const seen: string[] = [];
        let page = await repo.page('code-black', user, 'posts', { limit: MAX_PAGE_SIZE });
        const total = page.total;
        for (;;) {
            seen.push(...page.items.map(p => p.id));
            assert((page.records?.comments ?? []).every(c => page.items.some(p => p.id === c.postId)));
            if (!page.nextCursor) break;
            page = await repo.page('code-black', user, 'posts', { limit: MAX_PAGE_SIZE, cursor: page.nextCursor });
        }
        assert.deepEqual(seen, await expected(user, moderator), user);
        assert.equal(total, seen.length);
        assert.equal(seen.includes('bulk_00100'), moderator, 'a hidden post only for moderators');
    }
    const questions = await repo.page('code-black', DEMO_USER, 'posts', { kind: 'question', space: 'space_general', limit: MAX_PAGE_SIZE });
    assert(questions.items.every(p => p.kind === 'question' && p.spaceId === 'space_general'));
    assert.equal(questions.total, await count("SELECT count(*)::int AS n FROM posts WHERE organization_id=$1 AND kind='question' AND space_id='space_general' AND NOT pinned AND NOT hidden", [ORG]));
    const saved = await repo.page('code-black', DEMO_USER, 'posts', { saved: '1' });
    assert.deepEqual(saved.items.map(p => p.id), ['bulk_00020']);
    assert.deepEqual(saved.records?.bookmarks?.map(b => b.id), ['bulk_saved']);
    assert.deepEqual((await repo.page('code-black', MAYA, 'posts', { saved: '1' })).items, [], 'only their own bookmarks');
    await assert.rejects(repo.page('code-black', DEMO_USER, 'posts', { cursor: 'not-a-cursor' }), { code: 'INVALID_CURSOR' });
    const north = await repo.page('studio-north', DEMO_USER, 'posts', { limit: MAX_PAGE_SIZE });
    assert(north.items.every(p => p.organizationId !== ORG), 'never another community’s posts');
});

test('people can still reply to, appreciate, save, report and moderate a post far outside the window', async () => {
    await run(DEMO_USER, { type: 'post.react', postId: 'bulk_00005' });
    await run(DEMO_USER, { type: 'post.comment', postId: 'bulk_00005', body: 'Still useful a year on.' });
    await run(DEMO_USER, { type: 'post.bookmark', postId: 'bulk_00006' });
    await run(DEMO_USER, { type: 'post.report', postId: 'bulk_00007', reason: 'Out of date and misleading.' });
    const old = await repo.item('code-black', DEMO_USER, 'posts', 'bulk_00005');
    assert(old.records.reactions?.some(r => r.userId === DEMO_USER));
    assert.deepEqual(old.records.comments?.map(c => c.body), ['Reply', 'Still useful a year on.']);
    await run(DEMO_USER, { type: 'post.react', postId: 'bulk_00005' });
    assert.equal(await count("SELECT count(*)::int AS n FROM reactions WHERE post_id='bulk_00005'"), 0, 'appreciating twice takes it back');
    await run(MAYA, { type: 'post.moderate', postId: 'bulk_00007', hidden: true });
    await assert.rejects(repo.item('code-black', DEMO_USER, 'posts', 'bulk_00007'), { code: 'NOT_FOUND' });
    assert.equal(await count("SELECT count(*)::int AS n FROM posts WHERE organization_id=$1", [ORG]) > POSTS, true, 'nothing outside the window was removed');
    assert.equal(await count("SELECT count(*)::int AS n FROM comments WHERE organization_id=$1 AND author_id='member_theo'", [ORG]) >= POSTS, true);
});

test('deleting an account removes its reactions and bookmarks on posts outside the window', async () => {
    await db.query("INSERT INTO auth_user(id,name,email,email_verified,created_at,updated_at) VALUES($1,'Alex Morgan','alex@example.test',true,now(),now())", [DEMO_USER]);
    await run(DEMO_USER, { type: 'post.react', postId: 'bulk_00008' });
    assert(await count('SELECT count(*)::int AS n FROM bookmarks WHERE user_id=$1', [DEMO_USER]) >= 2);
    await repo.deleteAccount(DEMO_USER);
    for (const table of ['reactions', 'bookmarks']) assert.equal(await count(`SELECT count(*)::int AS n FROM ${table} WHERE user_id=$1`, [DEMO_USER]), 0, table);
});
