import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { openDatabase, type Database } from '../packages/db/src/connection';
import { migrate } from '../packages/db/src/migrate';
import { WorkspaceRepository } from '../packages/db/src/repository';
import { createSeed, DEMO_ADMIN, DEMO_INSTRUCTOR, DEMO_USER } from '../packages/domain/src/seed';
import { createApp } from '../apps/api/src/app';
import { coverThumbnailObjectKey } from '../apps/api/src/storage';
import { FakeBucket } from './helpers/fake-bucket';
import { jpegHeader, webpHeader } from './helpers/images';

const origin = 'https://reunir.test', base = '/api/organisations/code-black';
let db: Database, app: ReturnType<typeof createApp>, strict: ReturnType<typeof createApp>, bucket: FakeBucket;
let identity: { id: string; name: string; twoFactorEnabled?: boolean } | null = { id: DEMO_ADMIN, name: 'Amina' };
const as = (id: string | null, twoFactorEnabled = false) => { identity = id ? { id, name: id, twoFactorEnabled } : null; };
const post = (path: string, body: unknown, on = app) => on.request(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, 'Idempotency-Key': randomUUID() }, body: JSON.stringify(body) });
const get = (path: string, prefix = base) => app.request(prefix + path);
const filled = (header: Uint8Array, size: number) => { const b = new Uint8Array(size); b.set(header); return b; };
const details = (itemId: string, body: unknown, on = app) => post(`/cover-library/${itemId}/details`, body, on);
const label = async (itemId: string) => (await (await get('/workspace')).json()).coverLibrary.find((i: { id: string }) => i.id === itemId);
/**
 * Start an upload with a small copy, put whatever the test gives into the bucket, and complete it. `thumb: null` leaves
 * the small copy out of storage, as when the browser's second post fails.
 */
async function upload(purpose: 'cover_image' | 'cover_library', main: Uint8Array, thumb: Uint8Array | null, thumbType = 'image/webp') {
    const r = await post('/uploads', { purpose, ...(purpose === 'cover_image' ? { subject: 'track', subjectId: 'track_story' } : {}), contentType: 'image/jpeg', sizeBytes: main.length, thumbnail: { contentType: thumbType, sizeBytes: thumb?.length ?? 2000 } });
    assert.equal(r.status, 201);
    const intent = await r.json(), [mainPolicy, thumbPolicy] = bucket.policies.slice(-2);
    bucket.put(mainPolicy.key, main, 'image/jpeg');
    if (thumb) bucket.put(thumbPolicy.key, thumb, thumbType);
    const done = await post(`/uploads/${intent.id}/complete`, {});
    return { status: done.status, body: await done.json(), intent, id: intent.id as string, key: mainPolicy.key, thumbKey: thumbPolicy.key };
}

before(async () => {
    db = await openDatabase('pglite:memory'); await migrate(db);
    const repo = new WorkspaceRepository(db); await repo.seed(createSeed()); await repo.seed(createSeed('studio-north'));
    bucket = new FakeBucket();
    app = createApp({ repository: repo, origin, resolveSession: async () => identity, storage: bucket });
    strict = createApp({ repository: repo, origin, resolveSession: async () => identity, storage: bucket, adminTwoFactor: 'required' });
});
after(async () => db?.close());

test('an owner renames and tags a library picture; members see the new words and the picture is unchanged', async () => {
    as(DEMO_ADMIN);
    const r = await details('library_mountain', { label: '  Ridge at noon ', tags: ['Hills', 'hills', ' Outdoors '] });
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { id: 'library_mountain', label: 'Ridge at noon', tags: ['hills', 'outdoors'], changed: true, status: 'updated' });
    const same = await details('library_mountain', { label: 'Ridge at noon', tags: ['hills', 'outdoors'] });
    assert.equal((await same.json()).status, 'unchanged');
    as(DEMO_USER);
    const item = await label('library_mountain');
    assert.deepEqual([item.label, item.tags, item.fileId], ['Ridge at noon', ['hills', 'outdoors'], 'file_cover_mountain']);
    as(DEMO_ADMIN);
    assert.equal((await details('library_mountain', { label: 'Mountain ridge', tags: ['landscape', 'outdoors'] })).status, 200);
});

test('members, moderators, instructors, visitors and other communities are refused; bad input changes nothing', async () => {
    for (const user of [DEMO_USER, DEMO_INSTRUCTOR, 'member_maya']) {
        as(user);
        const r = await details('library_mountain', { label: 'Mine', tags: [] });
        assert.equal(r.status, 403, user); assert.equal((await r.json()).error.code, 'ADMIN_REQUIRED');
    }
    as(DEMO_ADMIN);
    assert.equal((await app.request('/api/organisations/studio-north/cover-library/library_mountain/details', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify({ label: 'Taken', tags: [] }) })).status, 404, 'another community’s picture');
    assert.equal((await details('no_such_item', { label: 'Taken', tags: [] })).status, 404);
    assert.equal((await details('..%2Fsecret', { label: 'Taken', tags: [] })).status, 400);
    for (const body of [{ label: 'Ok', tags: ['a', 'b', 'c', 'd', 'e', 'f'] }, { label: 'Ok', tags: ['x'.repeat(25)] }, { label: 'Ok', tags: ['tag!'] }, { label: '', tags: [] }, { label: 'Ok', tags: [], fileId: 'other' }, { label: 'Ok' }]) {
        const r = await details('library_mountain', body);
        assert.equal(r.status, 400, JSON.stringify(body)); assert.equal((await r.json()).error.code, 'VALIDATION');
    }
    const forged = await app.request(base + '/cover-library/library_mountain/details', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://evil.test' }, body: JSON.stringify({ label: 'Forged', tags: [] }) });
    assert.equal(forged.status, 403);
    const form = await app.request(base + '/cover-library/library_mountain/details', { method: 'POST', headers: { 'Content-Type': 'text/plain', Origin: origin }, body: JSON.stringify({ label: 'Form', tags: [] }) });
    assert.equal(form.status, 415);
    as(null);
    assert.equal((await details('library_mountain', { label: 'Visitor', tags: [] })).status, 401);
    as(DEMO_USER);
    assert.equal((await label('library_mountain')).label, 'Mountain ridge', 'nothing changed');
});

test('when two-step sign-in is required, an owner without it cannot rename; with it they can; members are never asked', async () => {
    as(DEMO_ADMIN, false);
    const refused = await details('library_mountain', { label: 'Without two-step', tags: [] }, strict);
    assert.equal(refused.status, 403); assert.equal((await refused.json()).error.code, 'TWO_FACTOR_REQUIRED');
    as(DEMO_USER, false);
    assert.equal((await (await details('library_mountain', { label: 'Member', tags: [] }, strict)).json()).error.code, 'ADMIN_REQUIRED', 'members get the ordinary refusal');
    as(DEMO_ADMIN, true);
    assert.equal((await details('library_mountain', { label: 'With two-step', tags: ['landscape'] }, strict)).status, 200);
    assert.equal((await details('library_mountain', { label: 'Mountain ridge', tags: ['landscape', 'outdoors'] }, strict)).status, 200);
});

test('a cover upload signs a second policy for its small copy beside the picture; cards read it, the page reads the picture', async () => {
    as(DEMO_ADMIN);
    const ok = await upload('cover_image', filled(jpegHeader(1600, 900), 9000), filled(webpHeader(480, 270), 2000));
    assert.equal(ok.status, 200);
    assert.equal(ok.thumbKey, coverThumbnailObjectKey(ok.key, 'image/webp'));
    assert.match(ok.thumbKey, /^organisations\/org_code_black\/covers\/tracks\/track_story\/[0-9a-f-]+-thumb\.webp$/);
    assert.deepEqual([ok.intent.thumbnail.fields.key, ok.intent.thumbnail.fields['Content-Type']], [ok.thumbKey, 'image/webp'], 'its own exact key and type');
    assert.equal(bucket.policies.at(-1)!.sizeBytes, 2000);
    assert.deepEqual([ok.body.upload.objectKey, ok.body.upload.thumbnailObjectKey, ok.body.upload.thumbnailGeneration], ['', '', null], 'storage keys never leave the server');
    assert.equal((await post('/commands', { type: 'track.cover.set', trackId: 'track_story', fileId: ok.id, focusX: 40, focusY: 60 })).status, 200);
    as(DEMO_USER);
    const ws = await (await get('/workspace')).json();
    assert(!JSON.stringify(ws).includes('-thumb.'), 'no small-copy key in the workspace');
    const small = await get(`/covers/track/track_story/${ok.id}/thumbnail`);
    assert.equal(small.status, 200);
    assert.deepEqual([small.headers.get('content-type'), small.headers.get('cache-control'), small.headers.get('x-content-type-options')], ['image/webp', 'private, max-age=3600', 'nosniff']);
    assert.match(small.headers.get('content-security-policy') ?? '', /sandbox/);
    assert.deepEqual(new Uint8Array(await small.arrayBuffer()), bucket.objects.get(ok.thumbKey)!.bytes);
    const large = await get(`/covers/track/track_story/${ok.id}`);
    assert.deepEqual(new Uint8Array(await large.arrayBuffer()), bucket.objects.get(ok.key)!.bytes);
    assert.equal((await get(`/covers/track/track_story/${ok.id}/thumbnail`, '/api/organisations/studio-north')).status, 404, 'other communities');
    assert.equal((await get(`/covers/track/track_story/not-the-cover/thumbnail`)).status, 404);
    as(null);
    assert.equal((await get(`/covers/track/track_story/${ok.id}/thumbnail`)).status, 401);
    as(DEMO_ADMIN);
    assert.equal((await post('/commands', { type: 'track.cover.set', trackId: 'track_story', fileId: null })).status, 200);
    assert(bucket.removed.includes(ok.key) && bucket.removed.includes(ok.thumbKey), 'a released cover takes its small copy with it');
});

test('a small copy that is missing, misshapen or mistyped is dropped and cards fall back to the picture', async () => {
    as(DEMO_ADMIN);
    const cases: [string, Uint8Array | null, string][] = [
        ['missing', null, 'image/webp'],
        ['another shape', filled(webpHeader(480, 480), 2000), 'image/webp'],
        ['wider than the limit', filled(webpHeader(800, 450), 2000), 'image/webp'],
        ['not the declared type', filled(jpegHeader(480, 270), 2000), 'image/webp'],
    ];
    for (const [name, thumb, type] of cases) {
        const r = await upload('cover_image', filled(jpegHeader(1600, 900), 9000), thumb, type);
        assert.equal(r.status, 200, name);
        if (thumb) assert(bucket.removed.includes(r.thumbKey), `${name}: the stored copy is deleted`);
        assert.equal((await post('/commands', { type: 'track.cover.set', trackId: 'track_story', fileId: r.id, focusX: 50, focusY: 50 })).status, 200);
        const small = await get(`/covers/track/track_story/${r.id}/thumbnail`);
        assert.equal(small.status, 200, name);
        assert.deepEqual(new Uint8Array(await small.arrayBuffer()), bucket.objects.get(r.key)!.bytes, `${name}: the picture is served instead`);
    }
    const refused = await upload('cover_image', new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>'.padEnd(9000)), filled(webpHeader(480, 270), 2000));
    assert.equal(refused.status, 400); assert.equal(refused.body.error.code, 'FILE_MISMATCH');
    assert(bucket.removed.includes(refused.key) && bucket.removed.includes(refused.thumbKey), 'a refused picture goes with its small copy');
    const big = await post('/uploads', { purpose: 'cover_image', subject: 'track', subjectId: 'track_story', contentType: 'image/jpeg', sizeBytes: 9000, thumbnail: { contentType: 'image/webp', sizeBytes: 300000 } });
    assert.equal(big.status, 400, 'the small copy is bounded');
    assert.equal((await post('/commands', { type: 'track.cover.set', trackId: 'track_story', fileId: null })).status, 200);
});

test('covers and library pictures uploaded before small copies are served in full from the thumbnail address', async () => {
    as(DEMO_ADMIN);
    const r = await post('/uploads', { purpose: 'cover_library', contentType: 'image/jpeg', sizeBytes: 9000 });
    const intent = await r.json(), key = bucket.policies.at(-1)!.key;
    assert.equal(intent.thumbnail, undefined, 'no second policy without a declared copy');
    bucket.put(key, filled(jpegHeader(1600, 900), 9000), 'image/jpeg');
    assert.equal((await post(`/uploads/${intent.id}/complete`, {})).status, 200);
    const itemId = (await (await post('/commands', { type: 'cover.library.add', fileId: intent.id, label: 'Old style', tags: ['archive'] })).json()).objectId as string;
    as(DEMO_USER);
    const small = await get(`/cover-library/${itemId}/thumbnail`);
    assert.equal(small.status, 200);
    assert.deepEqual(new Uint8Array(await small.arrayBuffer()), bucket.objects.get(key)!.bytes);
    assert.deepEqual((await label(itemId)).tags, ['archive']);
});

test('a library picture keeps its small copy; removal deletes both stored files', async () => {
    as(DEMO_ADMIN);
    const ok = await upload('cover_library', filled(jpegHeader(1600, 900), 9000), filled(webpHeader(480, 270), 2000));
    assert.equal(ok.status, 200);
    assert.match(ok.thumbKey, /^organisations\/org_code_black\/covers\/library\/[0-9a-f-]+-thumb\.webp$/);
    const itemId = (await (await post('/commands', { type: 'cover.library.add', fileId: ok.id, label: 'Harbour', tags: ['sea'] })).json()).objectId as string;
    as(DEMO_USER);
    assert.deepEqual(new Uint8Array(await (await get(`/cover-library/${itemId}/thumbnail`)).arrayBuffer()), bucket.objects.get(ok.thumbKey)!.bytes);
    assert.equal((await get(`/cover-library/${itemId}/thumbnail`, '/api/organisations/studio-north')).status, 404);
    as(DEMO_ADMIN);
    assert.equal((await post(`/cover-library/${itemId}/remove`, {})).status, 200);
    assert(bucket.removed.includes(ok.key) && bucket.removed.includes(ok.thumbKey));
    assert.equal((await get(`/cover-library/${itemId}/thumbnail`)).status, 404);
});
