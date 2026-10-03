import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { openDatabase, type Database, type SQL } from '../packages/db/src/connection';
import { migrate } from '../packages/db/src/migrate';
import { WorkspaceRepository, setContext } from '../packages/db/src/repository';
import { grantRuntimeTables } from '../packages/db/src/runtime-role';
import { createSeed, DEMO_ADMIN, DEMO_USER } from '../packages/domain/src/seed';
import { lessonContent } from '../packages/domain/src/authoring';
import { DEMO_WORKSHEET_FILE } from '../packages/domain/src/demo-files';
import { fileSignatureMatches } from '../packages/contracts/src/lesson-resources';
import { seedBeforeProjectWork } from './helpers/legacy-fixture';
import { MIGRATION_COUNT } from './helpers/migrations';

let db: Database, repo: WorkspaceRepository;
const PDF = 'application/pdf' as const, bytes = new TextEncoder().encode('%PDF-1.4\n% fictional database test\n');
const key = (org: string, id: string) => `organisations/${org}/lesson-resources/track_product/${id}.pdf`;
const observed = { sizeBytes: bytes.length, contentType: PDF, generation: '1712345678901234', signatureMatches: fileSignatureMatches(PDF, bytes) };
const request = (name: string) => ({ purpose: 'lesson_resource' as const, trackId: 'track_product', name, contentType: PDF, sizeBytes: bytes.length });
const exec = (cmd: unknown, user = DEMO_ADMIN) => repo.execute('code-black', user, cmd, randomUUID(), 'resources-db');
async function verifiedUpload(name: string) {
    const { upload } = await repo.beginResourceUpload('code-black', DEMO_ADMIN, request(name), key, 'resources-db');
    const done = await repo.completeResourceUpload('code-black', DEMO_ADMIN, upload.id, observed, 'resources-db');
    assert.equal(done.outcome, 'ready');
    return upload.id;
}
const as = <T>(user: string, org: string, fn: (tx: SQL) => Promise<T>) => db.transaction(async tx => { await tx.query('SET LOCAL ROLE reunir_app'); await setContext(tx, org, user); return fn(tx); });
const lessonFiles = (tx: SQL) => tx.query<{ id: string }>("SELECT id FROM upload_intents WHERE purpose='lesson_resource' ORDER BY id").then(r => r.rows.map(x => x.id));
let published = '', draftOnly = '', pending = '';

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

test('0009 upgrade keeps lessons, drafts, history, completions and member uploads exactly as they were', async () => {
    const old = await openDatabase('pglite:memory');
    try {
        await migrate(old, '0008'); await seedBeforeProjectWork(old);
        await old.query("INSERT INTO lesson_drafts VALUES('legacy_draft','org_code_black',now(),'track_product','lesson_4','Draft title','Draft summary','Draft body',5,'',2,1,false,'member_amina','member_amina',now(),NULL)");
        await old.query("INSERT INTO lesson_revisions VALUES('legacy_revision','org_code_black',now(),'track_product','lesson_4','legacy_draft','Old title','Old summary','Old body',5,'',1,'captured','member_amina',NULL)");
        await old.query("INSERT INTO upload_intents VALUES('org_code_black','legacy_upload','member_alex','organisations/org_code_black/members/member_alex/legacy.pdf','application/pdf',100,'proof.pdf',now(),'ready')");
        const read = async (table: string) => (await old.query(`SELECT * FROM ${table} ORDER BY organization_id,id`)).rows;
        const before = { lessons: await read('lessons'), drafts: await read('lesson_drafts'), revisions: await read('lesson_revisions'), completions: await read('completions'), uploads: await read('upload_intents') };
        await migrate(old); await migrate(old);
        const strip = (rows: Record<string, unknown>[], extra: string[]) => rows.map(r => Object.fromEntries(Object.entries(r).filter(([k]) => !extra.includes(k))));
        for (const [table, rows] of [['lessons', before.lessons], ['lesson_drafts', before.drafts], ['lesson_revisions', before.revisions]] as const) {
            const now = await read(table);
            assert.deepEqual(strip(now, ['resources', 'quiz']), rows, table);
            assert(now.every(r => r.resources === null && r.quiz === null), table);
        }
        assert.deepEqual(await read('completions'), before.completions);
        const uploads = await read('upload_intents');
        const thumbnail = ['thumbnail_object_key', 'thumbnail_content_type', 'thumbnail_size_bytes', 'thumbnail_generation'];
        assert.deepEqual(strip(uploads, ['purpose', 'track_id', 'completed_at', 'generation', 'cover_track_id', 'cover_project_id', 'task_id', ...thumbnail]), before.uploads);
        assert.deepEqual(uploads.map(u => [u.purpose, u.track_id, u.completed_at, u.generation]), [['member', null, null, null]]);
        assert(uploads.every(u => thumbnail.every(k => u[k] === null)), 'member uploads gain no small copy');
        assert.equal((await old.query('SELECT version FROM schema_migrations')).rows.length, MIGRATION_COUNT);
    } finally { await old.close(); }
});
test('the restricted runtime role records, verifies, attaches and publishes a lesson file', async () => {
    const { upload } = await repo.beginResourceUpload('code-black', DEMO_ADMIN, request('Interview guide.pdf'), key, 'resources-db');
    assert.equal(upload.objectKey, key('org_code_black', upload.id));
    assert.equal((await db.query("SELECT status FROM upload_intents WHERE id=$1", [upload.id])).rows[0].status, 'pending');
    assert.equal((await repo.completeResourceUpload('code-black', DEMO_ADMIN, upload.id, observed, 'resources-db')).outcome, 'ready');
    const row = (await db.query<{ status: string; generation: string; completed_at: Date }>('SELECT status,generation,completed_at FROM upload_intents WHERE id=$1', [upload.id])).rows[0];
    assert.equal(row.status, 'ready'); assert.equal(row.generation, '1712345678901234'); assert(row.completed_at);
    published = upload.id;
    let r = await exec({ type: 'lesson.draft.create', trackId: 'track_product', lessonId: 'lesson_4' }), d = r.workspace.lessonDrafts[0];
    r = await exec({ type: 'lesson.draft.save', draftId: d.id, expectedVersion: d.version, ...lessonContent(d), resources: [...lessonContent(d).resources, { id: 'resource_guide', fileId: upload.id, name: 'Interview guide', description: 'Questions for the first conversation.' }] });
    d = r.workspace.lessonDrafts[0];
    assert.deepEqual(d.resources!.map(x => x.fileId), [DEMO_WORKSHEET_FILE, upload.id]);
    const memberBefore = await repo.snapshot('code-black', DEMO_USER);
    assert.deepEqual(memberBefore.lessons.find(l => l.id === 'lesson_4')!.resources!.map(x => x.fileId), [DEMO_WORKSHEET_FILE]);
    assert(!JSON.stringify(memberBefore).includes('Interview guide'));
    await assert.rejects(() => repo.resourceDownload('code-black', DEMO_USER, { context: 'lesson', recordId: 'lesson_4', resourceId: 'resource_guide' }), { code: 'NOT_FOUND' });
    r = await exec({ type: 'lesson.draft.publish', draftId: d.id, expectedVersion: d.version });
    const member = await repo.snapshot('code-black', DEMO_USER);
    assert.deepEqual(member.lessons.find(l => l.id === 'lesson_4')!.resources!.map(x => x.name), ['Problem interview worksheet', 'Interview guide']);
    assert.deepEqual(member.uploads, []);
    const target = await repo.resourceDownload('code-black', DEMO_USER, { context: 'lesson', recordId: 'lesson_4', resourceId: 'resource_guide' });
    assert.deepEqual(target, { objectKey: key('org_code_black', upload.id), generation: '1712345678901234', contentType: PDF, filename: 'Interview guide.pdf' });
    await assert.rejects(() => repo.resourceDownload('code-black', DEMO_USER, { context: 'draft', recordId: d.id, resourceId: 'resource_guide' }), { code: 'NOT_FOUND' });
    await assert.rejects(() => repo.resourceDownload('studio-north', DEMO_USER, { context: 'lesson', recordId: 'lesson_4', resourceId: 'resource_guide' }), { code: 'NOT_FOUND' });
    assert.equal((await repo.resourceDownload('code-black', DEMO_ADMIN, { context: 'revision', recordId: r.workspace.lessonRevisions.at(-1)!.id, resourceId: 'resource_guide' })).filename, 'Interview guide.pdf');
    const admin = await repo.snapshot('code-black', DEMO_ADMIN);
    assert(admin.uploads.some(u => u.id === upload.id) && admin.uploads.every(u => u.objectKey === '' && u.generation === null));
});
test('forced RLS shows members only files that a published lesson references', async () => {
    draftOnly = await verifiedUpload('Draft only.pdf');
    const d = (await repo.snapshot('code-black', DEMO_ADMIN)).lessonDrafts[0];
    await exec({ type: 'lesson.draft.save', draftId: d.id, expectedVersion: d.version, ...lessonContent(d), resources: [...lessonContent(d).resources, { id: 'resource_draft_only', fileId: draftOnly, name: 'Draft only' }] });
    pending = (await repo.beginResourceUpload('code-black', DEMO_ADMIN, request('Pending.pdf'), key, 'resources-db')).upload.id;
    await as(DEMO_USER, 'org_code_black', async tx => assert.deepEqual(await lessonFiles(tx), [DEMO_WORKSHEET_FILE, published].sort()));
    await as(DEMO_ADMIN, 'org_code_black', async tx => assert.deepEqual(await lessonFiles(tx), [DEMO_WORKSHEET_FILE, published, draftOnly, pending].sort()));
    await as(DEMO_ADMIN, 'org_studio_north', async tx => assert.deepEqual(await lessonFiles(tx), []));
    await as('', '', async tx => assert.deepEqual(await lessonFiles(tx), []));
    await db.query("UPDATE members SET role='member' WHERE organization_id='org_code_black' AND user_id='member_maya'");
    await as('member_maya', 'org_code_black', async tx => assert(!(await lessonFiles(tx)).includes(draftOnly)));
    await db.query("UPDATE members SET status='suspended' WHERE organization_id='org_code_black' AND user_id=$1", [DEMO_ADMIN]);
    try { await as(DEMO_ADMIN, 'org_code_black', async tx => assert(!(await lessonFiles(tx)).includes(draftOnly))); }
    finally { await db.query("UPDATE members SET status='active' WHERE organization_id='org_code_black' AND user_id=$1", [DEMO_ADMIN]); }
});
test('database constraints keep lesson files scoped, verified and bounded', async () => {
    const insert = (values: string) => db.query(`INSERT INTO upload_intents(organization_id,id,user_id,object_key,content_type,size_bytes,original_name,created_at,status,purpose,track_id,completed_at,generation) VALUES ${values}`);
    await assert.rejects(() => insert("('org_code_black','c1','member_amina','k-c1','application/pdf',10,'a.pdf',now(),'pending','lesson_resource',NULL,NULL,NULL)"));
    await assert.rejects(() => insert("('org_code_black','c2','member_amina','k-c2','application/pdf',10,'a.pdf',now(),'ready','lesson_resource','track_product',now(),NULL)"));
    await assert.rejects(() => insert("('org_code_black','c3','member_amina','k-c3','application/pdf',10,'a.pdf',now(),'pending','lesson_resource','track_missing',NULL,NULL)"));
    await assert.rejects(() => insert("('org_code_black','c4','member_amina','k-c4','application/pdf',10,'a.pdf',now(),'ready','lesson_resource','track_product',now(),'abc')"));
    await assert.rejects(() => insert("('org_code_black','c5','member_amina','k-c5','application/pdf',10,'a.pdf',now(),'pending','member','track_product',NULL,NULL)"));
    const many = JSON.stringify(Array.from({ length: 13 }, (_, i) => ({ id: 'r' + i, fileId: 'f' + i, name: 'n', description: '', contentType: PDF, sizeBytes: 1 })));
    await assert.rejects(() => db.query("UPDATE lessons SET resources=$1::jsonb WHERE organization_id='org_code_black' AND id='lesson_4'", [many]));
    await assert.rejects(() => db.query(`UPDATE lessons SET resources='{"not":"an array"}'::jsonb WHERE organization_id='org_code_black' AND id='lesson_4'`));
});
test('the runtime role cannot rewrite the files recorded in revision history', async () => {
    assert.equal((await db.query<{ ok: boolean }>("SELECT has_table_privilege('reunir_app','lesson_revisions','UPDATE') AS ok")).rows[0].ok, false);
    await assert.rejects(() => as(DEMO_ADMIN, 'org_code_black', tx => tx.query("UPDATE lesson_revisions SET resources='[]'::jsonb")));
    await assert.rejects(() => as(DEMO_ADMIN, 'org_code_black', tx => tx.query('DELETE FROM lesson_revisions')));
});
test('discard removes only unreferenced uploads, inside the same tenant', async () => {
    await assert.rejects(() => repo.discardResourceUpload('code-black', DEMO_ADMIN, published, 'resources-db'), { code: 'RESOURCE_IN_USE' });
    await assert.rejects(() => repo.discardResourceUpload('code-black', DEMO_ADMIN, draftOnly, 'resources-db'), { code: 'RESOURCE_IN_USE' });
    await assert.rejects(() => repo.discardResourceUpload('studio-north', DEMO_ADMIN, pending, 'resources-db'), { code: 'NOT_FOUND' });
    await assert.rejects(() => repo.discardResourceUpload('code-black', DEMO_USER, pending, 'resources-db'), { code: 'AUTHOR_REQUIRED' });
    const r = await repo.discardResourceUpload('code-black', DEMO_ADMIN, pending, 'resources-db');
    assert.equal(r.objectKey, key('org_code_black', pending));
    assert.equal((await db.query('SELECT 1 FROM upload_intents WHERE id=$1', [pending])).rows.length, 0);
});
test('member-private uploads keep their original behaviour and never enter lesson workspaces', async () => {
    await repo.createUploadIntent('code-black', DEMO_USER, { id: 'member_proof', objectKey: 'organisations/org_code_black/members/member_alex/member_proof.pdf', contentType: PDF, sizeBytes: 50, originalName: 'proof.pdf' });
    await repo.markUpload('code-black', DEMO_USER, 'member_proof', 'ready');
    assert.equal((await repo.uploadIntent('code-black', DEMO_USER, 'member_proof')).purpose, 'member');
    await assert.rejects(() => repo.markUpload('code-black', DEMO_ADMIN, published, 'rejected'), { code: 'NOT_FOUND' });
    assert(!(await repo.snapshot('code-black', DEMO_ADMIN)).uploads.some(u => u.id === 'member_proof'));
    const d = (await repo.snapshot('code-black', DEMO_ADMIN)).lessonDrafts[0];
    await assert.rejects(() => exec({ type: 'lesson.draft.save', draftId: d.id, expectedVersion: d.version, ...lessonContent(d), resources: [{ id: 'proof', fileId: 'member_proof', name: 'Borrowed proof' }] }), { code: 'RESOURCE_UNAVAILABLE' });
});
