import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { openDatabase, type Database, type SQL } from '../packages/db/src/connection';
import { migrate } from '../packages/db/src/migrate';
import { WorkspaceRepository, setContext } from '../packages/db/src/repository';
import { grantRuntimeTables } from '../packages/db/src/runtime-role';
import { createSeed, DEMO_ADMIN, DEMO_USER } from '../packages/domain/src/seed';
import { DEMO_COVER_LIBRARY_FILE } from '../packages/domain/src/demo-files';
import { coverBytesAcceptable } from '../packages/contracts/src/covers';
import { seedBeforeProjectWork } from './helpers/legacy-fixture';
import { pngHeader } from './helpers/images';

const ORG = 'org_code_black';
let db: Database, repo: WorkspaceRepository;
const observed = { sizeBytes: 4096, contentType: 'image/png', generation: '1712345678905678', bytesAcceptable: coverBytesAcceptable('image/png', pngHeader(1600, 900)) };
const key = (org: string, id: string) => `organisations/${org}/covers/library/${id}.png`;
const exec = (cmd: unknown, user = DEMO_ADMIN) => repo.execute('code-black', user, cmd, randomUUID(), 'cover-library-db');
const as = <T>(user: string, org: string, fn: (tx: SQL) => Promise<T>) => db.transaction(async tx => { await tx.query('SET LOCAL ROLE reunir_app'); await setContext(tx, org, user); return fn(tx); });
const ids = (tx: SQL, sql: string) => tx.query<{ id: string }>(sql).then(r => r.rows.map(x => x.id).sort());
/** Runs inside a transaction that is always rolled back, so probes leave no rows behind. */
async function probe(user: string, fn: (tx: SQL) => Promise<unknown>) {
    try { await db.transaction(async tx => { await tx.query('SET LOCAL ROLE reunir_app'); await setContext(tx, ORG, user); await fn(tx); throw new Error('rollback'); }); }
    catch (e) { if ((e as Error).message !== 'rollback') throw e; }
}
/** Upload and verify a picture through the restricted role, without listing it. */
async function uploaded(user = DEMO_ADMIN) {
    const { upload } = await repo.beginCoverLibraryUpload('code-black', user, { purpose: 'cover_library', contentType: 'image/png', sizeBytes: 4096 }, key, 'cover-library-db');
    assert.equal((await repo.completeCoverUpload('code-black', user, upload.id, observed, 'cover-library-db')).outcome, 'ready');
    return upload.id;
}

before(async () => {
    db = await openDatabase('pglite:memory'); await migrate(db);
    const owner = new WorkspaceRepository(db); await owner.seed(createSeed()); await owner.seed(createSeed('studio-north'));
    await db.query('CREATE ROLE reunir_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS');
    await db.transaction(grantRuntimeTables);
    const runtime = Object.create(db) as Database;
    runtime.transaction = fn => db.transaction(async tx => { await tx.query('SET LOCAL ROLE reunir_app'); return fn(tx); });
    repo = new WorkspaceRepository(runtime);
});
after(async () => db?.close());

test('0013 upgrade keeps tracks, projects, covers and uploads exactly as they were and lists nothing', async () => {
    const old = await openDatabase('pglite:memory');
    try {
        await migrate(old, '0012'); await seedBeforeProjectWork(old);
        await old.query("INSERT INTO upload_intents(organization_id,id,user_id,object_key,content_type,size_bytes,original_name,created_at,status,purpose,completed_at,generation,cover_track_id) VALUES('org_code_black','legacy_cover','member_amina','organisations/org_code_black/covers/tracks/track_story/legacy.png','image/png',100,'track cover',now(),'ready','cover_image',now(),'7','track_story')");
        await old.query(`UPDATE tracks SET cover_image='{"fileId":"legacy_cover","contentType":"image/png","sizeBytes":100,"focusX":50,"focusY":50}'::jsonb WHERE organization_id='org_code_black' AND id='track_story'`);
        const read = async (table: string) => (await old.query(`SELECT * FROM ${table} ORDER BY organization_id,id`)).rows;
        const before = { tracks: await read('tracks'), projects: await read('projects'), upload_intents: await read('upload_intents'), members: await read('members') };
        await migrate(old); await migrate(old);
        for (const table of ['tracks', 'projects', 'members'] as const) assert.deepEqual(await read(table), before[table], table);
        // Migration 0022 adds empty small-copy columns to uploads; every earlier column is unchanged.
        const thumbnail = ['thumbnail_object_key', 'thumbnail_content_type', 'thumbnail_size_bytes', 'thumbnail_generation'];
        const uploads = await read('upload_intents');
        assert.deepEqual(uploads.map(r => Object.fromEntries(Object.entries(r).filter(([k]) => !thumbnail.includes(k)))), before.upload_intents, 'upload_intents');
        assert(uploads.every(r => thumbnail.every(k => r[k] === null)));
        assert.deepEqual(await read('cover_library'), []);
        assert.equal((await old.query('SELECT version FROM schema_migrations')).rows.length, 22);
    } finally { await old.close(); }
});

test('through the restricted role, an administrator lists a picture, a member uses it, and it leaves only when free', async () => {
    const fileId = await uploaded();
    assert.equal((await db.query<{ object_key: string }>('SELECT object_key FROM upload_intents WHERE id=$1', [fileId])).rows[0].object_key, `organisations/${ORG}/covers/library/${fileId}.png`);
    const itemId = (await exec({ type: 'cover.library.add', fileId, label: 'Harbour at dawn' })).objectId!;
    assert.deepEqual((await db.query('SELECT label,added_by,content_type,size_bytes FROM cover_library WHERE id=$1', [itemId])).rows, [{ label: 'Harbour at dawn', added_by: DEMO_ADMIN, content_type: 'image/png', size_bytes: 4096 }]);
    const member = await repo.snapshot('code-black', DEMO_USER);
    assert.deepEqual(member.coverLibrary.map(i => i.label).sort(), ['Harbour at dawn', 'Mountain ridge']);
    assert.deepEqual(member.uploads, [], 'members never receive upload records');
    assert.deepEqual(await repo.coverLibraryPicture('code-black', DEMO_USER, itemId), { objectKey: key(ORG, fileId), generation: observed.generation, contentType: 'image/png', sizeBytes: 4096 });
    await assert.rejects(() => repo.coverLibraryPicture('studio-north', DEMO_USER, itemId), { code: 'NOT_FOUND' });
    await exec({ type: 'project.cover.set', projectId: 'project_still', fileId, focusX: 20, focusY: 80 }, 'member_jordan');
    assert.equal((await repo.coverImage('code-black', DEMO_USER, 'project', 'project_still', fileId)).objectKey, key(ORG, fileId));
    await assert.rejects(() => repo.removeCoverLibraryItem('code-black', DEMO_ADMIN, itemId, 'cover-library-db'), { code: 'COVER_IN_USE' });
    await assert.rejects(() => repo.removeCoverLibraryItem('code-black', DEMO_USER, itemId, 'cover-library-db'), { code: 'ADMIN_REQUIRED' });
    await assert.rejects(() => repo.beginCoverLibraryUpload('code-black', DEMO_USER, { purpose: 'cover_library', contentType: 'image/png', sizeBytes: 4096 }, key, 'cover-library-db'), { code: 'ADMIN_REQUIRED' });
    await exec({ type: 'project.cover.set', projectId: 'project_still', fileId: null }, 'member_jordan');
    assert.deepEqual(await repo.removeCoverLibraryItem('code-black', DEMO_ADMIN, itemId, 'cover-library-db'), { id: itemId, objectKey: key(ORG, fileId), thumbnailObjectKey: null });
    assert.equal((await db.query('SELECT id FROM cover_library WHERE id=$1', [itemId])).rows.length, 0);
    assert.equal((await db.query('SELECT id FROM upload_intents WHERE id=$1', [fileId])).rows.length, 0, 'the upload record goes with it');
    assert((await db.query<{ action: string }>('SELECT action FROM audit WHERE object_id=$1', [itemId])).rows.some(r => r.action === 'cover.library.removed'));
});

test('forced RLS: members read the library; only an active administrator adds, in their own name, or removes', async () => {
    const free = await uploaded();
    await as(DEMO_USER, ORG, async tx => assert.deepEqual(await ids(tx, 'SELECT id FROM cover_library'), ['library_mountain']));
    await as(DEMO_ADMIN, 'org_studio_north', async tx => assert.deepEqual(await ids(tx, 'SELECT id FROM cover_library'), [], 'another community'));
    await as('', '', async tx => assert.deepEqual(await ids(tx, 'SELECT id FROM cover_library'), []));
    const add = (tx: SQL, by: string) => tx.query("INSERT INTO cover_library(id,organization_id,created_at,file_id,label,content_type,size_bytes,added_by) VALUES('lib_probe',$1,now(),$2,'Probe','image/png',4096,$3)", [ORG, free, by]);
    await assert.rejects(() => probe(DEMO_USER, tx => add(tx, DEMO_USER)), /row-level security/, 'members cannot list');
    await assert.rejects(() => probe('member_idris', tx => add(tx, 'member_idris')), /row-level security/, 'instructors cannot list');
    await assert.rejects(() => probe(DEMO_ADMIN, tx => add(tx, DEMO_USER)), /row-level security/, 'never in someone else’s name');
    await probe(DEMO_ADMIN, tx => add(tx, DEMO_ADMIN));
    await probe(DEMO_USER, async tx => assert.equal((await tx.query("DELETE FROM cover_library WHERE id='library_mountain' RETURNING id")).rows.length, 0, 'a member’s delete matches nothing'));
    await probe(DEMO_ADMIN, async tx => assert.equal((await tx.query("DELETE FROM cover_library WHERE id='library_mountain' RETURNING id")).rows.length, 1, 'positive control'));
    await db.query("UPDATE members SET status='suspended' WHERE organization_id=$1 AND user_id=$2", [ORG, DEMO_ADMIN]);
    try {
        await assert.rejects(() => probe(DEMO_ADMIN, tx => add(tx, DEMO_ADMIN)), /row-level security/, 'a suspended administrator cannot list');
        await probe(DEMO_ADMIN, async tx => assert.equal((await tx.query("DELETE FROM cover_library WHERE id='library_mountain' RETURNING id")).rows.length, 0, 'or remove'));
    } finally { await db.query("UPDATE members SET status='active' WHERE organization_id=$1 AND user_id=$2", [ORG, DEMO_ADMIN]); }
});

test('forced RLS keeps unlisted library uploads with administrators and their uploader', async () => {
    const unlisted = await uploaded();
    const library = (tx: SQL) => ids(tx, "SELECT id FROM upload_intents WHERE purpose='cover_library'");
    await as(DEMO_USER, ORG, async tx => assert.deepEqual(await library(tx), [DEMO_COVER_LIBRARY_FILE], 'members see listed pictures only'));
    assert((await as(DEMO_ADMIN, ORG, library)).includes(unlisted));
    await as(DEMO_ADMIN, 'org_studio_north', async tx => assert.deepEqual(await library(tx), []));
    // The uploader keeps sight of their own unfinished upload (here a moderator, as if their role changed); other members do not.
    await db.query("INSERT INTO upload_intents(organization_id,id,user_id,object_key,content_type,size_bytes,original_name,created_at,status,purpose) VALUES($1,'maya_pending','member_maya','k-maya','image/png',10,'cover library picture',now(),'pending','cover_library')", [ORG]);
    await as('member_maya', ORG, async tx => assert.deepEqual(await library(tx), [DEMO_COVER_LIBRARY_FILE, 'maya_pending'].sort()));
    await as(DEMO_USER, ORG, async tx => assert.deepEqual(await library(tx), [DEMO_COVER_LIBRARY_FILE]));
    await db.query("DELETE FROM upload_intents WHERE id='maya_pending'");
});

test('database constraints keep library pictures unscoped, verified, bounded and listed once', async () => {
    const insert = (values: string) => db.query(`INSERT INTO upload_intents(organization_id,id,user_id,object_key,content_type,size_bytes,original_name,created_at,status,purpose,completed_at,generation,cover_track_id,cover_project_id) VALUES ${values}`);
    await assert.rejects(() => insert("('org_code_black','l1','member_amina','k-l1','image/png',10,'c',now(),'pending','cover_library',NULL,NULL,'track_story',NULL)"), 'a library picture names no track');
    await assert.rejects(() => insert("('org_code_black','l2','member_amina','k-l2','image/png',10,'c',now(),'ready','cover_library',now(),NULL,NULL,NULL)"), 'ready needs a generation');
    await assert.rejects(() => insert("('org_code_black','l3','member_amina','k-l3','image/png',4000000,'c',now(),'pending','cover_library',NULL,NULL,NULL,NULL)"), 'at most 3 MB');
    const list = (id: string, org: string, file: string, label = 'Picture', type = 'image/jpeg') => db.query("INSERT INTO cover_library(id,organization_id,created_at,file_id,label,content_type,size_bytes,added_by) VALUES($1,$2,now(),$3,$4,$5,14450,'member_amina')", [id, org, file, label, type]);
    await assert.rejects(() => list('dup', ORG, DEMO_COVER_LIBRARY_FILE), /duplicate key/, 'a picture is listed once');
    await assert.rejects(() => list('missing', ORG, 'no_such_upload'), /foreign key/);
    await assert.rejects(() => list('elsewhere', 'org_studio_north', DEMO_COVER_LIBRARY_FILE), /foreign key/, 'another community’s upload');
    await assert.rejects(() => list('blank', ORG, DEMO_COVER_LIBRARY_FILE, ''), /check constraint/);
    await assert.rejects(() => list('svg', ORG, DEMO_COVER_LIBRARY_FILE, 'Vector', 'image/svg+xml'), /check constraint/);
});

test('runtime grants allow listing, renaming and removing pictures, never rewriting the picture', async () => {
    const can = async (privilege: string) => (await db.query<{ ok: boolean }>("SELECT has_table_privilege('reunir_app','cover_library',$1) AS ok", [privilege])).rows[0].ok;
    assert.deepEqual([await can('SELECT'), await can('INSERT'), await can('DELETE'), await can('UPDATE')], [true, true, true, false]);
    const column = async (name: string) => (await db.query<{ ok: boolean }>("SELECT has_column_privilege('reunir_app','cover_library',$1,'UPDATE') AS ok", [name])).rows[0].ok;
    assert.deepEqual(await Promise.all(['label', 'tags', 'file_id', 'content_type', 'size_bytes', 'added_by', 'organization_id', 'id', 'created_at'].map(column)), [true, true, false, false, false, false, false, false, false]);
});
