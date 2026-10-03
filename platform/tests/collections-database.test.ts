import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { openDatabase, type Database } from '../packages/db/src/connection';
import { migrate } from '../packages/db/src/migrate';
import { WorkspaceRepository, setContext } from '../packages/db/src/repository';
import { grantRuntimeTables } from '../packages/db/src/runtime-role';
import { createSeed, DEMO_ADMIN, DEMO_USER } from '../packages/domain/src/seed';

const ORG = 'org_code_black', MAYA = 'member_maya';
let db: Database, runtime: Database, repo: WorkspaceRepository;
const run = (user: string, cmd: unknown) => repo.execute('code-black', user, cmd, randomUUID(), 'collections-db');
const rows = async (query: string, params: unknown[] = []) => (await db.query(query, params)).rows;
/** Runs one query as the restricted role, in a tenant context or none. */
const asRuntime = <T>(fn: (sql: Database) => Promise<T>, org?: string, user?: string) => db.transaction(async tx => {
    await tx.query('SET LOCAL ROLE reunir_app');
    if (org && user) await setContext(tx, org, user);
    return fn(tx as unknown as Database);
});
const visible = async (table: string, org: string, user: string) => (await asRuntime(sql => sql.query<{ id: string }>(`SELECT id FROM ${table} ORDER BY id`), org, user)).rows.map(r => r.id);

before(async () => {
    db = await openDatabase('pglite:memory'); await migrate(db);
    const owner = new WorkspaceRepository(db); await owner.seed(createSeed()); await owner.seed(createSeed('studio-north'));
    await db.query('CREATE ROLE reunir_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS');
    await db.transaction(grantRuntimeTables);
    runtime = Object.create(db) as Database;
    runtime.transaction = fn => db.transaction(async tx => { await tx.query('SET LOCAL ROLE reunir_app'); return fn(tx); });
    repo = new WorkspaceRepository(runtime);
});
after(async () => db?.close());

test('collections are real tables, and a member’s snapshot under the restricted role holds only what they may see', async () => {
    assert.equal((await rows('SELECT count(*)::int AS n FROM collection_items'))[0].n, 7);
    const alex = await repo.snapshot('code-black', DEMO_USER);
    assert.deepEqual(alex.collections.map(c => c.id), ['collection_start']);
    assert.deepEqual(alex.collectionItems.map(i => i.id).sort(), ['collected_lesson', 'collected_output', 'collected_path', 'collected_welcome']);
    const maya = await repo.snapshot('code-black', MAYA);
    assert.deepEqual(maya.collections.map(c => c.id).sort(), ['collection_feedback', 'collection_start']);
    assert(!maya.collectionItems.some(i => i.id === 'collected_team_notes'), 'not in the private studio');
    const owner = await repo.snapshot('code-black', DEMO_ADMIN);
    assert.equal(owner.collectionItems.length, 7);
    assert.deepEqual((await repo.snapshot('studio-north', DEMO_USER)).collections, []);
});

test('row security: drafts are read only by the active team, and only the team writes', async () => {
    assert.deepEqual(await visible('collections', ORG, DEMO_USER), ['collection_start']);
    assert(!(await visible('collection_items', ORG, DEMO_USER)).some(id => ['collected_maya', 'collected_brand'].includes(id)), 'items of a draft follow it');
    assert.deepEqual(await visible('collections', ORG, MAYA), ['collection_feedback', 'collection_start']);
    assert.deepEqual(await visible('collections', 'org_studio_north', DEMO_USER), [], 'another community sees none');
    assert.deepEqual((await asRuntime(sql => sql.query('SELECT id FROM collections'))).rows, [], 'no context, no rows');
    // A member can neither create, change nor remove.
    await assert.rejects(() => asRuntime(sql => sql.query("INSERT INTO collections(id,organization_id,created_at,title,description,status,featured,created_by,updated_by,updated_at) VALUES('forged',$1,now(),'Forged','','draft',false,$2,$2,now())", [ORG, DEMO_USER]), ORG, DEMO_USER));
    await asRuntime(sql => sql.query("UPDATE collections SET title='Changed',updated_by=$1", [DEMO_USER]), ORG, DEMO_USER);
    await asRuntime(sql => sql.query('DELETE FROM collection_items'), ORG, DEMO_USER);
    assert.equal((await rows("SELECT title FROM collections WHERE id='collection_start'"))[0].title, 'Start here');
    assert.equal((await rows('SELECT count(*)::int AS n FROM collection_items'))[0].n, 7);
    // A moderator cannot write in someone else's name.
    await assert.rejects(() => asRuntime(sql => sql.query("INSERT INTO collections(id,organization_id,created_at,title,description,status,featured,created_by,updated_by,updated_at) VALUES('borrowed',$1,now(),'Borrowed','','draft',false,$2,$2,now())", [ORG, DEMO_ADMIN]), ORG, MAYA));
    // What an item points at, and who created a collection, cannot be rewritten.
    await assert.rejects(() => asRuntime(sql => sql.query("UPDATE collection_items SET post_id='post_win' WHERE id='collected_welcome'"), ORG, DEMO_ADMIN));
    await assert.rejects(() => asRuntime(sql => sql.query("UPDATE collections SET created_by=$1 WHERE id='collection_start'", [MAYA]), ORG, DEMO_ADMIN));
});

test('a suspended moderator loses drafts and writes at once', async () => {
    const id = (await rows("SELECT id FROM members WHERE organization_id=$1 AND user_id=$2", [ORG, MAYA]))[0].id;
    await run(DEMO_ADMIN, { type: 'member.status', memberId: id, status: 'suspended', reason: 'A reviewed test case.' });
    assert.deepEqual(await visible('collections', ORG, MAYA), ['collection_start']);
    await asRuntime(sql => sql.query("UPDATE collections SET title='While suspended',updated_by=$1", [MAYA]), ORG, MAYA);
    assert.equal((await rows("SELECT count(*)::int AS n FROM collections WHERE title='While suspended'"))[0].n, 0);
    await assert.rejects(() => run(MAYA, { type: 'collection.save', title: 'While suspended' }));
    await run(DEMO_ADMIN, { type: 'member.status', memberId: id, status: 'active', reason: 'Restored after the test.' });
});

test('curation persists through the command pipeline under the restricted role', async () => {
    const created = await run(MAYA, { type: 'collection.save', title: 'Worth an evening', description: 'Longer reads.' });
    const cid = created.objectId!;
    for (const [kind, targetId] of [['track', 'track_story'], ['event', 'event_focus'], ['mission', 'mission_film']]) await run(MAYA, { type: 'collection.item.add', collectionId: cid, kind, targetId, note: '' });
    const items = async () => (await rows('SELECT id,kind,position FROM collection_items WHERE collection_id=$1 ORDER BY position', [cid])) as { id: string; kind: string; position: number }[];
    const ids = (await items()).map(i => i.id);
    assert.deepEqual((await items()).map(i => i.kind), ['track', 'event', 'mission']);
    await run(MAYA, { type: 'collection.items.reorder', collectionId: cid, expectedOrder: ids, itemIds: [...ids].reverse() });
    assert.deepEqual((await items()).map(i => i.kind), ['mission', 'event', 'track'], 'positions swap inside one transaction');
    await run(MAYA, { type: 'collection.item.note', itemId: ids[0], note: 'Start with the stories.' });
    await run(MAYA, { type: 'collection.publish', collectionId: cid, published: true });
    // Featuring moves from "Start here" to the new collection in one transaction.
    await run(DEMO_ADMIN, { type: 'collection.feature', collectionId: cid, featured: true });
    assert.deepEqual((await rows('SELECT id FROM collections WHERE featured')).map(r => r.id), [cid]);
    assert.equal((await rows("SELECT updated_by FROM collections WHERE id='collection_start'"))[0].updated_by, DEMO_ADMIN);
    const alex = await repo.snapshot('code-black', DEMO_USER);
    assert.deepEqual(alex.collections.find(c => c.featured)?.title, 'Worth an evening');
    assert((await rows("SELECT action FROM audit WHERE organization_id=$1 AND action LIKE 'collection.%'", [ORG])).length >= 7, 'curation is audited');
    await run(MAYA, { type: 'collection.delete', collectionId: cid });
    assert.equal((await rows('SELECT count(*)::int AS n FROM collection_items WHERE collection_id=$1', [cid]))[0].n, 0);
    assert.equal((await rows("SELECT count(*)::int AS n FROM tracks WHERE organization_id=$1 AND id='track_story'", [ORG]))[0].n, 1, 'content stays');
});

test('the tables refuse a second featured collection, mismatched kinds and other communities’ content', async () => {
    await assert.rejects(() => db.transaction(async tx => {
        await tx.query("UPDATE collections SET featured=false");
        await tx.query("UPDATE collections SET status='published',published_at=now(),featured=true WHERE organization_id=$1", [ORG]);
    }), /collections_one_featured/, 'only one featured collection per community, checked at commit');
    const add = (extra: string, values: string) => db.query(`INSERT INTO collection_items(id,organization_id,created_at,collection_id,kind,position,note,added_by,${extra}) VALUES('bad',$1,now(),'collection_start',${values})`, [ORG]);
    await assert.rejects(() => add('track_id', "'post',90,'','member_amina','track_story'"), /check constraint/, 'kind must match');
    await assert.rejects(() => add('post_id,track_id', "'post',90,'','member_amina','post_win','track_story'"), /check constraint/, 'exactly one target');
    await assert.rejects(() => add('post_id', "'post',90,'','member_amina','post_does_not_exist'"), /foreign key/, 'targets must exist');
    // Studio North's seed shares IDs with Code Black; the composite key keeps a Code Black item on Code Black's post.
    await assert.rejects(() => db.query("INSERT INTO collection_items(id,organization_id,created_at,collection_id,kind,position,note,added_by,post_id) VALUES('cross','org_studio_north',now(),'collection_start','post',1,'','member_amina','post_welcome')"), /foreign key/, 'the collection belongs to another community');
    await assert.rejects(() => add('post_id', "'post',91,'','member_amina','post_welcome'"), /duplicate key/, 'the same post twice');
});

test('an upgraded database keeps its records and starts with no collections', async () => {
    const old = await openDatabase('pglite:memory');
    try {
        await migrate(old, '0021'); await new WorkspaceRepository(old).seed({ ...createSeed(), collections: [], collectionItems: [] });
        const posts = (await old.query('SELECT id,title FROM posts ORDER BY organization_id,id')).rows;
        await migrate(old);
        assert.deepEqual((await old.query('SELECT id,title FROM posts ORDER BY organization_id,id')).rows, posts);
        assert.deepEqual((await new WorkspaceRepository(old).snapshot('code-black', DEMO_ADMIN)).collections, []);
    } finally { await old.close(); }
});
