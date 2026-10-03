import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase, type Database, type SQL } from '../packages/db/src/connection';
import { migrate } from '../packages/db/src/migrate';
import { WorkspaceRepository, setContext } from '../packages/db/src/repository';
import { grantRuntimeTables } from '../packages/db/src/runtime-role';
import { createSeed, DEMO_ADMIN, DEMO_INSTRUCTOR, DEMO_USER } from '../packages/domain/src/seed';
import { DEMO_COVER_LIBRARY_FILE } from '../packages/domain/src/demo-files';
import { coverBytesAcceptable, coverThumbnailAcceptable } from '../packages/contracts/src/covers';
import { pngHeader, webpHeader } from './helpers/images';
import { seedBeforeProjectWork } from './helpers/legacy-fixture';
import { MIGRATION_COUNT } from './helpers/migrations';

const ORG = 'org_code_black', STUDIO = 'org_studio_north';
let db: Database, repo: WorkspaceRepository;
/** Runs inside a transaction that is always rolled back, so probes leave no rows behind. */
async function probe(user: string, org: string, fn: (tx: SQL) => Promise<unknown>) {
    try { await db.transaction(async tx => { await tx.query('SET LOCAL ROLE reunir_app'); await setContext(tx, org, user); await fn(tx); throw new Error('rollback'); }); }
    catch (e) { if ((e as Error).message !== 'rollback') throw e; }
}
const rename = (tx: SQL, label = 'Probe', where = "id='library_mountain'") => tx.query(`UPDATE cover_library SET label=$1,tags='["probe"]'::jsonb WHERE ${where} RETURNING id`, [label]).then(r => r.rows.length);
const library = async () => (await db.query<{ label: string; tags: string[]; file_id: string }>("SELECT label,tags,file_id FROM cover_library WHERE organization_id=$1 AND id='library_mountain'", [ORG])).rows[0];
async function asStatus<T>(user: string, status: string, fn: () => Promise<T>) {
    await db.query('UPDATE members SET status=$3 WHERE organization_id=$1 AND user_id=$2', [ORG, user, status]);
    try { return await fn(); } finally { await db.query("UPDATE members SET status='active' WHERE organization_id=$1 AND user_id=$2", [ORG, user]); }
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

test('0038 upgrade keeps every library picture and upload as it was, with no tags and no small copies', async () => {
    const old = await openDatabase('pglite:memory');
    try {
        await migrate(old, '0022'); await seedBeforeProjectWork(old);
        await old.query("INSERT INTO upload_intents(organization_id,id,user_id,object_key,content_type,size_bytes,original_name,created_at,status,purpose,completed_at,generation) VALUES('org_code_black','legacy_library','member_amina','organisations/org_code_black/covers/library/legacy.jpg','image/jpeg',100,'cover library picture',now(),'ready','cover_library',now(),'8')");
        await old.query("INSERT INTO cover_library(id,organization_id,created_at,file_id,label,content_type,size_bytes,added_by) VALUES('legacy_item','org_code_black',now(),'legacy_library','Harbour at dawn','image/jpeg',100,'member_amina')");
        await old.query("INSERT INTO upload_intents(organization_id,id,user_id,object_key,content_type,size_bytes,original_name,created_at,status,purpose,completed_at,generation,cover_track_id) VALUES('org_code_black','legacy_cover','member_amina','organisations/org_code_black/covers/tracks/track_story/legacy.png','image/png',100,'track cover',now(),'ready','cover_image',now(),'7','track_story')");
        const read = async (table: string) => (await old.query(`SELECT * FROM ${table} ORDER BY organization_id,id`)).rows;
        const before = { cover_library: await read('cover_library'), upload_intents: await read('upload_intents'), tracks: await read('tracks') };
        const versions = (await old.query('SELECT version,digest FROM schema_migrations ORDER BY version')).rows;
        await migrate(old); await migrate(old);
        const strip = (rows: Record<string, unknown>[], extra: string[]) => rows.map(r => Object.fromEntries(Object.entries(r).filter(([k]) => !extra.includes(k))));
        // Task files (migration 0029) add an empty task_id to every upload too.
        const thumbnail = ['thumbnail_object_key', 'thumbnail_content_type', 'thumbnail_size_bytes', 'thumbnail_generation', 'task_id'];
        const libraryNow = await read('cover_library'), uploadsNow = await read('upload_intents');
        assert.deepEqual(strip(libraryNow, ['tags']), before.cover_library);
        assert.deepEqual(libraryNow.map(r => r.tags), [[]], 'existing pictures start untagged');
        assert.deepEqual(strip(uploadsNow, thumbnail), before.upload_intents);
        assert(uploadsNow.every(r => thumbnail.every(k => r[k] === null)), 'no existing upload gains a small copy');
        assert.deepEqual(await read('tracks'), before.tracks);
        assert.deepEqual((await old.query("SELECT version,digest FROM schema_migrations WHERE version<='0022' ORDER BY version")).rows, versions, 'earlier migrations are unchanged');
        assert.equal((await old.query('SELECT version FROM schema_migrations')).rows.length, MIGRATION_COUNT);
    } finally { await old.close(); }
});

test('through the restricted role, an administrator renames and tags a picture; the change is audited and the picture kept', async () => {
    const result = await repo.updateCoverLibraryItem('code-black', DEMO_ADMIN, 'library_mountain', { label: 'Ridge at noon', tags: ['Hills', 'hills', 'outdoors'] }, 'library-management-db');
    assert.deepEqual(result, { id: 'library_mountain', label: 'Ridge at noon', tags: ['hills', 'outdoors'], changed: true });
    assert.deepEqual(await library(), { label: 'Ridge at noon', tags: ['hills', 'outdoors'], file_id: DEMO_COVER_LIBRARY_FILE });
    const audit = (await db.query<{ action: string; actor_id: string }>("SELECT action,actor_id FROM audit WHERE organization_id=$1 AND object_id='library_mountain'", [ORG])).rows;
    assert(audit.some(r => r.action === 'cover.library.updated' && r.actor_id === DEMO_ADMIN));
    assert.deepEqual((await repo.snapshot('code-black', DEMO_USER)).coverLibrary.find(i => i.id === 'library_mountain')!.tags, ['hills', 'outdoors'], 'every member reads the tags');
    const again = await repo.updateCoverLibraryItem('code-black', DEMO_ADMIN, 'library_mountain', { label: 'Ridge at noon', tags: ['hills', 'outdoors'] }, 'library-management-db');
    assert.equal(again.changed, false);
    await repo.updateCoverLibraryItem('code-black', DEMO_ADMIN, 'library_mountain', { label: 'Mountain ridge', tags: ['landscape', 'outdoors'] }, 'library-management-db');
});

test('members, moderators, instructors, suspended administrators and other communities cannot rename or tag', async () => {
    for (const user of [DEMO_USER, DEMO_INSTRUCTOR, 'member_maya'])
        await assert.rejects(() => repo.updateCoverLibraryItem('code-black', user, 'library_mountain', { label: 'Mine', tags: [] }, 'library-management-db'), { code: 'ADMIN_REQUIRED' }, user);
    await asStatus(DEMO_ADMIN, 'suspended', () => assert.rejects(() => repo.updateCoverLibraryItem('code-black', DEMO_ADMIN, 'library_mountain', { label: 'Mine', tags: [] }, 'library-management-db'), { code: 'NOT_FOUND' }, 'a suspended owner is no longer in the community'));
    // The owner of Studio North cannot reach Code Black's picture through their own community.
    await assert.rejects(() => repo.updateCoverLibraryItem('studio-north', DEMO_ADMIN, 'library_mountain', { label: 'Taken', tags: [] }, 'library-management-db'), { code: 'NOT_FOUND' });
    assert.deepEqual(await library(), { label: 'Mountain ridge', tags: ['landscape', 'outdoors'], file_id: DEMO_COVER_LIBRARY_FILE });
});

test('forced RLS: only an active owner or administrator of the same community updates a row, and only its name and tags', async () => {
    await probe(DEMO_ADMIN, ORG, async tx => assert.equal(await rename(tx), 1, 'positive control'));
    for (const user of [DEMO_USER, DEMO_INSTRUCTOR, 'member_maya'])
        await probe(user, ORG, async tx => assert.equal(await rename(tx), 0, `${user}: an update matches nothing`));
    await probe(DEMO_ADMIN, STUDIO, async tx => assert.equal(await rename(tx, 'Probe', `organization_id='${ORG}'`), 0, 'another community’s rows are out of sight'));
    await probe('', '', async tx => assert.equal(await rename(tx), 0, 'no context, no rows'));
    await asStatus(DEMO_ADMIN, 'suspended', () => probe(DEMO_ADMIN, ORG, async tx => assert.equal(await rename(tx), 0, 'a suspended owner updates nothing')));
    await db.query("UPDATE members SET role='admin' WHERE organization_id=$1 AND user_id='member_jordan'", [ORG]);
    try {
        await probe('member_jordan', ORG, async tx => assert.equal(await rename(tx), 1, 'an active administrator may'));
        await asStatus('member_jordan', 'suspended', () => probe('member_jordan', ORG, async tx => assert.equal(await rename(tx), 0, 'a suspended administrator may not')));
    } finally { await db.query("UPDATE members SET role='member' WHERE organization_id=$1 AND user_id='member_jordan'", [ORG]); }
    for (const column of ["file_id='other'", "content_type='image/png'", 'size_bytes=1', "added_by='member_alex'", "organization_id='org_studio_north'"])
        await assert.rejects(() => probe(DEMO_ADMIN, ORG, tx => tx.query(`UPDATE cover_library SET ${column} WHERE id='library_mountain'`)), /permission denied/, column);
    assert.deepEqual(await library(), { label: 'Mountain ridge', tags: ['landscape', 'outdoors'], file_id: DEMO_COVER_LIBRARY_FILE });
});

test('database checks keep tags short, lower case and few, and small copies tied to verified cover uploads', async () => {
    const tag = (value: string) => db.query(`UPDATE cover_library SET tags=$1::jsonb WHERE organization_id=$2 AND id='library_mountain'`, [value, ORG]);
    for (const bad of ['["Upper"]', '["a","b","c","d","e","f"]', `["${'x'.repeat(25)}"]`, '["a,b"]', '[" lead"]', '[1]', '{"tag":"x"}', '"x"'])
        await assert.rejects(() => tag(bad), /check constraint/, bad);
    await tag('["café","night sky"]'); await tag('["landscape","outdoors"]');
    const insert = (values: string) => db.query(`INSERT INTO upload_intents(organization_id,id,user_id,object_key,content_type,size_bytes,original_name,created_at,status,purpose,completed_at,generation,cover_track_id,thumbnail_object_key,thumbnail_content_type,thumbnail_size_bytes,thumbnail_generation) VALUES ${values}`);
    const row = (id: string, status: string, purpose: string, thumb: string, gen = 'NULL', track = "'track_story'") => `('${ORG}','${id}','member_amina','k-${id}','image/png',10,'c',now(),'${status}','${purpose}',${status === 'ready' ? "now(),'5'" : 'NULL,NULL'},${purpose === 'cover_image' ? track : 'NULL'},${thumb},${gen})`;
    await assert.rejects(() => insert(row('t1', 'pending', 'member', "'k-t1-thumb','image/webp',100")), /check constraint/, 'only covers and library pictures');
    await assert.rejects(() => insert(row('t2', 'pending', 'cover_image', "'k-t2-thumb',NULL,100")), /check constraint/, 'all or nothing');
    await assert.rejects(() => insert(row('t3', 'pending', 'cover_image', "'k-t3-thumb','image/gif',100")), /check constraint/, 'images only');
    await assert.rejects(() => insert(row('t4', 'pending', 'cover_image', "'k-t4-thumb','image/webp',300000")), /check constraint/, 'at most 256 KB');
    await assert.rejects(() => insert(row('t5', 'ready', 'cover_image', "'k-t5-thumb','image/webp',100")), /check constraint/, 'a ready upload keeps a small copy only once verified');
    await assert.rejects(() => insert(row('t6', 'pending', 'cover_image', "'k-t6-thumb','image/webp',100", "'9'")), /check constraint/, 'no generation before verification');
    await insert(row('t7', 'ready', 'cover_image', "'k-t7-thumb','image/webp',100", "'9'"));
    await insert(row('t8', 'pending', 'cover_library', "'k-t8-thumb','image/webp',100"));
    await assert.rejects(() => insert(row('t9', 'pending', 'cover_image', "'k-t7-thumb','image/webp',100")), /duplicate key/, 'one record per stored copy');
    await db.query("DELETE FROM upload_intents WHERE id IN ('t7','t8')");
});

test('through the restricted role a cover keeps its verified small copy, which the thumbnail read returns', async () => {
    const key = (org: string, id: string) => `organisations/${org}/covers/tracks/track_story/${id}.png`, thumbKey = (org: string, id: string) => `organisations/${org}/covers/tracks/track_story/${id}-thumb.webp`;
    const { upload } = await repo.beginCoverUpload('code-black', DEMO_ADMIN, { purpose: 'cover_image', subject: 'track', subjectId: 'track_story', contentType: 'image/png', sizeBytes: 4096, thumbnail: { contentType: 'image/webp', sizeBytes: 2048 } }, key, 'library-management-db', thumbKey);
    assert.equal(upload.thumbnailObjectKey, thumbKey(ORG, upload.id));
    const observed = {
        sizeBytes: 4096, contentType: 'image/png', generation: '1712345678905678', bytesAcceptable: coverBytesAcceptable('image/png', pngHeader(1600, 900)),
        thumbnail: { sizeBytes: 2048, contentType: 'image/webp', generation: '1712345678905679', bytesAcceptable: coverThumbnailAcceptable('image/webp', webpHeader(480, 270), { width: 1600, height: 900 }) },
    };
    const done = await repo.completeCoverUpload('code-black', DEMO_ADMIN, upload.id, observed, 'library-management-db');
    assert.equal(done.outcome, 'ready'); assert.deepEqual(done.discarded, []);
    assert.deepEqual((await db.query('SELECT thumbnail_object_key,thumbnail_content_type,thumbnail_size_bytes,thumbnail_generation FROM upload_intents WHERE id=$1', [upload.id])).rows[0],
        { thumbnail_object_key: thumbKey(ORG, upload.id), thumbnail_content_type: 'image/webp', thumbnail_size_bytes: 2048, thumbnail_generation: '1712345678905679' });
    await repo.execute('code-black', DEMO_ADMIN, { type: 'track.cover.set', trackId: 'track_story', fileId: upload.id, focusX: 50, focusY: 50 }, 'library-management-key-1', 'library-management-db');
    assert.deepEqual(await repo.coverImage('code-black', DEMO_USER, 'track', 'track_story', upload.id, 'thumbnail'), { objectKey: thumbKey(ORG, upload.id), generation: '1712345678905679', contentType: 'image/webp', sizeBytes: 2048 });
    assert.equal((await repo.coverImage('code-black', DEMO_USER, 'track', 'track_story', upload.id)).objectKey, key(ORG, upload.id));
    await assert.rejects(() => repo.coverImage('studio-north', DEMO_ADMIN, 'track', 'track_story', upload.id, 'thumbnail'), { code: 'NOT_FOUND' });
    assert.equal((await repo.coverLibraryPicture('code-black', DEMO_USER, 'library_mountain', 'thumbnail')).objectKey, (await repo.coverLibraryPicture('code-black', DEMO_USER, 'library_mountain')).objectKey, 'a picture without a small copy is served in full');
    const { result, releasedFiles } = await repo.executeCommand('code-black', DEMO_ADMIN, { type: 'track.cover.set', trackId: 'track_story', fileId: null }, 'library-management-key-2', 'library-management-db');
    assert(result.message);
    assert.deepEqual(releasedFiles, [key(ORG, upload.id), thumbKey(ORG, upload.id)], 'both stored files are released together');
});
