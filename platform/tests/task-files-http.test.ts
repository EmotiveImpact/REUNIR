import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { openDatabase, type Database } from '../packages/db/src/connection';
import { migrate } from '../packages/db/src/migrate';
import { WorkspaceRepository } from '../packages/db/src/repository';
import { createSeed, DEMO_ADMIN, DEMO_USER } from '../packages/domain/src/seed';
import { createApp } from '../apps/api/src/app';
import { taskFileObjectKey } from '../apps/api/src/storage';
import { FakeBucket } from './helpers/fake-bucket';
import { ScanQueue } from '../packages/db/src/scans';
import { scanWaitingUploads } from '../apps/api/src/scan-worker';
import { uploadCompletion } from '../apps/api/src/uploads';
import type { ScanSource } from '../apps/api/src/scanner';

const origin = 'https://reunir.test', base = '/api/organisations/code-black', PDF = 'application/pdf';
const LEAD = 'member_idris', OUTSIDER = 'member_nia';
const pdf = (text: string) => new TextEncoder().encode(`%PDF-1.4\n% ${text}\n`);
let db: Database, repo: WorkspaceRepository, app: ReturnType<typeof createApp>, bucket: FakeBucket;
let identity: { id: string; name: string; twoFactorEnabled?: boolean } | null = { id: DEMO_USER, name: 'Alex' };
const as = (id: string | null) => { identity = id ? { id, name: id } : null; };
const headers = (extra: Record<string, string> = {}) => ({ 'Content-Type': 'application/json', Origin: origin, 'Idempotency-Key': randomUUID(), ...extra });
const post = (path: string, body: unknown, target = app) => target.request(base + path, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
const get = (path: string, extra: Record<string, string> = {}, target = app) => target.request(base + path, { headers: extra });
const intent = (name: string, size: number, extra: Record<string, unknown> = {}, target = app) => post('/uploads', { purpose: 'task_file', taskId: 'task_test', name, contentType: PDF, sizeBytes: size, ...extra }, target);
async function attached(name: string, bytes = pdf(name)) {
    const r = await intent(name, bytes.length); assert.equal(r.status, 201);
    const { id } = await r.json(), key = bucket.policies.at(-1)!.key;
    bucket.put(key, bytes, PDF);
    const done = await post(`/uploads/${id}/complete`, {}); assert.equal(done.status, 200);
    return { id: id as string, key };
}
const task = async (id: string) => (await (await get('/workspace')).json()).projectTasks.find((t: { id: string }) => t.id === id);

before(async () => {
    db = await openDatabase('pglite:memory'); await migrate(db);
    repo = new WorkspaceRepository(db); await repo.seed(createSeed()); await repo.seed(createSeed('studio-north'));
    bucket = new FakeBucket();
    app = createApp({ repository: repo, origin, resolveSession: async () => identity, storage: bucket });
});
after(async () => db?.close());

test('upload intents: the team gets a policy for an exact key under the project; others get nothing', async () => {
    as(DEMO_USER);
    const r = await intent('Interview notes.pdf', 40); assert.equal(r.status, 201);
    const body = await r.json(), policy = bucket.policies.at(-1)!;
    assert.equal(policy.key, taskFileObjectKey('org_code_black', 'project_common', PDF, body.id));
    assert.deepEqual([policy.contentType, policy.sizeBytes, body.method, body.expiresIn], [PDF, 40, 'POST', 300]);
    as(OUTSIDER);
    const outsider = await intent('Mine.pdf', 40); assert.equal(outsider.status, 404);
    assert.equal(bucket.policies.length, 1, 'no storage capability is minted for a refused request');
    as(DEMO_USER);
    assert.equal((await intent('x.exe', 40, { contentType: 'application/x-msdownload' })).status, 400);
    assert.equal((await intent('big.pdf', 10 * 1024 * 1024 + 1)).status, 400);
    assert.equal((await intent('Key.pdf', 40, { objectKey: 'organisations/other/x.pdf' })).status, 400);
    as(null);
    assert.equal((await intent('Anonymous.pdf', 40)).status, 401);
    const noStorage = createApp({ repository: repo, origin, resolveSession: async () => ({ id: DEMO_USER, name: 'Alex' }) });
    assert.equal((await intent('No storage.pdf', 40, {}, noStorage)).status, 503);
});
test('completion runs the shared verification: a mismatched file is refused and deleted', async () => {
    as(DEMO_USER);
    const r = await intent('Not a pdf.pdf', 12); const { id } = await r.json(), key = bucket.policies.at(-1)!.key;
    bucket.put(key, new TextEncoder().encode('hello world!'), PDF);
    const done = await post(`/uploads/${id}/complete`, {});
    assert.equal(done.status, 400); assert.equal((await done.json()).error.code, 'FILE_MISMATCH');
    assert(bucket.removed.includes(key));
    const good = await attached('Brief.pdf');
    assert(bucket.reads.some(x => x.key === good.key), 'the signature was read at the measured generation');
    assert.equal((await post(`/uploads/${good.id}/complete`, {})).status, 200, 'completing twice changes nothing');
});
test('downloads: a short signed link pinned to the verified generation, only for people who can see the task now', async () => {
    as(DEMO_USER);
    const { id, key } = await attached('Field notes.pdf');
    as(LEAD);
    let r = await get(`/tasks/task_test/files/${id}/download`); assert.equal(r.status, 200);
    const body = await r.json();
    assert.equal(body.filename, 'Field notes.pdf'); assert.equal(body.expiresIn, 120);
    assert.equal(body.url, `https://storage.example.test/signed/${encodeURIComponent(key)}?generation=${bucket.objects.get(key)!.generation}`);
    assert.equal(r.headers.get('cache-control'), 'no-store');
    as(OUTSIDER); assert.equal((await get(`/tasks/task_test/files/${id}/download`)).status, 404);
    as(DEMO_USER); assert.equal((await get(`/tasks/task_empty/files/${id}/download`)).status, 404);
    assert.equal((await get(`/uploads/${id}/download`)).status, 404, 'the member-private route never releases task files');
    as(null); assert.equal((await get(`/tasks/task_test/files/${id}/download`)).status, 401);
    await db.query("UPDATE members SET status='suspended' WHERE organization_id='org_code_black' AND user_id=$1", [LEAD]);
    try { as(LEAD); assert.equal((await get(`/tasks/task_test/files/${id}/download`)).status, 404, 'suspension ends access at once'); }
    finally { await db.query("UPDATE members SET status='active' WHERE organization_id='org_code_black' AND user_id=$1", [LEAD]); }
    const workspace = await (await get('/workspace')).json();
    assert(workspace.uploads.some((u: { id: string; objectKey: string }) => u.id === id && u.objectKey === ''));
    as(OUTSIDER);
    assert(!(await (await get('/workspace')).json()).uploads.some((u: { id: string }) => u.id === id));
});
test('removal goes through the command route; the stored object is deleted after the change commits', async () => {
    as(DEMO_USER);
    const { id, key } = await attached('Remove me.pdf');
    as(OUTSIDER); assert.equal((await post('/commands', { type: 'task.file.remove', taskId: 'task_test', fileId: id })).status, 404);
    assert(!bucket.removed.includes(key));
    as(LEAD); const r = await post('/commands', { type: 'task.file.remove', taskId: 'task_test', fileId: id });
    assert.equal(r.status, 200);
    assert(bucket.removed.includes(key));
    assert.equal((await get(`/tasks/task_test/files/${id}/download`)).status, 404);
});
test('the change check answers with a fingerprint, an empty 304 when unchanged, and nothing to outsiders', async () => {
    as(DEMO_USER);
    let r = await get('/projects/project_common/changes'); assert.equal(r.status, 200);
    const { version } = await r.json(), tag = r.headers.get('etag')!;
    assert.match(version, /^[0-9a-f]{16}$/); assert.equal(tag, `"${version}"`);
    assert.equal(r.headers.get('cache-control'), 'no-store');
    r = await get('/projects/project_common/changes', { 'If-None-Match': tag }); assert.equal(r.status, 304); assert.equal(await r.text(), '');
    await post('/commands', { type: 'task.note', taskId: 'task_test', body: 'Something changed.' });
    as(LEAD);
    r = await get('/projects/project_common/changes', { 'If-None-Match': tag }); assert.equal(r.status, 200);
    assert.notEqual((await r.json()).version, version);
    as(OUTSIDER); assert.equal((await get('/projects/project_common/changes')).status, 404);
    as(DEMO_USER); assert.equal((await get('/projects/project_still/changes')).status, 404);
    as(null); assert.equal((await get('/projects/project_common/changes')).status, 401);
});
test('two people editing one task: the second save is refused as a conflict, never applied over the first', async () => {
    as(LEAD);
    const t = await task('task_flow');
    const edit = (title: string) => post('/commands', { type: 'task.edit', taskId: t.id, expectedVersion: t.version, title, brief: t.brief, criteria: t.criteria, assigneeId: t.assigneeId });
    assert.equal((await edit('First save wins')).status, 200);
    as(DEMO_ADMIN);
    const second = await edit('Second save loses');
    assert.equal(second.status, 409);
    const error = (await second.json()).error;
    assert.equal(error.code, 'STALE_TASK'); assert.match(error.message, /Someone else changed this task/);
    const latest = await task('task_flow');
    assert.equal(latest.title, 'First save wins'); assert.equal(latest.updatedBy, LEAD); assert.equal(latest.version, t.version + 1);
});
test('with two-step sign-in required, an administrator off the team cannot attach without it; the team still can', async () => {
    const strict = createApp({ repository: repo, origin, resolveSession: async () => identity, storage: bucket, adminTwoFactor: 'required' });
    identity = { id: DEMO_ADMIN, name: 'Amina', twoFactorEnabled: false };
    const r = await intent('Admin.pdf', 40, {}, strict); assert.equal(r.status, 403); assert.equal((await r.json()).error.code, 'TWO_FACTOR_REQUIRED');
    identity = { id: DEMO_ADMIN, name: 'Amina', twoFactorEnabled: true };
    assert.equal((await intent('Admin.pdf', 40, {}, strict)).status, 201);
    identity = { id: DEMO_USER, name: 'Alex', twoFactorEnabled: false };
    assert.equal((await intent('Member.pdf', 40, {}, strict)).status, 201);
});
test('with scanning on, a task file waits for the scan worker, and a flagged one is rejected and deleted', async () => {
    as(DEMO_USER);
    const flag = 'REUNIR-TEST-FLAG', scanned: Buffer[] = [];
    const scanner = { async scan(source: ScanSource) { const parts: Uint8Array[] = []; if (source instanceof Uint8Array) parts.push(source); else for await (const p of source.chunks) parts.push(p); const b = Buffer.concat(parts); scanned.push(b); return b.includes(flag) ? { clean: false as const, signature: 'Reunir.Test.Flag' } : { clean: true as const }; }, async ping() { return true; } };
    const queue = new ScanQueue(repo);
    const scanning = createApp({ repository: repo, origin, resolveSession: async () => identity, storage: bucket, scans: queue });
    const work = () => scanWaitingUploads({ queue, storage: bucket, scanner, complete: uploadCompletion({ repository: repo, storage: bucket, scans: queue, remove: async (_, keys) => { for (const k of keys) await bucket.remove(k); } }), log: () => {} });
    const upload = async (bytes: Uint8Array) => {
        const r = await intent('scanned.pdf', bytes.length, {}, scanning); assert.equal(r.status, 201);
        const { id } = await r.json(), key = bucket.policies.at(-1)!.key;
        bucket.put(key, bytes, PDF);
        assert.equal((await post(`/uploads/${id}/complete`, {}, scanning)).status, 202, 'it waits for a verdict');
        await work();
        return { id: id as string, key, done: await post(`/uploads/${id}/complete`, {}, scanning) };
    };
    const clean = await upload(pdf('clean task file'));
    assert.equal(clean.done.status, 200);
    assert.deepEqual(scanned.at(-1), Buffer.from(pdf('clean task file')), 'every byte was scanned');
    const flagged = await upload(pdf(flag));
    assert.equal(flagged.done.status, 422); assert.equal((await flagged.done.json()).error.code, 'FILE_FLAGGED');
    assert.equal((await db.query<{ status: string }>('SELECT status FROM upload_intents WHERE id=$1', [flagged.id])).rows[0].status, 'rejected');
    assert(!bucket.objects.has(flagged.key));
    const uploads = (await (await get('/workspace')).json()).uploads as { id: string; status?: string }[];
    assert(uploads.some(u => u.id === clean.id), 'the clean file is attached');
    assert(!uploads.some(u => u.id === flagged.id && u.status === 'ready'), 'a flagged file is never attached');
});
