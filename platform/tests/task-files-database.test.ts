import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { openDatabase, type Database, type SQL } from '../packages/db/src/connection';
import { migrate } from '../packages/db/src/migrate';
import { WorkspaceRepository, setContext } from '../packages/db/src/repository';
import { grantRuntimeTables } from '../packages/db/src/runtime-role';
import { createSeed, DEMO_ADMIN, DEMO_USER } from '../packages/domain/src/seed';
import { fileSignatureMatches } from '../packages/contracts/src/lesson-resources';

const ORG = 'org_code_black', LEAD = 'member_idris', OUTSIDER = 'member_nia', PDF = 'application/pdf' as const;
const bytes = new TextEncoder().encode('%PDF-1.4\n% fictional task file\n');
const observed = { sizeBytes: bytes.length, contentType: PDF, generation: '1712345678905555', signatureMatches: fileSignatureMatches(PDF, bytes) };
const key = (org: string, project: string, id: string) => `organisations/${org}/task-files/${project}/${id}.pdf`;
const request = (name: string, taskId = 'task_test') => ({ purpose: 'task_file' as const, taskId, name, contentType: PDF, sizeBytes: bytes.length });
let db: Database, repo: WorkspaceRepository;
const as = <T>(user: string, org: string, fn: (tx: SQL) => Promise<T>, mark?: string) => db.transaction(async tx => {
    await tx.query('SET LOCAL ROLE reunir_app'); await setContext(tx, org, user);
    if (mark !== undefined) await tx.query("SELECT set_config('app.account_deletion',$1,true)", [mark]);
    return fn(tx);
});
const taskFiles = (tx: SQL) => tx.query<{ id: string }>("SELECT id FROM upload_intents WHERE purpose='task_file' ORDER BY id").then(r => r.rows.map(x => x.id));
const exec = (cmd: unknown, user = DEMO_USER) => repo.executeCommand('code-black', user, cmd, randomUUID(), 'task-files-db');
async function attached(user: string, name: string, taskId = 'task_test') {
    const { upload } = await repo.beginTaskFileUpload('code-black', user, request(name, taskId), key, 'task-files-db');
    assert.equal((await repo.completeTaskFileUpload('code-black', user, upload.id, observed, 'task-files-db')).outcome, 'ready');
    return upload.id;
}
let alexFile = '', leadFile = '', alexPending = '';

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

test('0029 upgrade keeps every task and upload as it was and adds only empty columns and four policies', async () => {
    const old = await openDatabase('pglite:memory');
    try {
        // Seeded without tasks and uploads, whose new columns the 0021 schema does not have, then given one of each by hand.
        await migrate(old, '0021'); await new WorkspaceRepository(old).seed({ ...createSeed(), projectTasks: [], taskNotes: [], uploads: [], coverLibrary: [], collections: [], collectionItems: [] });
        await old.query(`INSERT INTO project_tasks(id,organization_id,created_at,project_id,title,brief,criteria,assignee_id,due_on,priority,work_state,contribution_id,created_by,updated_at,version,archived) VALUES('legacy_task','${ORG}',now(),'project_common','Legacy task','Kept as it was.','["Done"]'::jsonb,'${DEMO_USER}',NULL,'normal','todo',NULL,'${LEAD}',now(),3,false)`);
        await old.query(`INSERT INTO upload_intents(organization_id,id,user_id,object_key,content_type,size_bytes,original_name,created_at,status) VALUES('${ORG}','legacy_upload','${DEMO_USER}','organisations/${ORG}/members/${DEMO_USER}/legacy.pdf','application/pdf',100,'proof.pdf',now(),'ready')`);
        const read = async (table: string) => (await old.query(`SELECT * FROM ${table} ORDER BY organization_id,id`)).rows;
        const before = { project_tasks: await read('project_tasks'), upload_intents: await read('upload_intents') };
        await migrate(old); await migrate(old);
        const tasks = await read('project_tasks'), uploads = await read('upload_intents');
        assert.deepEqual(tasks.map(({ updated_by, ...row }) => { assert.equal(updated_by, null); return row; }), before.project_tasks);
        assert.deepEqual(uploads.map(({ task_id, ...row }) => { assert.equal(task_id, null); return row; }), before.upload_intents);
        assert.deepEqual((await old.query("SELECT policyname,permissive,cmd FROM pg_policies WHERE tablename='upload_intents' AND policyname LIKE 'task_file_%' ORDER BY policyname")).rows, [
            { policyname: 'task_file_delete', permissive: 'RESTRICTIVE', cmd: 'DELETE' }, { policyname: 'task_file_insert', permissive: 'RESTRICTIVE', cmd: 'INSERT' },
            { policyname: 'task_file_read', permissive: 'RESTRICTIVE', cmd: 'SELECT' }, { policyname: 'task_file_update', permissive: 'RESTRICTIVE', cmd: 'UPDATE' }]);
        assert.equal((await old.query('SELECT version FROM schema_migrations')).rows.length, 24);
    } finally { await old.close(); }
});
test('through the restricted role, a teammate attaches a verified file the whole team can see', async () => {
    const { upload } = await repo.beginTaskFileUpload('code-black', DEMO_USER, request('Interview notes.pdf'), key, 'task-files-db');
    assert.equal(upload.objectKey, key(ORG, 'project_common', upload.id));
    assert.equal((await repo.completeTaskFileUpload('code-black', DEMO_USER, upload.id, observed, 'task-files-db')).outcome, 'ready');
    alexFile = upload.id;
    const row = (await db.query<{ status: string; generation: string; task_id: string }>('SELECT status,generation,task_id FROM upload_intents WHERE id=$1', [alexFile])).rows[0];
    assert.deepEqual([row.status, row.generation, row.task_id], ['ready', '1712345678905555', 'task_test']);
    leadFile = await attached(LEAD, 'Lead brief.pdf');
    for (const user of [DEMO_USER, LEAD, DEMO_ADMIN]) {
        const view = await repo.snapshot('code-black', user);
        assert.deepEqual(view.uploads.filter(u => u.purpose === 'task_file').map(u => u.id).sort(), [alexFile, leadFile].sort());
        assert(view.uploads.every(u => u.objectKey === '' && u.generation === null));
    }
    assert.deepEqual((await repo.snapshot('code-black', OUTSIDER)).uploads.filter(u => u.purpose === 'task_file'), []);
    const target = await repo.taskFileDownload('code-black', LEAD, 'task_test', alexFile);
    assert.deepEqual(target, { objectKey: key(ORG, 'project_common', alexFile), generation: '1712345678905555', contentType: PDF, filename: 'Interview notes.pdf' });
});
test('forced RLS: non-team members, other communities, missing context and suspended members read no task files', async () => {
    alexPending = (await repo.beginTaskFileUpload('code-black', DEMO_USER, request('Still uploading.pdf'), key, 'task-files-db')).upload.id;
    await as(DEMO_USER, ORG, async tx => assert.deepEqual(await taskFiles(tx), [alexFile, leadFile, alexPending].sort()));
    await as(LEAD, ORG, async tx => assert.deepEqual(await taskFiles(tx), [alexFile, leadFile].sort(), 'someone else’s unfinished upload stays private'));
    await as(DEMO_ADMIN, ORG, async tx => assert.deepEqual(await taskFiles(tx), [alexFile, leadFile, alexPending].sort()));
    await as(OUTSIDER, ORG, async tx => assert.deepEqual(await taskFiles(tx), []));
    await as(DEMO_USER, 'org_studio_north', async tx => assert.deepEqual(await taskFiles(tx), []));
    await as('', '', async tx => assert.deepEqual(await taskFiles(tx), []));
    await db.query("UPDATE members SET status='suspended' WHERE organization_id=$1 AND user_id=$2", [ORG, DEMO_USER]);
    try {
        await as(DEMO_USER, ORG, async tx => assert.deepEqual(await taskFiles(tx), []));
        await assert.rejects(() => repo.taskFileDownload('code-black', DEMO_USER, 'task_test', alexFile), { code: 'NOT_FOUND' });
    } finally { await db.query("UPDATE members SET status='active' WHERE organization_id=$1 AND user_id=$2", [ORG, DEMO_USER]); }
    await assert.rejects(() => repo.taskFileDownload('code-black', OUTSIDER, 'task_test', alexFile), { code: 'NOT_FOUND' });
    await assert.rejects(() => repo.taskFileDownload('studio-north', DEMO_USER, 'task_test', alexFile), { code: 'NOT_FOUND' });
    await assert.rejects(() => repo.beginTaskFileUpload('code-black', OUTSIDER, request('Not my team.pdf'), key, 'task-files-db'), { code: 'NOT_FOUND' });
});
test('forced RLS refuses task files started for someone else, outside the team or on an archived task', async () => {
    const insert = (tx: SQL, id: string, user: string, task: string) => tx.query(`INSERT INTO upload_intents(organization_id,id,user_id,object_key,content_type,size_bytes,original_name,created_at,status,purpose,task_id) VALUES($1,$2,$3,$4,'application/pdf',10,'a.pdf',now(),'pending','task_file',$5)`, [ORG, id, user, 'k-' + id, task]);
    await assert.rejects(() => as(OUTSIDER, ORG, tx => insert(tx, 'rls_outsider', OUTSIDER, 'task_test')));
    await assert.rejects(() => as(DEMO_USER, ORG, tx => insert(tx, 'rls_spoof', LEAD, 'task_test')));
    await db.query("UPDATE project_tasks SET archived=true WHERE organization_id=$1 AND id='task_flow'", [ORG]);
    try { await assert.rejects(() => as(DEMO_USER, ORG, tx => insert(tx, 'rls_archived', DEMO_USER, 'task_flow'))); }
    finally { await db.query("UPDATE project_tasks SET archived=false WHERE organization_id=$1 AND id='task_flow'", [ORG]); }
    await as(DEMO_USER, ORG, async tx => assert.equal((await tx.query("UPDATE upload_intents SET original_name='renamed' WHERE id=$1 RETURNING id", [leadFile])).rows.length, 0, 'only the uploader updates a task file'));
    await as(DEMO_USER, ORG, async tx => assert.equal((await tx.query('DELETE FROM upload_intents WHERE id=$1 RETURNING id', [leadFile])).rows.length, 0, 'a teammate cannot delete the lead’s file'));
    await as(OUTSIDER, ORG, async tx => assert.equal((await tx.query('DELETE FROM upload_intents WHERE id=$1 RETURNING id', [alexFile])).rows.length, 0));
});
test('database constraints keep task files bound to one task, verified and of their own purpose', async () => {
    const insert = (values: string) => db.query(`INSERT INTO upload_intents(organization_id,id,user_id,object_key,content_type,size_bytes,original_name,created_at,status,purpose,task_id,track_id,completed_at,generation) VALUES ${values}`);
    await assert.rejects(() => insert(`('${ORG}','t1','${DEMO_USER}','k-t1','application/pdf',10,'a.pdf',now(),'pending','task_file',NULL,NULL,NULL,NULL)`));
    await assert.rejects(() => insert(`('${ORG}','t2','${DEMO_USER}','k-t2','application/pdf',10,'a.pdf',now(),'ready','task_file','task_test',NULL,now(),NULL)`));
    await assert.rejects(() => insert(`('${ORG}','t3','${DEMO_USER}','k-t3','application/pdf',10,'a.pdf',now(),'pending','task_file','task_missing',NULL,NULL,NULL)`));
    await assert.rejects(() => insert(`('${ORG}','t4','${DEMO_USER}','k-t4','application/pdf',10,'a.pdf',now(),'pending','lesson_resource','task_test','track_product',NULL,NULL)`));
    await assert.rejects(() => db.query(`UPDATE project_tasks SET updated_by='member_unknown' WHERE organization_id='${ORG}' AND id='task_test'`));
});
test('the change fingerprint is readable only by the team and moves when the work does', async () => {
    const first = await repo.projectWorkVersion('code-black', DEMO_USER, 'project_common');
    assert.equal(await repo.projectWorkVersion('code-black', LEAD, 'project_common'), first);
    await assert.rejects(() => repo.projectWorkVersion('code-black', OUTSIDER, 'project_common'), { code: 'NOT_FOUND' });
    await assert.rejects(() => repo.projectWorkVersion('code-black', DEMO_USER, 'project_still'), { code: 'NOT_FOUND' }, 'another team’s project');
    await exec({ type: 'task.note', taskId: 'task_test', body: 'A note moves the fingerprint.' });
    assert.notEqual(await repo.projectWorkVersion('code-black', DEMO_USER, 'project_common'), first);
});
test('edits record who made them, and a stale version is refused', async () => {
    const t = (await repo.snapshot('code-black', LEAD)).projectTasks.find(x => x.id === 'task_empty')!;
    await exec({ type: 'task.edit', taskId: t.id, expectedVersion: t.version, title: 'Edited by the lead', brief: t.brief, criteria: t.criteria, assigneeId: null }, LEAD);
    assert.equal((await db.query<{ updated_by: string }>('SELECT updated_by FROM project_tasks WHERE organization_id=$1 AND id=$2', [ORG, t.id])).rows[0].updated_by, LEAD);
    await assert.rejects(() => exec({ type: 'task.edit', taskId: t.id, expectedVersion: t.version, title: 'Lost update', brief: t.brief, criteria: t.criteria, assigneeId: null }, DEMO_ADMIN), { code: 'STALE_TASK' });
    assert.equal((await repo.snapshot('code-black', LEAD)).projectTasks.find(x => x.id === t.id)!.title, 'Edited by the lead');
});
test('removing a file deletes its record in the change and hands back its storage key for after commit', async () => {
    await assert.rejects(() => exec({ type: 'task.file.remove', taskId: 'task_test', fileId: leadFile }), { code: 'PROJECT_LEAD_REQUIRED' });
    const extra = await attached(DEMO_USER, 'Remove me.pdf');
    const { releasedFiles } = await exec({ type: 'task.file.remove', taskId: 'task_test', fileId: extra }, LEAD);
    assert.deepEqual(releasedFiles, [key(ORG, 'project_common', extra)]);
    assert.equal((await db.query('SELECT 1 FROM upload_intents WHERE id=$1', [extra])).rows.length, 0);
});
test('deleting an account keeps its attached files as Former member work and removes its unfinished uploads', async () => {
    const now = new Date().toISOString();
    await db.query('INSERT INTO auth_user(id,name,email,email_verified,created_at,updated_at) VALUES($1,$2,$3,true,$4,$4)', [DEMO_USER, 'Alex Morgan', 'alex.task@example.test', now]);
    const { summary, files } = await repo.deleteAccount(DEMO_USER);
    assert.equal(summary.removed.taskFileUploads, 1);
    assert(files.includes(key(ORG, 'project_common', alexPending)));
    assert(!files.includes(key(ORG, 'project_common', alexFile)));
    assert.equal((await db.query('SELECT 1 FROM upload_intents WHERE id=$1', [alexPending])).rows.length, 0);
    assert.equal((await db.query<{ user_id: string }>('SELECT user_id FROM upload_intents WHERE id=$1', [alexFile])).rows[0].user_id, DEMO_USER);
    const lead = await repo.snapshot('code-black', LEAD);
    assert(lead.uploads.some(u => u.id === alexFile));
    assert.equal(lead.members.find(m => m.userId === DEMO_USER)!.name, 'Former member');
    assert.equal((await repo.taskFileDownload('code-black', LEAD, 'task_test', alexFile)).filename, 'Interview notes.pdf');
    const { releasedFiles } = await exec({ type: 'task.file.remove', taskId: 'task_test', fileId: alexFile }, LEAD);
    assert.deepEqual(releasedFiles, [key(ORG, 'project_common', alexFile)], 'the lead can still remove a former member’s file');
});
test('the operator prune lists stale task uploads under an owner’s authority only', async () => {
    const pending = (await repo.beginTaskFileUpload('code-black', LEAD, request('Never finished.pdf'), key, 'task-files-db')).upload.id;
    await db.query("UPDATE upload_intents SET created_at=now()-interval '2 hours' WHERE id=$1", [pending]);
    const operator = new WorkspaceRepository(db);
    const owner = (await db.query<{ user_id: string }>("SELECT user_id FROM members WHERE organization_id=$1 AND role='owner'", [ORG])).rows[0].user_id;
    assert.deepEqual((await operator.staleCoverUploads('code-black', owner)).filter(u => u.purpose === 'task_file').map(u => u.id), [pending]);
    await assert.rejects(() => operator.staleCoverUploads('code-black', LEAD), { code: 'OWNER_REQUIRED' });
    assert.deepEqual(await operator.removeStaleCoverUploads('code-black', owner, [pending, leadFile]), [pending]);
    assert.equal((await db.query('SELECT 1 FROM upload_intents WHERE id=$1', [leadFile])).rows.length, 1, 'attached files are never pruned');
});
