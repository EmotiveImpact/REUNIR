import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { openDatabase, type Database } from '../packages/db/src/connection';
import { migrate } from '../packages/db/src/migrate';
import { WorkspaceRepository } from '../packages/db/src/repository';
import { createSeed, DEMO_ADMIN, DEMO_USER } from '../packages/domain/src/seed';
import { lessonContent } from '../packages/domain/src/authoring';
import { createApp } from '../apps/api/src/app';
import type { DownloadOptions, PrivateStorage } from '../apps/api/src/storage';
import { MAX_CAPTION_BYTES, RESOURCE_FILE_ACCEPT, fileSignatureMatches, resourceSizeProblem, resourceTypeForFile } from '../packages/contracts/src/lesson-resources';

// Alpha 54: WebVTT captions for lesson videos, served through the application.
const text = (s: string) => new TextEncoder().encode(s);
const VTT = 'WEBVTT\n\n00:00:00.000 --> 00:00:02.000\nWelcome to the lesson.\n';

test('captions are recognised by their WEBVTT line, by extension, and kept small', () => {
    assert.ok(fileSignatureMatches('text/vtt', text(VTT)));
    assert.ok(fileSignatureMatches('text/vtt', new Uint8Array([0xef, 0xbb, 0xbf, ...text('WEBVTT - Lesson one\n')])), 'a byte order mark and a header comment are allowed');
    assert.ok(fileSignatureMatches('text/vtt', text('WEBVTT')));
    assert.ok(!fileSignatureMatches('text/vtt', text('WEBVTTX\n')));
    assert.ok(!fileSignatureMatches('text/vtt', text('1\n00:00:00,000 --> 00:00:02,000\nAn SRT file\n')), 'SubRip is not WebVTT');
    assert.equal(resourceTypeForFile('Welcome.vtt', ''), 'text/vtt');
    assert.ok(RESOURCE_FILE_ACCEPT.includes('.vtt'));
    assert.equal(resourceSizeProblem('text/vtt', MAX_CAPTION_BYTES, 0), null, 'captions need no video switch');
    assert.equal(resourceSizeProblem('text/vtt', MAX_CAPTION_BYTES + 1, 0), 'Captions files can be up to 512 KB.');
});

class FakeBucket implements PrivateStorage {
    objects = new Map<string, { bytes: Uint8Array; contentType: string; generation: string }>();
    policies: { key: string }[] = [];
    private generation = 1712345678900000;
    put(key: string, bytes: Uint8Array, contentType: string) { this.objects.set(key, { bytes, contentType, generation: String(++this.generation) }); }
    async upload(key: string) { this.policies.push({ key }); return { url: 'https://storage.example.test/reunir-test/', fields: { key } }; }
    async download(key: string, _options: DownloadOptions = {}) { return `https://storage.example.test/signed/${encodeURIComponent(key)}`; }
    async metadata(key: string) { const o = this.objects.get(key); return o ? { size: o.bytes.length, contentType: o.contentType, generation: o.generation } : null; }
    async head(key: string, n: number, generation: string) { const o = this.objects.get(key); if (!o || o.generation !== generation) throw Object.assign(new Error('gone'), { code: 404 }); return o.bytes.slice(0, n); }
    async remove(key: string) { this.objects.delete(key); }
}
const origin = 'https://reunir.test', base = '/api/organisations/code-black';
let db: Database, repo: WorkspaceRepository, bucket: FakeBucket, identity = { id: DEMO_ADMIN, name: 'Amina' };
const as = (id: string) => { identity = { id, name: id }; };
const app = () => createApp({ repository: repo, origin, resolveSession: async () => identity, storage: bucket });
const post = (path: string, body: unknown) => app().request(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, 'Idempotency-Key': randomUUID() }, body: JSON.stringify(body) });

before(async () => {
    db = await openDatabase('pglite:memory'); await migrate(db);
    repo = new WorkspaceRepository(db); await repo.seed(createSeed()); await repo.seed(createSeed('studio-north'));
    bucket = new FakeBucket();
});
after(async () => db?.close());

test('a lesson’s captions reach people who can open it, as WebVTT text from this origin', async () => {
    const bytes = text(VTT);
    let r = await post('/uploads', { purpose: 'lesson_resource', trackId: 'track_product', name: 'Welcome.vtt', contentType: 'text/vtt', sizeBytes: bytes.length });
    assert.equal(r.status, 201);
    const { id } = await r.json(), key = bucket.policies.at(-1)!.key;
    assert.match(key, /\.vtt$/);
    bucket.put(key, bytes, 'text/vtt');
    assert.equal((await post(`/uploads/${id}/complete`, {})).status, 200);
    let c = await post('/commands', { type: 'lesson.draft.create', trackId: 'track_product', lessonId: 'lesson_4' }), d = (await c.json()).workspace.lessonDrafts[0];
    c = await post('/commands', { type: 'lesson.draft.save', draftId: d.id, expectedVersion: d.version, ...lessonContent(d), resources: [...lessonContent(d).resources, { id: 'resource_captions', fileId: id, name: 'English captions', description: '' }] });
    assert.equal(c.status, 200); d = (await c.json()).workspace.lessonDrafts[0];
    as(DEMO_USER);
    assert.equal((await app().request(base + '/lessons/lesson_4/resources/resource_captions/captions')).status, 404, 'not published yet');
    as(DEMO_ADMIN);
    assert.equal((await post('/commands', { type: 'lesson.draft.publish', draftId: d.id, expectedVersion: d.version })).status, 200);
    as(DEMO_USER);
    const shown = await app().request(base + '/lessons/lesson_4/resources/resource_captions/captions');
    assert.equal(shown.status, 200);
    assert.equal(shown.headers.get('content-type'), 'text/vtt; charset=utf-8');
    assert.equal(shown.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(await shown.text(), VTT);
    const worksheet = await app().request(base + '/lessons/lesson_4/resources/resource_problem_worksheet/captions');
    assert.equal(worksheet.status, 409); assert.equal((await worksheet.json()).error.code, 'NOT_CAPTIONS');
    assert.equal((await app().request('/api/organisations/studio-north/lessons/lesson_4/resources/resource_captions/captions')).status, 404, 'never through another community');
    as(DEMO_ADMIN);
});

test('a file declared as captions that is not WebVTT is refused and deleted', async () => {
    const bytes = text('1\n00:00:00,000 --> 00:00:02,000\nSubRip\n');
    const r = await post('/uploads', { purpose: 'lesson_resource', trackId: 'track_product', name: 'Welcome.vtt', contentType: 'text/vtt', sizeBytes: bytes.length });
    const { id } = await r.json(), key = bucket.policies.at(-1)!.key;
    bucket.put(key, bytes, 'text/vtt');
    const done = await post(`/uploads/${id}/complete`, {});
    assert.equal(done.status, 400); assert.equal((await done.json()).error.code, 'FILE_MISMATCH');
    assert.ok(!bucket.objects.has(key));
});
