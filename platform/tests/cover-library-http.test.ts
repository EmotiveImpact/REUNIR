import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { openDatabase, type Database } from '../packages/db/src/connection';
import { migrate } from '../packages/db/src/migrate';
import { WorkspaceRepository } from '../packages/db/src/repository';
import { createSeed, DEMO_ADMIN, DEMO_INSTRUCTOR, DEMO_USER } from '../packages/domain/src/seed';
import { createApp } from '../apps/api/src/app';
import { coverLibraryObjectKey } from '../apps/api/src/storage';
import { FakeBucket } from './helpers/fake-bucket';
import { jpegHeader } from './helpers/images';

const origin = 'https://reunir.test', base = '/api/organisations/code-black';
let db: Database, app: ReturnType<typeof createApp>, bucket: FakeBucket;
let identity: { id: string; name: string } | null = { id: DEMO_ADMIN, name: 'Amina' };
const as = (id: string | null) => { identity = id ? { id, name: id } : null; };
const post = (path: string, body: unknown) => app.request(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, 'Idempotency-Key': randomUUID() }, body: JSON.stringify(body) });
const get = (path: string, prefix = base) => app.request(prefix + path);
const jpeg = (width = 1600, height = 900, size = 9000) => { const b = new Uint8Array(size); b.set(jpegHeader(width, height)); return b; };
/** Upload a picture for the library and verify it. Listing it is a separate command. */
async function upload(bytes: Uint8Array, contentType = 'image/jpeg') {
    const r = await post('/uploads', { purpose: 'cover_library', contentType, sizeBytes: bytes.length });
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

test('only administrators start library uploads, under a community key the client never chooses', async () => {
    for (const user of [DEMO_USER, DEMO_INSTRUCTOR]) {
        as(user);
        const denied = await post('/uploads', { purpose: 'cover_library', contentType: 'image/jpeg', sizeBytes: 9000 });
        assert.equal(denied.status, 403, user); assert.equal((await denied.json()).error.code, 'ADMIN_REQUIRED');
    }
    as(DEMO_ADMIN);
    const r = await post('/uploads', { purpose: 'cover_library', contentType: 'image/jpeg', sizeBytes: 9000 });
    assert.equal(r.status, 201);
    const body = await r.json(), policy = bucket.policies.at(-1)!;
    assert.equal(policy.key, coverLibraryObjectKey('org_code_black', 'image/jpeg', body.id));
    assert.match(policy.key, /^organisations\/org_code_black\/covers\/library\/[0-9a-f-]+\.jpg$/);
    assert.deepEqual([policy.contentType, policy.sizeBytes, body.method, body.expiresIn], ['image/jpeg', 9000, 'POST', 300]);
    assert.equal((await post('/uploads', { purpose: 'cover_library', contentType: 'image/jpeg', sizeBytes: 9000, objectKey: 'mine' })).status, 400);
    assert.equal((await post('/uploads', { purpose: 'cover_library', contentType: 'image/gif', sizeBytes: 9000 })).status, 400);
});
test('a refused picture is deleted from storage and cannot be listed', async () => {
    as(DEMO_ADMIN);
    const bad = await upload(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>'.padEnd(9000)));
    assert.equal(bad.status, 400); assert.equal(bad.body.error.code, 'FILE_MISMATCH');
    assert(bucket.removed.includes(bad.key!));
    const listed = await post('/commands', { type: 'cover.library.add', fileId: bad.id, label: 'Not an image' });
    assert.equal(listed.status, 409);
});
test('a listed picture is served to every member, privately cached; never to other tenants or visitors', async () => {
    as(DEMO_ADMIN);
    const ok = await upload(jpeg(1600, 900, 8000));
    assert.equal(ok.status, 200); assert.equal(ok.body.upload.objectKey, '', 'storage keys never leave the server');
    const added = await post('/commands', { type: 'cover.library.add', fileId: ok.id, label: 'Harbour at dawn' });
    assert.equal(added.status, 200);
    const itemId = (await added.json()).objectId as string;
    as(DEMO_USER);
    const ws = await (await get('/workspace')).json();
    assert.deepEqual(ws.coverLibrary.map((i: { label: string }) => i.label).sort(), ['Harbour at dawn', 'Mountain ridge']);
    assert(!JSON.stringify(ws).includes('/covers/library/'), 'no storage key in the workspace');
    const r = await get(`/cover-library/${itemId}`);
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('content-type'), 'image/jpeg');
    assert.equal(r.headers.get('cache-control'), 'private, max-age=3600');
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
    assert.match(r.headers.get('content-security-policy') ?? '', /sandbox/);
    assert.deepEqual(new Uint8Array(await r.arrayBuffer()), bucket.objects.get(ok.key!)!.bytes);
    assert.equal((await get(`/cover-library/${itemId}`, '/api/organisations/studio-north')).status, 404);
    assert.equal((await get('/cover-library/not-listed')).status, 404);
    assert.equal((await get('/cover-library/..%2Fsecret')).status, 400);
    as(null);
    assert.equal((await get(`/cover-library/${itemId}`)).status, 401);
});
test('an instructor chooses a library picture for their track; removal waits until nothing shows it', async () => {
    as(DEMO_ADMIN);
    const ok = await upload(jpeg());
    const itemId = (await (await post('/commands', { type: 'cover.library.add', fileId: ok.id, label: 'Quiet desk' })).json()).objectId as string;
    as(DEMO_INSTRUCTOR);
    assert.equal((await post('/commands', { type: 'track.cover.set', trackId: 'track_product', fileId: ok.id, focusX: 50, focusY: 30 })).status, 200);
    assert.equal((await post(`/cover-library/${itemId}/remove`, {})).status, 403, 'instructors do not manage the library');
    as(DEMO_USER);
    assert.equal((await get(`/covers/track/track_product/${ok.id}`)).status, 200, 'the cover is served through its track');
    as(DEMO_ADMIN);
    const busy = await post(`/cover-library/${itemId}/remove`, {});
    assert.equal(busy.status, 409); assert.equal((await busy.json()).error.code, 'COVER_IN_USE');
    assert(!bucket.removed.includes(ok.key!));
    as(DEMO_INSTRUCTOR);
    assert.equal((await post('/commands', { type: 'track.cover.set', trackId: 'track_product', fileId: null })).status, 200);
    as(DEMO_ADMIN);
    const removed = await post(`/cover-library/${itemId}/remove`, {});
    assert.equal(removed.status, 200); assert.deepEqual(await removed.json(), { id: itemId, status: 'removed' });
    assert(bucket.removed.includes(ok.key!), 'the stored picture is deleted');
    assert.equal((await get(`/cover-library/${itemId}`)).status, 404);
    assert.equal((await post(`/cover-library/${itemId}/remove`, {})).status, 404);
});
test('removal needs the application origin and JSON, like every other change', async () => {
    as(DEMO_ADMIN);
    const forged = await app.request(base + '/cover-library/library_mountain/remove', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://evil.test' }, body: '{}' });
    assert.equal(forged.status, 403);
    const form = await app.request(base + '/cover-library/library_mountain/remove', { method: 'POST', headers: { 'Content-Type': 'text/plain', Origin: origin }, body: '{}' });
    assert.equal(form.status, 415);
    as(DEMO_USER);
    assert.equal((await (await get('/workspace')).json()).coverLibrary.some((i: { id: string }) => i.id === 'library_mountain'), true, 'still listed');
});
