import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { openDatabase, type Database, type SQL } from '../packages/db/src/connection';
import { migrate } from '../packages/db/src/migrate';
import { WorkspaceRepository, setContext } from '../packages/db/src/repository';
import { grantRuntimeTables } from '../packages/db/src/runtime-role';
import { createSeed, DEMO_ADMIN, DEMO_USER } from '../packages/domain/src/seed';
import { coverBytesAcceptable } from '../packages/contracts/src/covers';
import { seedBeforeProjectWork } from './helpers/legacy-fixture';
import { pngHeader } from './helpers/images';
import { MIGRATION_COUNT } from './helpers/migrations';

let db: Database, repo: WorkspaceRepository;
const png = pngHeader(1600, 900);
const observed = { sizeBytes: 4096, contentType: 'image/png', generation: '1712345678905678', bytesAcceptable: coverBytesAcceptable('image/png', png) };
const key = (subject: string, id: string) => (org: string, upload: string) => `organisations/${org}/covers/${subject}s/${id}/${upload}.png`;
const request = (subject: 'track' | 'project', subjectId: string) => ({ purpose: 'cover_image' as const, subject, subjectId, contentType: 'image/png' as const, sizeBytes: 4096 });
const exec = (cmd: unknown, user = DEMO_ADMIN) => repo.execute('code-black', user, cmd, randomUUID(), 'covers-db');
async function verified(user: string, subject: 'track' | 'project', subjectId: string) {
    const { upload } = await repo.beginCoverUpload('code-black', user, request(subject, subjectId), key(subject, subjectId), 'covers-db');
    assert.equal((await repo.completeCoverUpload('code-black', user, upload.id, observed, 'covers-db')).outcome, 'ready');
    return upload.id;
}
const as = <T>(user: string, org: string, fn: (tx: SQL) => Promise<T>) => db.transaction(async tx => { await tx.query('SET LOCAL ROLE reunir_app'); await setContext(tx, org, user); return fn(tx); });
const coverRows = (tx: SQL) => tx.query<{ id: string }>("SELECT id FROM upload_intents WHERE purpose='cover_image' ORDER BY id").then(r => r.rows.map(x => x.id));
let trackCover = '', projectCover = '', unused = '';

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

test('0011 upgrade keeps tracks, projects and uploads exactly as they were and sets no covers', async () => {
    const old = await openDatabase('pglite:memory');
    try {
        await migrate(old, '0010'); await seedBeforeProjectWork(old);
        await old.query("INSERT INTO upload_intents(organization_id,id,user_id,object_key,content_type,size_bytes,original_name,created_at,status) VALUES('org_code_black','legacy_upload','member_alex','organisations/org_code_black/members/member_alex/legacy.pdf','application/pdf',100,'proof.pdf',now(),'ready')");
        const read = async (table: string) => (await old.query(`SELECT * FROM ${table} ORDER BY organization_id,id`)).rows;
        const before = { tracks: await read('tracks'), projects: await read('projects'), uploads: await read('upload_intents') };
        await migrate(old); await migrate(old);
        const strip = (rows: Record<string, unknown>[], extra: string[]) => rows.map(r => Object.fromEntries(Object.entries(r).filter(([k]) => !extra.includes(k))));
        for (const table of ['tracks', 'projects'] as const) {
            const now = await read(table);
            assert.deepEqual(strip(now, ['cover_image']), before[table], table);
            assert(now.every(r => r.cover_image === null), table);
        }
        const uploads = await read('upload_intents');
        assert.deepEqual(strip(uploads, ['cover_track_id', 'cover_project_id']), before.uploads);
        assert.deepEqual(uploads.map(u => [u.purpose, u.cover_track_id, u.cover_project_id]), [['member', null, null]]);
        assert.equal((await old.query('SELECT version FROM schema_migrations')).rows.length, MIGRATION_COUNT);
    } finally { await old.close(); }
});
test('the restricted runtime role records, verifies and sets a track cover and a project owner’s cover', async () => {
    trackCover = await verified(DEMO_ADMIN, 'track', 'track_story');
    const row = (await db.query<{ status: string; generation: string; cover_track_id: string; track_id: string | null; object_key: string }>('SELECT status,generation,cover_track_id,track_id,object_key FROM upload_intents WHERE id=$1', [trackCover])).rows[0];
    assert.deepEqual([row.status, row.generation, row.cover_track_id, row.track_id], ['ready', observed.generation, 'track_story', null]);
    assert.equal(row.object_key, `organisations/org_code_black/covers/tracks/track_story/${trackCover}.png`);
    await exec({ type: 'track.cover.set', trackId: 'track_story', fileId: trackCover, focusX: 40, focusY: 60 });
    const stored = (await db.query<{ cover_image: unknown }>("SELECT cover_image FROM tracks WHERE organization_id='org_code_black' AND id='track_story'")).rows[0].cover_image;
    assert.deepEqual(stored, { fileId: trackCover, contentType: 'image/png', sizeBytes: 4096, focusX: 40, focusY: 60 });
    projectCover = await verified('member_jordan', 'project', 'project_still');
    await exec({ type: 'project.cover.set', projectId: 'project_still', fileId: projectCover }, 'member_jordan');
    const member = await repo.snapshot('code-black', DEMO_USER);
    assert.equal(member.tracks.find(t => t.id === 'track_story')!.coverImage!.fileId, trackCover);
    assert.equal(member.projects.find(p => p.id === 'project_still')!.coverImage!.fileId, projectCover);
    assert.deepEqual(member.uploads, [], 'members never receive upload records');
    assert.deepEqual(await repo.coverImage('code-black', DEMO_USER, 'track', 'track_story', trackCover), { objectKey: row.object_key, generation: observed.generation, contentType: 'image/png', sizeBytes: 4096 });
    await assert.rejects(() => repo.coverImage('studio-north', DEMO_USER, 'track', 'track_story', trackCover), { code: 'NOT_FOUND' });
    await assert.rejects(() => exec({ type: 'project.cover.set', projectId: 'project_still', fileId: null }, DEMO_USER), { code: 'COVER_EDITOR_REQUIRED' });
});
test('forced RLS shows members only covers that a published track or a project displays', async () => {
    unused = await verified(DEMO_ADMIN, 'track', 'track_product');
    await as(DEMO_USER, 'org_code_black', async tx => assert.deepEqual(await coverRows(tx), [trackCover, projectCover].sort()));
    await as('member_jordan', 'org_code_black', async tx => assert.deepEqual(await coverRows(tx), [trackCover, projectCover].sort(), 'an uploader sees their own'));
    await as(DEMO_ADMIN, 'org_code_black', async tx => assert.deepEqual(await coverRows(tx), [trackCover, projectCover, unused].sort()));
    await as(DEMO_ADMIN, 'org_studio_north', async tx => assert.deepEqual(await coverRows(tx), []));
    await as('', '', async tx => assert.deepEqual(await coverRows(tx), []));
    await db.query("UPDATE tracks SET published=false WHERE organization_id='org_code_black' AND id='track_story'");
    try { await as(DEMO_USER, 'org_code_black', async tx => assert.deepEqual(await coverRows(tx), [projectCover])); }
    finally { await db.query("UPDATE tracks SET published=true WHERE organization_id='org_code_black' AND id='track_story'"); }
    await db.query("UPDATE members SET status='suspended' WHERE organization_id='org_code_black' AND user_id=$1", [DEMO_ADMIN]);
    try { await as(DEMO_ADMIN, 'org_code_black', async tx => assert(!(await coverRows(tx)).includes(unused), 'an inactive administrator sees no unused cover')); }
    finally { await db.query("UPDATE members SET status='active' WHERE organization_id='org_code_black' AND user_id=$1", [DEMO_ADMIN]); }
});
test('database constraints keep cover uploads scoped, verified and bounded', async () => {
    const insert = (values: string) => db.query(`INSERT INTO upload_intents(organization_id,id,user_id,object_key,content_type,size_bytes,original_name,created_at,status,purpose,track_id,completed_at,generation,cover_track_id,cover_project_id) VALUES ${values}`);
    await assert.rejects(() => insert("('org_code_black','k1','member_amina','k-k1','image/png',10,'c',now(),'pending','cover_image',NULL,NULL,NULL,NULL,NULL)"), 'a cover names its subject');
    await assert.rejects(() => insert("('org_code_black','k2','member_amina','k-k2','image/png',10,'c',now(),'pending','cover_image',NULL,NULL,NULL,'track_story','project_still')"), 'only one subject');
    await assert.rejects(() => insert("('org_code_black','k3','member_amina','k-k3','image/png',10,'c',now(),'ready','cover_image',NULL,now(),NULL,'track_story',NULL)"), 'ready needs a generation');
    await assert.rejects(() => insert("('org_code_black','k4','member_amina','k-k4','image/png',4000000,'c',now(),'pending','cover_image',NULL,NULL,NULL,'track_story',NULL)"), 'at most 3 MB');
    await assert.rejects(() => insert("('org_code_black','k5','member_amina','k-k5','image/png',10,'c',now(),'pending','cover_image',NULL,NULL,NULL,'track_missing',NULL)"), 'the track must exist');
    await assert.rejects(() => insert("('org_code_black','k6','member_amina','k-k6','image/png',10,'c',now(),'pending','member',NULL,NULL,NULL,'track_story',NULL)"), 'member files have no cover subject');
    await assert.rejects(() => insert("('org_code_black','k7','member_amina','k-k7','image/png',10,'c',now(),'pending','avatar',NULL,NULL,NULL,NULL,NULL)"), 'unknown purposes stay refused');
    await assert.rejects(() => db.query(`UPDATE tracks SET cover_image='[1,2]'::jsonb WHERE organization_id='org_code_black' AND id='track_story'`));
    await assert.rejects(() => db.query("UPDATE projects SET cover_image=$1::jsonb WHERE organization_id='org_code_black' AND id='project_still'", [JSON.stringify({ fileId: 'x'.repeat(1200) })]));
});
test('runtime grants cover the new columns without new privileges elsewhere', async () => {
    for (const [table, column] of [['tracks', 'cover_image'], ['projects', 'cover_image'], ['upload_intents', 'cover_track_id'], ['upload_intents', 'cover_project_id']])
        assert.equal((await db.query<{ ok: boolean }>("SELECT has_column_privilege('reunir_app',$1,$2,'SELECT,INSERT,UPDATE') AS ok", [table, column])).rows[0].ok, true, `${table}.${column}`);
    assert.equal((await db.query<{ ok: boolean }>("SELECT has_table_privilege('reunir_app','lesson_revisions','UPDATE') AS ok")).rows[0].ok, false);
});
test('a replaced cover’s record goes with the change under the runtime role, and its stored file is handed back for removal', async () => {
    // Jordan owns project_still; a project owner replaces their own cover, which nobody else shows.
    const first = await verified('member_jordan', 'project', 'project_still');
    await repo.execute('code-black', 'member_jordan', { type: 'project.cover.set', projectId: 'project_still', fileId: first }, randomUUID(), 'covers-db');
    const second = await verified('member_jordan', 'project', 'project_still');
    const { releasedFiles } = await repo.executeCommand('code-black', 'member_jordan', { type: 'project.cover.set', projectId: 'project_still', fileId: second }, randomUUID(), 'covers-db');
    assert.deepEqual(releasedFiles, [key('project', 'project_still')('org_code_black', first)]);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM upload_intents WHERE id=$1', [first])).rows[0].n, 0, 'the replaced record is gone');
    const removed = await repo.executeCommand('code-black', 'member_jordan', { type: 'project.cover.set', projectId: 'project_still', fileId: null }, randomUUID(), 'covers-db');
    assert.deepEqual(removed.releasedFiles, [key('project', 'project_still')('org_code_black', second)]);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM upload_intents WHERE id=$1', [second])).rows[0].n, 0);
});

test('a long description in any script fits the stored cover’s size check under the runtime role', async () => {
    const id = await verified(DEMO_ADMIN, 'track', 'track_story');
    // 150 characters, each four bytes in UTF-8, or two once escaped: the stored object must stay under 1,000 bytes.
    const description = '🌄'.repeat(76) + '"\\'.repeat(37);
    assert.equal(Array.from(description).length, 150);
    await exec({ type: 'track.cover.set', trackId: 'track_story', fileId: id, focusX: 50, focusY: 50, description });
    const stored = (await db.query<{ cover_image: { description: string } }>("SELECT cover_image FROM tracks WHERE organization_id='org_code_black' AND id='track_story'")).rows[0].cover_image;
    assert.equal(stored.description, description);
    assert.equal((await repo.snapshot('code-black', DEMO_USER)).tracks.find(t => t.id === 'track_story')?.coverImage?.description, description);
});
