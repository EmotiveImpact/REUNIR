import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { openDatabase, type Database } from '../packages/db/src/connection';
import { migrate } from '../packages/db/src/migrate';
import { WorkspaceRepository } from '../packages/db/src/repository';
import { createSeed, DEMO_ADMIN, DEMO_USER } from '../packages/domain/src/seed';
import { lessonContent } from '../packages/domain/src/authoring';
import { createApp } from '../apps/api/src/app';
import { lessonVideoBytes } from '../apps/api/src/config';
import type { DownloadOptions, PrivateStorage } from '../apps/api/src/storage';
import { MAX_VIDEO_BYTES, attachmentDisposition, fileSignatureMatches, resourceSizeProblem, resourceTypeForFile, resourceUploadRequest } from '../packages/contracts/src/lesson-resources';

const MB = 1024 * 1024;
const bytes = (...parts: (number[] | string)[]) => new Uint8Array(parts.flatMap(p => typeof p === 'string' ? Array.from(p, c => c.charCodeAt(0)) : p));
const mp4 = (extra = '') => bytes([0, 0, 0, 0x18], 'ftypisom', [0, 0, 2, 0], 'isomiso2' + extra);
const webm = () => bytes([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01, 0x42, 0xf7, 0x81, 0x01, 0x42, 0x82, 0x84], 'webm', [0x42, 0x87, 0x81, 0x04]);

test('video signatures: MP4 needs an ftyp box, WebM needs an EBML header that declares webm', () => {
    assert.ok(fileSignatureMatches('video/mp4', mp4()));
    assert.ok(fileSignatureMatches('video/webm', webm()));
    assert.ok(!fileSignatureMatches('video/mp4', bytes('%PDF-1.4 ftyp')));
    assert.ok(!fileSignatureMatches('video/mp4', bytes('ftypisom')), 'ftyp must follow the box size');
    assert.ok(!fileSignatureMatches('video/webm', bytes([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x82, 0x88], 'matroska')), 'other Matroska files are not WebM');
    assert.ok(!fileSignatureMatches('video/webm', mp4()));
    assert.equal(resourceTypeForFile('Welcome.webm', ''), 'video/webm');
    assert.equal(resourceTypeForFile('Welcome.MP4', 'application/octet-stream'), 'video/mp4');
    assert.equal(resourceTypeForFile('Welcome.mov', 'video/quicktime'), null);
});

test('size rules: documents stay at 10 MB, video needs the server to switch it on and stays under its limit', () => {
    assert.equal(resourceSizeProblem('application/pdf', 10 * MB, 0), null);
    assert.equal(resourceSizeProblem('application/pdf', 10 * MB + 1, 500 * MB), 'Files can be up to 10 MB.');
    assert.equal(resourceSizeProblem('video/mp4', 2 * MB, 0), 'Video uploads are not switched on for this community.');
    assert.equal(resourceSizeProblem('video/mp4', 200 * MB, 200 * MB), null);
    assert.equal(resourceSizeProblem('video/webm', 200 * MB + 1, 200 * MB), 'Videos can be up to 200 MB.');
    assert.equal(resourceSizeProblem('video/webm', MAX_VIDEO_BYTES + 1, 900 * MB), 'Videos can be up to 500 MB.');
    const request = (contentType: string, sizeBytes: number) => resourceUploadRequest.safeParse({ purpose: 'lesson_resource', trackId: 'track_product', name: 'x', contentType, sizeBytes }).success;
    assert.ok(request('video/mp4', 300 * MB));
    assert.ok(!request('video/mp4', MAX_VIDEO_BYTES + 1));
    assert.ok(!request('application/pdf', 11 * MB));
    assert.ok(!request('image/png', 11 * MB));
    assert.equal(attachmentDisposition('Welcome.mp4', 'inline'), `inline; filename="Welcome.mp4"; filename*=UTF-8''Welcome.mp4`);
});

test('LESSON_VIDEO_MAX_MB is off unless set, and refuses anything but 0 to 500 whole megabytes', () => {
    assert.equal(lessonVideoBytes({}), 0);
    assert.equal(lessonVideoBytes({ LESSON_VIDEO_MAX_MB: ' ' }), 0);
    assert.equal(lessonVideoBytes({ LESSON_VIDEO_MAX_MB: '0' }), 0);
    assert.equal(lessonVideoBytes({ LESSON_VIDEO_MAX_MB: '250' }), 250 * MB);
    for (const bad of ['501', '-1', '2.5', '1e3', 'lots']) assert.throws(() => lessonVideoBytes({ LESSON_VIDEO_MAX_MB: bad }), /lesson-video/, bad);
});

/** In-memory bucket, as in the lesson file tests. Each write gets a new generation. */
class FakeBucket implements PrivateStorage {
    objects = new Map<string, { bytes: Uint8Array; size: number; contentType: string; generation: string }>();
    policies: { key: string; contentType: string; sizeBytes: number }[] = [];
    downloads: { key: string; options: DownloadOptions }[] = [];
    private generation = 1712345678900000;
    /** Video is large, so only its first bytes are held; the reported size is the declared one. */
    put(key: string, head: Uint8Array, size: number, contentType: string) { this.objects.set(key, { bytes: head, size, contentType, generation: String(++this.generation) }); }
    async upload(key: string, contentType: string, sizeBytes: number) { this.policies.push({ key, contentType, sizeBytes }); return { url: 'https://storage.example.test/reunir-test/', fields: { key, 'Content-Type': contentType } }; }
    async download(key: string, options: DownloadOptions = {}) { this.downloads.push({ key, options }); return `https://storage.example.test/signed/${encodeURIComponent(key)}`; }
    async metadata(key: string) { const o = this.objects.get(key); return o ? { size: o.size, contentType: o.contentType, generation: o.generation } : null; }
    async head(key: string, n: number, generation: string) { const o = this.objects.get(key); if (!o || o.generation !== generation) throw Object.assign(new Error('gone'), { code: 404 }); return o.bytes.slice(0, n); }
    async remove(key: string) { this.objects.delete(key); }
}
const origin = 'https://reunir.test', base = '/api/organisations/code-black';
let db: Database, repo: WorkspaceRepository, bucket: FakeBucket, identity = { id: DEMO_ADMIN, name: 'Amina' };
const as = (id: string) => { identity = { id, name: id }; };
const appWith = (videoBytes?: number) => createApp({ repository: repo, origin, resolveSession: async () => identity, storage: bucket, ...(videoBytes === undefined ? {} : { videoBytes }) });
const post = (app: ReturnType<typeof createApp>, path: string, body: unknown) => app.request(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, 'Idempotency-Key': randomUUID() }, body: JSON.stringify(body) });
const intent = (app: ReturnType<typeof createApp>, contentType: string, sizeBytes: number) => post(app, '/uploads', { purpose: 'lesson_resource', trackId: 'track_product', name: 'Welcome', contentType, sizeBytes });

before(async () => {
    db = await openDatabase('pglite:memory'); await migrate(db);
    repo = new WorkspaceRepository(db); await repo.seed(createSeed());
    bucket = new FakeBucket();
});
after(async () => db?.close());

test('a server that has not switched video on refuses it and says so in its capabilities', async () => {
    const app = appWith();
    assert.equal((await (await app.request('/api/account/capabilities')).json()).videoUploadBytes, 0);
    const r = await intent(app, 'video/mp4', 2 * MB);
    assert.equal(r.status, 403); assert.equal((await r.json()).error.code, 'VIDEO_UPLOADS_OFF');
    assert.equal(bucket.policies.length, 0, 'no storage policy is minted');
});

test('with a 200 MB limit, a 150 MB MP4 is verified, attached, published and played inline for two hours', async () => {
    const app = appWith(200 * MB);
    assert.equal((await (await app.request('/api/account/capabilities')).json()).videoUploadBytes, 200 * MB);
    let r = await intent(app, 'video/mp4', 201 * MB);
    assert.equal(r.status, 413); assert.equal((await r.json()).error.message, 'Videos can be up to 200 MB.');
    r = await intent(app, 'application/pdf', 11 * MB);
    assert.equal(r.status, 400);
    r = await intent(app, 'video/mp4', 150 * MB); assert.equal(r.status, 201);
    const { id } = await r.json(), key = bucket.policies.at(-1)!.key;
    assert.match(key, /\/lesson-resources\/track_product\/[^/]+\.mp4$/);
    bucket.put(key, mp4(), 150 * MB, 'video/mp4');
    const done = await post(app, `/uploads/${id}/complete`, {}); assert.equal(done.status, 200);
    let c = await post(app, '/commands', { type: 'lesson.draft.create', trackId: 'track_product', lessonId: 'lesson_4' }), d = (await c.json()).workspace.lessonDrafts[0];
    c = await post(app, '/commands', { type: 'lesson.draft.save', draftId: d.id, expectedVersion: d.version, ...lessonContent(d), resources: [...lessonContent(d).resources, { id: 'resource_welcome', fileId: id, name: 'Welcome', description: '' }] });
    assert.equal(c.status, 200); d = (await c.json()).workspace.lessonDrafts[0];
    assert.deepEqual(d.resources.at(-1), { id: 'resource_welcome', fileId: id, name: 'Welcome', description: '', contentType: 'video/mp4', sizeBytes: 150 * MB });
    as(DEMO_USER);
    assert.equal((await app.request(base + '/lessons/lesson_4/resources/resource_welcome/play')).status, 404, 'not published yet');
    as(DEMO_ADMIN);
    assert.equal((await app.request(base + `/lesson-drafts/${d.id}/resources/resource_welcome/play`)).status, 200, 'authors preview their draft');
    assert.equal((await post(app, '/commands', { type: 'lesson.draft.publish', draftId: d.id, expectedVersion: d.version })).status, 200);
    as(DEMO_USER);
    const played = await app.request(base + '/lessons/lesson_4/resources/resource_welcome/play'), body = await played.json();
    assert.equal(played.status, 200); assert.equal(played.headers.get('cache-control'), 'no-store');
    assert.deepEqual([body.expiresIn, body.contentType], [7200, 'video/mp4']);
    const signed = bucket.downloads.at(-1)!;
    assert.equal(signed.key, key);
    assert.deepEqual(signed.options, { filename: 'Welcome.mp4', contentType: 'video/mp4', generation: bucket.objects.get(key)!.generation, disposition: 'inline', expiresInSeconds: 7200 });
    // A download of the same video is still a two-minute attachment.
    assert.equal((await (await app.request(base + '/lessons/lesson_4/resources/resource_welcome/download')).json()).expiresIn, 120);
    assert.equal(bucket.downloads.at(-1)!.options.disposition, undefined);
    // Documents never play in the page.
    const worksheet = await app.request(base + '/lessons/lesson_4/resources/resource_problem_worksheet/play');
    assert.equal(worksheet.status, 409); assert.equal((await worksheet.json()).error.code, 'NOT_A_VIDEO');
    as(DEMO_ADMIN);
});

test('a file declared as video that is not one is refused and deleted', async () => {
    const app = appWith(50 * MB);
    const r = await intent(app, 'video/webm', 20 * MB); assert.equal(r.status, 201);
    const { id } = await r.json(), key = bucket.policies.at(-1)!.key;
    bucket.put(key, bytes('%PDF-1.4 not a video'), 20 * MB, 'video/webm');
    const done = await post(app, `/uploads/${id}/complete`, {});
    assert.equal(done.status, 400); assert.equal((await done.json()).error.code, 'FILE_MISMATCH');
    assert.ok(!bucket.objects.has(key));
});

test('the database keeps every non-video file at 10 MB and video at 500 MB', async () => {
    const insert = (purpose: string, contentType: string, size: number) => db.query(
        `INSERT INTO upload_intents(id,organization_id,user_id,object_key,content_type,size_bytes,original_name,purpose,track_id,created_at,status) VALUES ($1,'org_code_black',$2,$3,$4,$5,'x',$6,$7,now(),'pending')`,
        [randomUUID(), DEMO_ADMIN, 'k/' + randomUUID(), contentType, size, purpose, purpose === 'lesson_resource' ? 'track_product' : null]);
    await insert('lesson_resource', 'video/mp4', 500 * MB);
    await insert('lesson_resource', 'application/pdf', 10 * MB);
    await assert.rejects(insert('lesson_resource', 'video/mp4', 500 * MB + 1), /upload_intents_size_bytes_check/);
    await assert.rejects(insert('lesson_resource', 'application/pdf', 10 * MB + 1), /upload_intents_size_bytes_check/);
    await assert.rejects(insert('member', 'video/mp4', 20 * MB), /upload_intents_size_bytes_check/);
});
