import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { openDatabase, type Database } from '../packages/db/src/connection';
import { migrate } from '../packages/db/src/migrate';
import { WorkspaceRepository } from '../packages/db/src/repository';
import { createSeed, DEMO_ADMIN, DEMO_USER } from '../packages/domain/src/seed';
import { createApp } from '../apps/api/src/app';
import { coverObjectKey } from '../apps/api/src/storage';
import { COVER_HEAD_BYTES } from '../packages/contracts/src/covers';
import { FakeBucket } from './helpers/fake-bucket';
import { jpegHeader, pngHeader } from './helpers/images';

const origin = 'https://reunir.test', base = '/api/organisations/code-black';
let db: Database, app: ReturnType<typeof createApp>, bucket: FakeBucket;
let identity: { id: string; name: string } | null = { id: DEMO_ADMIN, name: 'Amina' };
const as = (id: string | null) => { identity = id ? { id, name: id } : null; };
const post = (path: string, body: unknown) => app.request(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, 'Idempotency-Key': randomUUID() }, body: JSON.stringify(body) });
const get = (path: string, prefix = base) => app.request(prefix + path);
/** A believable JPEG: a real header followed by filler bytes. */
const jpeg = (width = 1600, height = 900, size = 9000) => { const b = new Uint8Array(size); b.set(jpegHeader(width, height)); return b; };
async function upload(subject: 'track' | 'project', subjectId: string, bytes: Uint8Array, contentType = 'image/jpeg') {
    const r = await post('/uploads', { purpose: 'cover_image', subject, subjectId, contentType, sizeBytes: bytes.length });
    if (r.status !== 201) return { status: r.status, body: await r.json() };
    const intent = await r.json(), key = bucket.policies.at(-1)!.key;
    bucket.put(key, bytes, contentType);
    const done = await post(`/uploads/${intent.id}/complete`, {});
    return { status: done.status, body: await done.json(), id: intent.id as string, key };
}

before(async () => {
    db = await openDatabase('pglite:memory'); await migrate(db);
    const repo = new WorkspaceRepository(db); await repo.seed(createSeed()); await repo.seed(createSeed('studio-north'));
    bucket = new FakeBucket();
    app = createApp({ repository: repo, origin, resolveSession: async () => identity, storage: bucket });
});
after(async () => db?.close());

test('capabilities report cover uploads when private storage is configured', async () => {
    assert.equal((await (await app.request('/api/account/capabilities')).json()).coverUploads, true);
});
test('members cannot start a track cover upload; authors get a tenant- and track-scoped policy', async () => {
    as(DEMO_USER);
    const denied = await post('/uploads', { purpose: 'cover_image', subject: 'track', subjectId: 'track_story', contentType: 'image/jpeg', sizeBytes: 9000 });
    assert.equal(denied.status, 403); assert.equal((await denied.json()).error.code, 'COVER_EDITOR_REQUIRED');
    as(DEMO_ADMIN);
    const r = await post('/uploads', { purpose: 'cover_image', subject: 'track', subjectId: 'track_story', contentType: 'image/jpeg', sizeBytes: 9000 });
    assert.equal(r.status, 201);
    const body = await r.json(), policy = bucket.policies.at(-1)!;
    assert.equal(policy.key, coverObjectKey('org_code_black', 'track', 'track_story', 'image/jpeg', body.id));
    assert.deepEqual([policy.contentType, policy.sizeBytes, body.method, body.expiresIn], ['image/jpeg', 9000, 'POST', 300]);
    const svg = await post('/uploads', { purpose: 'cover_image', subject: 'track', subjectId: 'track_story', contentType: 'image/svg+xml', sizeBytes: 100 });
    assert.equal(svg.status, 400);
});
test('completion verifies size, type, signature and dimensions on the pinned generation', async () => {
    as(DEMO_ADMIN);
    const huge = await upload('track', 'track_product', jpeg(6000, 6000));
    assert.equal(huge.status, 400); assert.equal(huge.body.error.code, 'FILE_MISMATCH');
    assert(bucket.removed.includes(huge.key!), 'a refused image is deleted from storage');
    const disguised = await upload('track', 'track_product', new TextEncoder().encode('<html><script>alert(1)</script></html>'.padEnd(9000)));
    assert.equal(disguised.status, 400);
    const ok = await upload('track', 'track_product', jpeg());
    assert.equal(ok.status, 200); assert.equal(ok.body.upload.status, 'ready');
    assert.equal(ok.body.upload.objectKey, '', 'storage keys never leave the server');
    assert.equal(bucket.reads.at(-1)!.bytes, COVER_HEAD_BYTES > 9000 ? 9000 : COVER_HEAD_BYTES);
});
test('a member receives the cover bytes privately cached; other tenants and visitors do not', async () => {
    as(DEMO_ADMIN);
    const ok = await upload('track', 'track_story', jpeg(1200, 800, 7000));
    const set = await post('/commands', { type: 'track.cover.set', trackId: 'track_story', fileId: ok.id, focusX: 35, focusY: 55 });
    assert.equal(set.status, 200);
    as(DEMO_USER);
    const ws = await (await get('/workspace')).json();
    const cover = ws.tracks.find((t: { id: string }) => t.id === 'track_story').coverImage;
    assert.deepEqual(cover, { fileId: ok.id, contentType: 'image/jpeg', sizeBytes: 7000, focusX: 35, focusY: 55 });
    assert(!JSON.stringify(ws).includes('/covers/tracks/'), 'no storage key in the workspace');
    const r = await get(`/covers/track/track_story/${ok.id}`);
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('content-type'), 'image/jpeg');
    assert.equal(r.headers.get('cache-control'), 'private, max-age=3600');
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(r.headers.get('content-disposition'), 'inline');
    assert.match(r.headers.get('content-security-policy') ?? '', /sandbox/);
    assert.deepEqual(new Uint8Array(await r.arrayBuffer()), bucket.objects.get(ok.key!)!.bytes);
    assert.equal((await get(`/covers/track/track_story/not-the-cover`)).status, 404);
    assert.equal((await get(`/covers/project/track_story/${ok.id}`)).status, 404);
    assert.equal((await get(`/covers/avatar/track_story/${ok.id}`)).status, 400);
    assert.equal((await get(`/covers/track/track_story/${ok.id}`, '/api/organisations/studio-north')).status, 404);
    as(null);
    assert.equal((await get(`/covers/track/track_story/${ok.id}`)).status, 401);
});
test('a project owner who is not an administrator sets and removes their own cover', async () => {
    as('member_jordan');
    const ok = await upload('project', 'project_still', jpeg(), 'image/jpeg');
    assert.equal(ok.status, 200);
    assert.equal((await post('/commands', { type: 'project.cover.set', projectId: 'project_still', fileId: ok.id })).status, 200);
    as(DEMO_USER);
    assert.equal((await get(`/covers/project/project_still/${ok.id}`)).status, 200);
    const other = await post('/commands', { type: 'project.cover.set', projectId: 'project_still', fileId: null });
    assert.equal(other.status, 403);
    as('member_jordan');
    assert.equal((await post('/commands', { type: 'project.cover.set', projectId: 'project_still', fileId: null })).status, 200);
    as(DEMO_USER);
    assert.equal((await get(`/covers/project/project_still/${ok.id}`)).status, 404, 'a removed cover is no longer served');
});
test('a cover replaced at storage after verification is never served in its place', async () => {
    as(DEMO_ADMIN);
    const ok = await upload('track', 'track_brand', jpeg());
    await post('/commands', { type: 'track.cover.set', trackId: 'track_brand', fileId: ok.id });
    bucket.put(ok.key!, pngHeader(1600, 900), 'image/jpeg');
    assert.equal((await get(`/covers/track/track_brand/${ok.id}`)).status, 404);
});
