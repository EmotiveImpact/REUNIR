import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, generateKeyPairSync } from 'node:crypto';
import { Storage } from '@google-cloud/storage';
import { openDatabase, type Database } from '../packages/db/src/connection';
import { migrate } from '../packages/db/src/migrate';
import { WorkspaceRepository } from '../packages/db/src/repository';
import { createSeed, DEMO_ADMIN, DEMO_USER } from '../packages/domain/src/seed';
import { lessonContent } from '../packages/domain/src/authoring';
import { createApp } from '../apps/api/src/app';
import { googleStorage, resourceObjectKey, type DownloadOptions, type PrivateStorage } from '../apps/api/src/storage';

/** In-memory stand-in for the bucket. Each write gets a new generation, as in Cloud Storage. */
class FakeBucket implements PrivateStorage {
    objects = new Map<string, { bytes: Uint8Array; contentType: string; generation: string }>();
    policies: { key: string; contentType: string; sizeBytes: number }[] = [];
    downloads: { key: string; options: DownloadOptions }[] = [];
    removed: string[] = [];
    private generation = 1712345678900000;
    put(key: string, bytes: Uint8Array, contentType = 'application/pdf') { this.objects.set(key, { bytes, contentType, generation: String(++this.generation) }); }
    async upload(key: string, contentType: string, sizeBytes: number) { this.policies.push({ key, contentType, sizeBytes }); return { url: 'https://storage.example.test/reunir-test/', fields: { key, 'Content-Type': contentType } }; }
    async download(key: string, options: DownloadOptions = {}) { this.downloads.push({ key, options }); return `https://storage.example.test/signed/${encodeURIComponent(key)}?generation=${options.generation}`; }
    async metadata(key: string) { const o = this.objects.get(key); return o ? { size: o.bytes.length, contentType: o.contentType, generation: o.generation } : null; }
    async head(key: string, bytes: number, generation: string) { const o = this.objects.get(key); if (!o || o.generation !== generation) throw Object.assign(new Error('No such object generation'), { code: 404 }); return o.bytes.slice(0, bytes); }
    async remove(key: string) { this.removed.push(key); this.objects.delete(key); }
}
const origin = 'https://reunir.test', base = '/api/organisations/code-black', PDF = 'application/pdf';
const pdf = (text: string) => new TextEncoder().encode(`%PDF-1.4\n% ${text}\n`);
let db: Database, repo: WorkspaceRepository, app: ReturnType<typeof createApp>, bucket: FakeBucket;
let identity: { id: string; name: string } | null = { id: DEMO_ADMIN, name: 'Amina' };
const as = (id: string | null) => { identity = id ? { id, name: id } : null; };
const headers = (extra: Record<string, string> = {}) => ({ 'Content-Type': 'application/json', Origin: origin, 'Idempotency-Key': randomUUID(), ...extra });
const post = (path: string, body: unknown, extra: Record<string, string> = {}, target = app) => target.request(base + path, { method: 'POST', headers: headers(extra), body: JSON.stringify(body) });
const command = (cmd: unknown) => post('/commands', cmd);
const intent = (name: string, size: number, extra: Record<string, unknown> = {}) => post('/uploads', { purpose: 'lesson_resource', trackId: 'track_product', name, contentType: PDF, sizeBytes: size, ...extra });
async function verified(name: string, bytes = pdf(name)) {
    const r = await intent(name, bytes.length); assert.equal(r.status, 201);
    const { id } = await r.json(), key = bucket.policies.at(-1)!.key;
    bucket.put(key, bytes);
    const done = await post(`/uploads/${id}/complete`, {}); assert.equal(done.status, 200);
    return { id: id as string, key };
}
const workspace = async () => (await (await app.request(base + '/workspace')).json());

before(async () => {
    db = await openDatabase('pglite:memory'); await migrate(db);
    repo = new WorkspaceRepository(db); await repo.seed(createSeed()); await repo.seed(createSeed('studio-north'));
    bucket = new FakeBucket();
    app = createApp({ repository: repo, origin, resolveSession: async () => identity, storage: bucket });
});
after(async () => db?.close());

test('members cannot start lesson uploads; authors get a tenant- and track-scoped policy', async () => {
    as(DEMO_USER);
    let r = await intent('notes.pdf', 20); assert.equal(r.status, 403); assert.equal((await r.json()).error.code, 'AUTHOR_REQUIRED');
    as(DEMO_ADMIN);
    r = await intent('notes.pdf', 20); assert.equal(r.status, 201);
    const body = await r.json(), policy = bucket.policies.at(-1)!;
    assert.equal(policy.key, resourceObjectKey('org_code_black', 'track_product', PDF, body.id));
    assert.deepEqual([policy.contentType, policy.sizeBytes], [PDF, 20]);
    assert.equal(body.method, 'POST'); assert.equal(body.expiresIn, 300);
});
test('unknown tracks, invented fields and other tenants are refused before any capability is minted', async () => {
    const count = bucket.policies.length;
    assert.equal((await intent('x.pdf', 10, { trackId: 'track_missing' })).status, 404);
    assert.equal((await intent('x.pdf', 10, { objectKey: 'organisations/other/attacker.pdf' })).status, 400);
    assert.equal((await intent('x.html', 10, { contentType: 'text/html' })).status, 400);
    assert.equal((await app.request('/api/organisations/not-a-member/uploads', { method: 'POST', headers: headers(), body: JSON.stringify({ purpose: 'lesson_resource', trackId: 'track_product', name: 'x.pdf', contentType: PDF, sizeBytes: 10 }) })).status, 404);
    assert.equal(bucket.policies.length, count);
});
test('completion before the bytes arrive leaves the intent pending', async () => {
    const r = await intent('later.pdf', 30), { id } = await r.json();
    const done = await post(`/uploads/${id}/complete`, {});
    assert.equal(done.status, 409); assert.equal((await done.json()).error.code, 'UPLOAD_MISSING');
    assert.equal((await db.query('SELECT status FROM upload_intents WHERE id=$1', [id])).rows[0].status, 'pending');
});
test('a disguised file is rejected, deleted from storage and cannot be completed again', async () => {
    const html = new TextEncoder().encode('<html><script>alert(1)</script></html>');
    const r = await intent('worksheet.pdf', html.length), { id } = await r.json(), key = bucket.policies.at(-1)!.key;
    bucket.put(key, html);
    const done = await post(`/uploads/${id}/complete`, {});
    assert.equal(done.status, 400); assert.equal((await done.json()).error.code, 'FILE_MISMATCH');
    assert(bucket.removed.includes(key));
    assert.equal((await post(`/uploads/${id}/complete`, {})).status, 409);
    const mismatched = await intent('size.pdf', 99), other = (await mismatched.json()).id;
    bucket.put(bucket.policies.at(-1)!.key, pdf('wrong size'));
    assert.equal((await post(`/uploads/${other}/complete`, {})).status, 400);
});
test('an object replaced during verification is never accepted on the old measurements', async () => {
    const bytes = pdf('first'), r = await intent('Swapped.pdf', bytes.length), { id } = await r.json(), key = bucket.policies.at(-1)!.key;
    bucket.put(key, bytes);
    const measure = bucket.metadata.bind(bucket);
    bucket.metadata = async (k: string) => { const m = await measure(k); bucket.put(k, pdf('swap!')); return m; };
    try {
        const done = await post(`/uploads/${id}/complete`, {});
        assert.equal(done.status, 409); assert.equal((await done.json()).error.code, 'UPLOAD_CHANGED');
    } finally { bucket.metadata = measure; }
    assert.equal((await db.query('SELECT status FROM upload_intents WHERE id=$1', [id])).rows[0].status, 'pending');
    assert.equal((await post(`/uploads/${id}/complete`, {})).status, 200);
});
test('verified bytes complete without exposing storage keys or generations', async () => {
    const bytes = pdf('verified'), r = await intent('Verified guide.pdf', bytes.length), { id } = await r.json();
    bucket.put(bucket.policies.at(-1)!.key, bytes);
    const done = await post(`/uploads/${id}/complete`, {}), body = await done.json();
    assert.equal(done.status, 200); assert.equal(body.status, 'ready');
    assert.equal(body.upload.objectKey, ''); assert.equal(body.upload.generation, null); assert.equal(body.upload.sizeBytes, bytes.length);
    assert.equal((await post(`/uploads/${id}/complete`, {})).status, 200);
    const admin = await workspace();
    assert(admin.uploads.some((u: { id: string }) => u.id === id));
    assert(!JSON.stringify(admin).includes('lesson-resources/track_product'));
});
test('the owner-only download route never releases lesson files', async () => {
    const { id } = await verified('Owner route.pdf');
    const r = await app.request(base + `/uploads/${id}/download`);
    assert.equal(r.status, 404);
});
test('learners download only published files, signed as attachments and pinned to the verified generation', async () => {
    const file = await verified('Field guide.pdf');
    const verifiedGeneration = bucket.objects.get(file.key)!.generation;
    let r = await command({ type: 'lesson.draft.create', trackId: 'track_product', lessonId: 'lesson_4' }), d = (await r.json()).workspace.lessonDrafts[0];
    r = await command({ type: 'lesson.draft.save', draftId: d.id, expectedVersion: d.version, ...lessonContent(d), resources: [...lessonContent(d).resources, { id: 'resource_field_guide', fileId: file.id, name: 'Field guide', description: 'For the first interview.' }] });
    assert.equal(r.status, 200); d = (await r.json()).workspace.lessonDrafts[0];
    as(DEMO_USER);
    assert.equal((await app.request(base + '/lessons/lesson_4/resources/resource_field_guide/download')).status, 404);
    assert.equal((await app.request(base + `/lesson-drafts/${d.id}/resources/resource_field_guide/download`)).status, 404);
    as(DEMO_ADMIN);
    const preview = await app.request(base + `/lesson-drafts/${d.id}/resources/resource_field_guide/download`);
    assert.equal(preview.status, 200);
    assert.equal((await command({ type: 'lesson.draft.publish', draftId: d.id, expectedVersion: d.version })).status, 200);
    as(DEMO_USER);
    const got = await app.request(base + '/lessons/lesson_4/resources/resource_field_guide/download'), body = await got.json();
    assert.equal(got.status, 200); assert.equal(got.headers.get('cache-control'), 'no-store');
    assert.equal(body.expiresIn, 120); assert.equal(body.filename, 'Field guide.pdf');
    assert.deepEqual(bucket.downloads.at(-1), { key: file.key, options: { filename: 'Field guide.pdf', contentType: PDF, generation: verifiedGeneration } });
    bucket.put(file.key, pdf('overwritten after verification'));
    await app.request(base + '/lessons/lesson_4/resources/resource_field_guide/download');
    assert.equal(bucket.downloads.at(-1)!.options.generation, verifiedGeneration);
    as(DEMO_ADMIN);
});
test('history and drafts stay with authors; other tenants and anonymous requests get nothing', async () => {
    const s = await workspace(), revision = s.lessonRevisions.at(-1);
    assert.equal((await app.request(base + `/lesson-revisions/${revision.id}/resources/resource_field_guide/download`)).status, 200);
    as(DEMO_USER);
    assert.equal((await app.request(base + `/lesson-revisions/${revision.id}/resources/resource_field_guide/download`)).status, 404);
    assert.equal((await app.request('/api/organisations/studio-north/lessons/lesson_4/resources/resource_field_guide/download')).status, 404);
    as(null);
    assert.equal((await app.request(base + '/lessons/lesson_4/resources/resource_field_guide/download')).status, 401);
    as(DEMO_USER);
    assert.equal((await app.request(base + '/lessons/lesson_4/resources/bad%20id/download')).status, 400);
    as(DEMO_ADMIN);
});
test('discard refuses referenced files and deletes unreferenced uploads from storage', async () => {
    const s = await workspace(), referenced = s.lessons.find((l: { id: string }) => l.id === 'lesson_4').resources.at(-1).fileId;
    let r = await post(`/uploads/${referenced}/discard`, {});
    assert.equal(r.status, 409); assert.equal((await r.json()).error.code, 'RESOURCE_IN_USE');
    const spare = await verified('Spare.pdf');
    as(DEMO_USER); assert.equal((await post(`/uploads/${spare.id}/discard`, {})).status, 403); as(DEMO_ADMIN);
    assert.equal((await post(`/uploads/${spare.id}/discard`, {}, { Origin: 'https://evil.example' })).status, 403);
    r = await post(`/uploads/${spare.id}/discard`, {});
    assert.equal(r.status, 200); assert(bucket.removed.includes(spare.key));
    assert.equal((await db.query('SELECT 1 FROM upload_intents WHERE id=$1', [spare.id])).rows.length, 0);
});
test('resource routes fail closed without storage and report the capability honestly', async () => {
    const bare = createApp({ repository: repo, origin, resolveSession: async () => identity });
    assert.equal((await (await bare.request('/api/account/capabilities')).json()).resourceUploads, false);
    assert.equal((await (await app.request('/api/account/capabilities')).json()).resourceUploads, true);
    assert.equal((await post('/uploads', { purpose: 'lesson_resource', trackId: 'track_product', name: 'x.pdf', contentType: PDF, sizeBytes: 10 }, {}, bare)).status, 503);
    assert.equal((await bare.request(base + '/lessons/lesson_4/resources/resource_problem_worksheet/download')).status, 503);
});
test('the Google adapter binds exact size and type into a five-minute signed POST policy', async () => {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const client = new Storage({ projectId: 'reunir-offline-test', credentials: { client_email: 'signer@reunir-offline-test.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString() } });
    const storage = googleStorage('reunir-offline-bucket', undefined, client);
    const key = resourceObjectKey('org_code_black', 'track_product', PDF, 'file_1');
    const policy = await storage.upload(key, PDF, 4321);
    const decoded = JSON.parse(Buffer.from(policy.fields.policy, 'base64').toString());
    assert.deepEqual(decoded.conditions.slice(0, 4), [['content-length-range', 4321, 4321], { 'Content-Type': PDF }, { bucket: 'reunir-offline-bucket' }, { key }]);
    assert(Date.parse(decoded.expiration) - Date.now() <= 5 * 60 * 1000 + 1000);
    const url = new URL(await storage.download(key, { filename: 'Café plan.pdf', contentType: PDF, generation: '1712345678901234' }));
    assert.equal(url.origin + url.pathname, `https://storage.googleapis.com/reunir-offline-bucket/${key}`);
    assert.equal(url.searchParams.get('X-Goog-Expires'), '120');
    assert.equal(url.searchParams.get('generation'), '1712345678901234');
    assert.equal(url.searchParams.get('response-content-type'), PDF);
    assert.equal(url.searchParams.get('response-content-disposition'), 'attachment; filename="Caf_ plan.pdf"; filename*=UTF-8\'\'Caf%C3%A9%20plan.pdf');
    assert(url.searchParams.get('X-Goog-Signature'));
    assert.equal(new URL(await storage.download('organisations/o/members/u/x.pdf')).searchParams.get('response-content-disposition'), 'attachment');
});
test('the Google adapter reads metadata, pinned signature bytes and removals without guessing', async () => {
    const calls: unknown[] = [];
    const file = (name: string, options?: { generation?: string }) => ({
        getMetadata: async () => {
            if (name === 'missing') throw Object.assign(new Error('Not found'), { code: 404 });
            if (name === 'denied') throw Object.assign(new Error('Forbidden'), { code: 403 });
            return [{ size: '12', contentType: PDF, generation: 1712345678901234 }];
        },
        download: async (o: unknown) => { calls.push({ name, generation: options?.generation, o }); return [Buffer.from('%PDF-1.4 abc')]; },
        delete: async (o: unknown) => { calls.push({ name, delete: o }); },
    });
    const storage = googleStorage('bucket', undefined, { bucket: () => ({ file }) } as unknown as Storage);
    assert.equal(await storage.metadata('missing'), null);
    await assert.rejects(() => storage.metadata('denied'));
    assert.deepEqual(await storage.metadata('present'), { size: 12, contentType: PDF, generation: '1712345678901234' });
    assert.deepEqual([...await storage.head('present', 1024, '1712345678901234')].slice(0, 5), [...new TextEncoder().encode('%PDF-')]);
    await storage.remove('present');
    assert.deepEqual(calls, [{ name: 'present', generation: '1712345678901234', o: { start: 0, end: 1023 } }, { name: 'present', delete: { ignoreNotFound: true } }]);
});
