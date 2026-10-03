import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSeed, DEMO_ADMIN, DEMO_USER } from '../packages/domain/src/seed';
import { applyCommand } from '../packages/domain/src/engine';
import { clientUpload } from '../packages/domain/src/resources';
import {
    beginCoverLibraryUpload, beginCoverUpload, completeCoverUpload, releasedCoverKeys, removeCoverLibraryItem, resolveCoverImage, servedObject, staleCoverUploads, storedKeys, type CoverObservation,
} from '../packages/domain/src/covers';
import {
    COVER_THUMBNAIL_WIDTH, COVER_UPLOAD_TTL_MS, MAX_COVER_THUMBNAIL_BYTES, coverBytesAcceptable, coverLibraryUploadRequest, coverThumbnailAcceptable, coverUploadRequest,
} from '../packages/contracts/src/covers';
import type { Workspace } from '../packages/contracts/src/index';
import { jpegHeader, pngHeader, webpHeader } from './helpers/images';

const ORG = 'org_code_black', T0 = '2026-10-03T09:00:00.000Z';
const ctx = (userId: string) => ({ organizationId: ORG, userId, requestId: 'cover-thumbnails-test' });
let n = 0;
const ids = (thumb = true) => { const i = ++n; return { id: `thumb_upload_${i}`, objectKey: `organisations/${ORG}/covers/tracks/track_story/${i}.png`, ...(thumb ? { thumbnailObjectKey: `organisations/${ORG}/covers/tracks/track_story/${i}-thumb.webp` } : {}) }; };
const full = { width: 1600, height: 900 };
const thumbnail = { contentType: 'image/webp' as const, sizeBytes: 30000 };
const request = (extra = {}) => ({ purpose: 'cover_image' as const, subject: 'track' as const, subjectId: 'track_story', contentType: 'image/png' as const, sizeBytes: 5000, thumbnail, ...extra });
const main: CoverObservation = { sizeBytes: 5000, contentType: 'image/png', generation: '1712345678900001', bytesAcceptable: coverBytesAcceptable('image/png', pngHeader(1600, 900)) };
const small = (extra = {}) => ({ sizeBytes: 30000, contentType: 'image/webp', generation: '1712345678900002', bytesAcceptable: coverThumbnailAcceptable('image/webp', webpHeader(480, 270), full), ...extra });
const run = (s: Workspace, user: string, cmd: unknown) => applyCommand(s, ctx(user), cmd, () => T0, () => `id_${++n}`);
function upload(observed: CoverObservation, withThumb = true, s = createSeed()) {
    const begun = beginCoverUpload(s, ctx(DEMO_ADMIN), request(withThumb ? {} : { thumbnail: undefined }), ids(withThumb), T0);
    return { begun, done: completeCoverUpload(begun.workspace, ctx(DEMO_ADMIN), begun.upload.id, observed, T0) };
}

test('a small copy must be the same picture, narrower and at most 480 pixels wide, with a matching signature', () => {
    assert.equal(COVER_THUMBNAIL_WIDTH, 480);
    assert(coverThumbnailAcceptable('image/webp', webpHeader(480, 270), full));
    assert(coverThumbnailAcceptable('image/jpeg', jpegHeader(480, 270), full));
    assert(coverThumbnailAcceptable('image/webp', webpHeader(480, 271), full), 'a pixel of rounding is allowed');
    assert(coverThumbnailAcceptable('image/png', pngHeader(300, 400), { width: 1200, height: 1600 }), 'portrait pictures keep their shape');
    assert(!coverThumbnailAcceptable('image/webp', webpHeader(481, 271), full), 'wider than the limit');
    assert(!coverThumbnailAcceptable('image/webp', webpHeader(480, 480), full), 'a different shape is a different picture');
    assert(!coverThumbnailAcceptable('image/webp', webpHeader(400, 225), { width: 400, height: 225 }), 'no smaller than the picture itself');
    assert(!coverThumbnailAcceptable('image/webp', webpHeader(480, 8), { width: 1600, height: 27 }), 'too thin to be a picture');
    assert(!coverThumbnailAcceptable('image/jpeg', webpHeader(480, 270), full), 'declared type must match the bytes');
    assert(!coverThumbnailAcceptable('image/svg+xml', new TextEncoder().encode('<svg/>'), full));
    assert(!coverThumbnailAcceptable('image/webp', webpHeader(480, 270), null), 'no full picture to compare with');
});

test('requests may declare one bounded small copy; clients never name its key', () => {
    assert.deepEqual(coverUploadRequest.parse(request()).thumbnail, thumbnail);
    assert.equal(coverUploadRequest.parse(request({ thumbnail: undefined })).thumbnail, undefined, 'older clients send none');
    assert.throws(() => coverUploadRequest.parse(request({ thumbnail: { ...thumbnail, sizeBytes: MAX_COVER_THUMBNAIL_BYTES + 1 } })), /256 KB/);
    assert.throws(() => coverUploadRequest.parse(request({ thumbnail: { ...thumbnail, contentType: 'image/gif' } })));
    assert.throws(() => coverUploadRequest.parse(request({ thumbnail: { ...thumbnail, objectKey: 'mine' } })), 'clients never name storage keys');
    assert.deepEqual(coverLibraryUploadRequest.parse({ purpose: 'cover_library', contentType: 'image/png', sizeBytes: 5000, thumbnail }).thumbnail, thumbnail);
});

test('a verified small copy is recorded on the same upload and served for cards; the picture is served in full', () => {
    const { begun, done } = upload({ ...main, thumbnail: small() });
    assert.deepEqual([begun.upload.thumbnailObjectKey, begun.upload.thumbnailContentType, begun.upload.thumbnailSizeBytes, begun.upload.thumbnailGeneration], [`organisations/${ORG}/covers/tracks/track_story/${n}-thumb.webp`, 'image/webp', 30000, null]);
    assert.equal(done.outcome, 'ready'); assert.deepEqual(done.discarded, []);
    assert.equal(done.upload.thumbnailGeneration, '1712345678900002');
    const s = run(done.workspace, DEMO_ADMIN, { type: 'track.cover.set', trackId: 'track_story', fileId: done.upload.id, focusX: 50, focusY: 50 }).workspace;
    const { upload: stored } = resolveCoverImage(s, ctx(DEMO_USER), 'track', 'track_story', done.upload.id);
    assert.deepEqual(servedObject(stored, 'thumbnail'), { objectKey: done.upload.thumbnailObjectKey, generation: '1712345678900002', contentType: 'image/webp', sizeBytes: 30000 });
    assert.deepEqual(servedObject(stored, 'full'), { objectKey: done.upload.objectKey, generation: main.generation, contentType: 'image/png', sizeBytes: 5000 });
    assert.deepEqual(storedKeys(stored), [stored.objectKey, stored.thumbnailObjectKey]);
    const browser = clientUpload(stored);
    assert.deepEqual([browser.objectKey, browser.thumbnailObjectKey, browser.generation, browser.thumbnailGeneration], ['', '', null, null], 'storage keys and generations never leave the server');
});

test('a missing or failing small copy is dropped and the picture alone is kept; older covers fall back to the picture', () => {
    for (const thumb of [null, small({ bytesAcceptable: false }), small({ sizeBytes: 29999 }), small({ contentType: 'image/jpeg' }), small({ generation: null }), small({ generation: 'not-a-number' })]) {
        const { begun, done } = upload({ ...main, thumbnail: thumb });
        assert.equal(done.outcome, 'ready', JSON.stringify(thumb));
        assert.deepEqual([done.upload.thumbnailObjectKey, done.upload.thumbnailContentType, done.upload.thumbnailSizeBytes, done.upload.thumbnailGeneration], [null, null, null, null]);
        assert.deepEqual(done.discarded, [begun.upload.thumbnailObjectKey], 'the stored copy is deleted');
        assert.deepEqual(servedObject(done.upload, 'thumbnail'), servedObject(done.upload, 'full'));
    }
    const none = upload(main, false);
    assert.equal(none.begun.upload.thumbnailObjectKey, null); assert.deepEqual(none.done.discarded, []);
    const keyless = beginCoverUpload(createSeed(), ctx(DEMO_ADMIN), request(), { id: 'keyless', objectKey: 'k/keyless.png' }, T0);
    assert.equal(keyless.upload.thumbnailObjectKey, null, 'a small copy is recorded only when the server chose its key');
    const legacy = { ...none.done.upload }; delete legacy.thumbnailObjectKey; delete legacy.thumbnailGeneration;
    assert.deepEqual(servedObject(legacy, 'thumbnail').objectKey, legacy.objectKey, 'records from before migration 0038');
});

test('a refused picture discards its small copy too, and released or pruned uploads list both stored files', () => {
    const { begun, done } = upload({ ...main, bytesAcceptable: false, thumbnail: small() });
    assert.equal(done.outcome, 'rejected');
    assert.deepEqual(done.discarded, [begun.upload.objectKey, begun.upload.thumbnailObjectKey]);
    const first = upload({ ...main, thumbnail: small() });
    let s = run(first.done.workspace, DEMO_ADMIN, { type: 'track.cover.set', trackId: 'track_story', fileId: first.done.upload.id, focusX: 50, focusY: 50 }).workspace;
    const removed = run(s, DEMO_ADMIN, { type: 'track.cover.set', trackId: 'track_story', fileId: null }).workspace;
    assert.deepEqual(releasedCoverKeys(s, removed), [first.done.upload.objectKey, first.done.upload.thumbnailObjectKey]);
    s = done.workspace;
    const later = new Date(Date.parse(T0) + COVER_UPLOAD_TTL_MS + 1000).toISOString();
    const next = beginCoverUpload(s, ctx(DEMO_ADMIN), request(), ids(), later);
    assert.deepEqual(next.expired.find(x => x.id === begun.upload.id), { id: begun.upload.id, objectKey: begun.upload.objectKey, thumbnailObjectKey: begun.upload.thumbnailObjectKey });
    assert(staleCoverUploads(s, ORG, later).some(u => u.id === begun.upload.id && u.thumbnailObjectKey === begun.upload.thumbnailObjectKey));
});

test('library pictures carry a small copy too, and removal names both stored files', () => {
    const begun = beginCoverLibraryUpload(createSeed(), ctx(DEMO_ADMIN), { purpose: 'cover_library', contentType: 'image/png', sizeBytes: 5000, thumbnail }, { id: 'lib_thumb', objectKey: 'organisations/x/covers/library/lib_thumb.png', thumbnailObjectKey: 'organisations/x/covers/library/lib_thumb-thumb.webp' }, T0);
    const done = completeCoverUpload(begun.workspace, ctx(DEMO_ADMIN), 'lib_thumb', { ...main, thumbnail: small() }, T0);
    assert.equal(done.upload.thumbnailGeneration, '1712345678900002');
    const added = run(done.workspace, DEMO_ADMIN, { type: 'cover.library.add', fileId: 'lib_thumb', label: 'Harbour' });
    const removed = removeCoverLibraryItem(added.workspace, ctx(DEMO_ADMIN), added.objectId!, T0);
    assert.deepEqual([removed.objectKey, removed.thumbnailObjectKey], ['organisations/x/covers/library/lib_thumb.png', 'organisations/x/covers/library/lib_thumb-thumb.webp']);
});
