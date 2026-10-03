import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyCommand, visibleWorkspace } from '../packages/domain/src/engine';
import { createSeed, DEMO_ADMIN, DEMO_USER } from '../packages/domain/src/seed';
import { beginTaskFileUpload, completeTaskFileUpload, projectWorkVersion, releasedTaskFileKeys, resolveTaskFileDownload, staleTaskUploads, taskFiles } from '../packages/domain/src/task-files';
import { eraseFromCommunity } from '../packages/domain/src/account-deletion';
import { reliesOnAdministration } from '../packages/domain/src/administration';
import { taskFileUploadRequest, MAX_TASK_FILES } from '../packages/contracts/src/task-files';
import { commandSchema, type Workspace } from '../packages/contracts/src/index';

const ORG = 'org_code_black', LEAD = 'member_idris', OUTSIDER = 'member_nia', PDF = 'application/pdf';
const NOW = '2026-10-03T10:00:00.000Z';
const ctx = (userId = DEMO_USER, organizationId = ORG) => ({ organizationId, userId, requestId: 'task_files_test' });
const request = (extra: Record<string, unknown> = {}) => taskFileUploadRequest.parse({ purpose: 'task_file', taskId: 'task_test', name: 'interview notes.pdf', contentType: PDF, sizeBytes: 2048, ...extra });
let n = 0;
const keyFor = (id: string) => (projectId: string) => `organisations/${ORG}/task-files/${projectId}/${id}.pdf`;
function begin(s: Workspace, userId = DEMO_USER, extra: Record<string, unknown> = {}, now = NOW, options = {}) {
    const id = 'file_' + (++n);
    return beginTaskFileUpload(s, ctx(userId), request(extra), { id, objectKey: keyFor(id) }, now, () => 'evt_' + (++n), options);
}
const good = (sizeBytes = 2048) => ({ sizeBytes, contentType: PDF, generation: '1712345678900001', signatureMatches: true });
function attach(s: Workspace, userId = DEMO_USER, extra: Record<string, unknown> = {}) {
    const b = begin(s, userId, extra);
    const done = completeTaskFileUpload(b.workspace, ctx(userId), b.upload.id, good(b.upload.sizeBytes), NOW);
    return { workspace: done.workspace, id: b.upload.id, key: b.upload.objectKey, outcome: done.outcome };
}
const run = (s: Workspace, cmd: unknown, userId = DEMO_USER) => applyCommand(s, ctx(userId), cmd, () => NOW);

test('a team member starts a task-file upload scoped to the task and keyed under its project', () => {
    const b = begin(createSeed());
    assert.equal(b.upload.purpose, 'task_file');
    assert.equal(b.upload.taskId, 'task_test');
    assert.equal(b.upload.trackId, null);
    assert.equal(b.upload.status, 'pending');
    assert.equal(b.upload.objectKey, `organisations/${ORG}/task-files/project_common/${b.upload.id}.pdf`);
});
test('people who cannot work on the project cannot start one, and nothing reveals the task', () => {
    assert.throws(() => begin(createSeed(), OUTSIDER), { code: 'NOT_FOUND' });
    const suspended = createSeed(); suspended.members.find(m => m.userId === DEMO_USER)!.status = 'suspended';
    assert.throws(() => begin(suspended), { code: 'FORBIDDEN' });
    assert.throws(() => beginTaskFileUpload(createSeed(), ctx(DEMO_USER, 'org_studio_north'), request(), { id: 'x', objectKey: keyFor('x') }, NOW), { code: 'NOT_FOUND' });
    const privateSpace = createSeed(); privateSpace.projects.find(p => p.id === 'project_common')!.spaceId = 'space_studio';
    assert.throws(() => begin(privateSpace), { code: 'NOT_FOUND' });
});
test('archived tasks take no new files', () => {
    const s = createSeed(); s.projectTasks.find(t => t.id === 'task_test')!.archived = true;
    assert.throws(() => begin(s), { code: 'TASK_ARCHIVED' });
});
test('the request is bounded like lesson files: their types, 10 MB, and a plain filename', () => {
    assert.equal(taskFileUploadRequest.safeParse({ purpose: 'task_file', taskId: 'task_test', name: 'a.exe', contentType: 'application/x-msdownload', sizeBytes: 10 }).success, false);
    assert.equal(taskFileUploadRequest.safeParse({ purpose: 'task_file', taskId: 'task_test', name: 'big.pdf', contentType: PDF, sizeBytes: 10 * 1024 * 1024 + 1 }).success, false);
    assert.equal(taskFileUploadRequest.safeParse({ purpose: 'task_file', taskId: 'task_test', name: '../x.pdf', contentType: PDF, sizeBytes: 10 }).success, false);
    assert.equal(taskFileUploadRequest.safeParse({ purpose: 'task_file', taskId: 'task_test', name: 'x.pdf', contentType: PDF, sizeBytes: 10, objectKey: 'mine' }).success, false);
});
test('pending uploads per person and files per task are capped', () => {
    let s = createSeed();
    for (let i = 0; i < 5; i++) s = begin(s).workspace;
    assert.throws(() => begin(s), { code: 'UPLOADS_IN_PROGRESS' });
    s = createSeed();
    for (let i = 0; i < MAX_TASK_FILES; i++) s = attach(s).workspace;
    assert.equal(taskFiles(s, 'task_test').length, MAX_TASK_FILES);
    assert.throws(() => begin(s, LEAD), { code: 'TASK_FILE_LIMIT' });
});
test('the person’s own refused or expired uploads are pruned when they start another', () => {
    const first = begin(createSeed());
    const later = new Date(Date.parse(NOW) + 2 * 60 * 60 * 1000).toISOString();
    const next = begin(first.workspace, DEMO_USER, {}, later);
    assert.deepEqual(next.expired.map(x => x.id), [first.upload.id]);
    assert.equal(next.workspace.uploads.some(u => u.id === first.upload.id), false);
    assert.deepEqual(staleTaskUploads(first.workspace, ORG, later).map(u => u.id), [first.upload.id]);
});
test('verification accepts only the declared size, type, signature and a generation', () => {
    const b = begin(createSeed());
    const refused = completeTaskFileUpload(b.workspace, ctx(), b.upload.id, { ...good(), signatureMatches: false }, NOW);
    assert.equal(refused.outcome, 'rejected');
    assert.equal(refused.upload.generation, null);
    assert.throws(() => completeTaskFileUpload(b.workspace, ctx(LEAD), b.upload.id, good(), NOW), { code: 'NOT_FOUND' }, 'only the uploader completes it');
    const ok = completeTaskFileUpload(b.workspace, ctx(), b.upload.id, good(), NOW);
    assert.equal(ok.outcome, 'ready');
    assert.equal(ok.upload.generation, '1712345678900001');
    assert.equal(completeTaskFileUpload(ok.workspace, ctx(), b.upload.id, good(), NOW).outcome, 'unchanged');
});
test('verified files reach the project team and administrators only, without storage keys', () => {
    const { workspace, id } = attach(createSeed());
    for (const user of [DEMO_USER, LEAD, DEMO_ADMIN]) {
        const file = visibleWorkspace(workspace, ctx(user)).uploads.find(u => u.id === id)!;
        assert.equal(file.objectKey, '');
        assert.equal(file.generation, null);
    }
    assert.equal(visibleWorkspace(workspace, ctx(OUTSIDER)).uploads.some(u => u.id === id), false);
    const pending = begin(workspace);
    assert.equal(visibleWorkspace(pending.workspace, ctx(LEAD)).uploads.some(u => u.id === pending.upload.id), false, 'pending uploads stay with the server');
});
test('downloads are decided from current access: team now, the right task, a verified file', () => {
    const { workspace, id } = attach(createSeed());
    const target = resolveTaskFileDownload(workspace, ctx(LEAD), 'task_test', id);
    assert.equal(target.filename, 'interview notes.pdf');
    assert.throws(() => resolveTaskFileDownload(workspace, ctx(OUTSIDER), 'task_test', id), { code: 'NOT_FOUND' });
    assert.throws(() => resolveTaskFileDownload(workspace, ctx(DEMO_USER), 'task_empty', id), { code: 'NOT_FOUND' }, 'the file must belong to the named task');
    assert.throws(() => resolveTaskFileDownload(workspace, ctx(DEMO_USER, 'org_studio_north'), 'task_test', id), { code: 'NOT_FOUND' });
    const suspended = structuredClone(workspace); suspended.members.find(m => m.userId === DEMO_USER)!.status = 'suspended';
    assert.throws(() => resolveTaskFileDownload(suspended, ctx(DEMO_USER), 'task_test', id), { code: 'FORBIDDEN' });
    const leftTeam = structuredClone(workspace); leftTeam.projectMembers = leftTeam.projectMembers.filter(m => !(m.projectId === 'project_common' && m.userId === DEMO_USER));
    assert.throws(() => resolveTaskFileDownload(leftTeam, ctx(DEMO_USER), 'task_test', id), { code: 'NOT_FOUND' });
    const pending = begin(workspace);
    assert.throws(() => resolveTaskFileDownload(pending.workspace, ctx(DEMO_USER), 'task_test', pending.upload.id), { code: 'FILE_NOT_READY' });
});
test('the uploader or the project lead removes a file; the stored object is released after the change', () => {
    const { workspace, id, key } = attach(createSeed());
    assert.equal(commandSchema.safeParse({ type: 'task.file.remove', taskId: 'task_test', fileId: id, objectKey: key }).success, false);
    const other = attach(workspace, LEAD);
    assert.throws(() => run(other.workspace, { type: 'task.file.remove', taskId: 'task_test', fileId: other.id }), { code: 'PROJECT_LEAD_REQUIRED' });
    assert.throws(() => run(other.workspace, { type: 'task.file.remove', taskId: 'task_test', fileId: other.id }, OUTSIDER), { code: 'NOT_FOUND' });
    assert.throws(() => run(other.workspace, { type: 'task.file.remove', taskId: 'task_empty', fileId: other.id }, LEAD), { code: 'NOT_FOUND' });
    const mine = run(other.workspace, { type: 'task.file.remove', taskId: 'task_test', fileId: id });
    assert.deepEqual(releasedTaskFileKeys(other.workspace, mine.workspace), [key]);
    const byLead = run(mine.workspace, { type: 'task.file.remove', taskId: 'task_test', fileId: other.id }, LEAD);
    assert.deepEqual(releasedTaskFileKeys(mine.workspace, byLead.workspace), [other.key]);
    assert.equal(taskFiles(byLead.workspace, 'task_test').length, 0);
    assert(byLead.workspace.audit.some(a => a.action === 'task.file.remove' && a.objectId === other.id));
});
test('an administrator removing a teammate’s file relies on administration; the lead does not', () => {
    const { workspace, id } = attach(createSeed());
    assert.equal(reliesOnAdministration(workspace, ctx(DEMO_ADMIN), { type: 'task.file.remove', taskId: 'task_test', fileId: id }), true);
    assert.equal(reliesOnAdministration(workspace, ctx(LEAD), { type: 'task.file.remove', taskId: 'task_test', fileId: id }), false);
});
test('with two-step sign-in withheld, an administrator off the team cannot attach; team members still can', () => {
    assert.throws(() => begin(createSeed(), DEMO_ADMIN, {}, NOW, { administration: 'withheld' }), { code: 'TWO_FACTOR_REQUIRED' });
    assert.equal(begin(createSeed(), DEMO_ADMIN, {}, NOW, { administration: 'allowed' }).upload.userId, DEMO_ADMIN);
    assert.equal(begin(createSeed(), DEMO_USER, {}, NOW, { administration: 'withheld' }).upload.userId, DEMO_USER);
});
test('deleting an account keeps the files it attached as shared work and removes its unfinished uploads', () => {
    const { workspace, id } = attach(createSeed());
    const pending = begin(workspace);
    const erasure = eraseFromCommunity(pending.workspace, DEMO_USER, NOW);
    assert.deepEqual(erasure.unfinishedUploads, [{ id: pending.upload.id, objectKey: pending.upload.objectKey }]);
    assert.equal(erasure.workspace.uploads.some(u => u.id === pending.upload.id), false);
    const kept = erasure.workspace.uploads.find(u => u.id === id)!;
    assert.equal(kept.userId, DEMO_USER);
    const view = visibleWorkspace(erasure.workspace, ctx(LEAD));
    assert.equal(view.members.find(m => m.userId === DEMO_USER)!.name, 'Former member');
    assert(view.uploads.some(u => u.id === id));
    assert.throws(() => resolveTaskFileDownload(erasure.workspace, ctx(DEMO_USER), 'task_test', id), { code: 'FORBIDDEN' });
    const removed = run(erasure.workspace, { type: 'task.file.remove', taskId: 'task_test', fileId: id }, LEAD);
    assert.equal(taskFiles(removed.workspace, 'task_test').length, 0, 'the lead can still remove it');
});
test('task changes record who made them; a stale edit says someone else changed the task', () => {
    const s = createSeed(), t = s.projectTasks.find(x => x.id === 'task_test')!;
    const edited = run(s, { type: 'task.edit', taskId: t.id, expectedVersion: t.version, title: 'Edited by the lead', brief: t.brief, criteria: t.criteria, assigneeId: t.assigneeId }, LEAD);
    assert.equal(edited.workspace.projectTasks.find(x => x.id === t.id)!.updatedBy, LEAD);
    assert.throws(() => run(edited.workspace, { type: 'task.edit', taskId: t.id, expectedVersion: t.version, title: 'Mine', brief: t.brief, criteria: t.criteria, assigneeId: t.assigneeId }, DEMO_ADMIN), (e: { code: string; message: string }) => e.code === 'STALE_TASK' && /Someone else changed this task/.test(e.message));
    const erased = eraseFromCommunity(edited.workspace, DEMO_USER, NOW);
    assert.equal(erased.workspace.projectTasks.find(x => x.id === t.id)!.updatedBy, null, 'a task released by account deletion names no editor');
});
test('the project fingerprint moves with every visible change and only for people who can see the work', () => {
    const s = createSeed(), v = (w: Workspace, u = DEMO_USER) => projectWorkVersion(w, ctx(u), 'project_common');
    assert.equal(v(s), v(structuredClone(s)), 'stable');
    assert.equal(v(s), v(s, LEAD), 'the same for everyone on the team');
    const t = s.projectTasks.find(x => x.id === 'task_test')!;
    const changes = [
        run(s, { type: 'task.note', taskId: 'task_test', body: 'A new note.' }).workspace,
        run(s, { type: 'task.edit', taskId: t.id, expectedVersion: t.version, title: 'Retitled', brief: t.brief, criteria: t.criteria, assigneeId: t.assigneeId }, LEAD).workspace,
        run(s, { type: 'task.claim', taskId: 'task_empty', expectedVersion: 1 }).workspace,
        attach(s).workspace,
    ];
    for (const changed of changes) assert.notEqual(v(changed), v(s));
    assert.equal(v(begin(s).workspace), v(s), 'a pending upload is not yet visible work');
    const elsewhere = run(s, { type: 'post.create', spaceId: 'space_build', kind: 'update', title: '', body: 'Unrelated community post.' }).workspace;
    assert.equal(v(elsewhere), v(s), 'unrelated community activity does not wake the board');
    assert.throws(() => v(s, OUTSIDER), { code: 'NOT_FOUND' });
    assert.throws(() => projectWorkVersion(s, ctx(DEMO_USER), 'project_missing'), { code: 'NOT_FOUND' });
    assert.match(v(s), /^[0-9a-f]{16}$/);
});
