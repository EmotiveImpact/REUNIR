import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSeed, DEMO_ADMIN, DEMO_INSTRUCTOR, DEMO_USER } from '../packages/domain/src/seed';
import { applyCommand, visibleWorkspace } from '../packages/domain/src/engine';
import { DEMO_COVER_LIBRARY_FILE } from '../packages/domain/src/demo-files';
import {
    beginCoverLibraryUpload, beginCoverUpload, completeCoverUpload, removeCoverLibraryItem, resolveCoverImage, resolveLibraryPicture, type CoverObservation,
} from '../packages/domain/src/covers';
import { COVER_UPLOAD_TTL_MS, MAX_COVER_BYTES, MAX_COVER_LIBRARY_ITEMS, coverBytesAcceptable, coverLibraryUploadRequest } from '../packages/contracts/src/covers';
import { commandSchema, type Workspace } from '../packages/contracts/src/index';
import { pngHeader } from './helpers/images';
import { readFileSync } from 'node:fs';
import { imageDimensions } from '../packages/contracts/src/covers';

const ORG = 'org_code_black', T0 = '2026-10-03T09:00:00.000Z';
const ctx = (userId: string, organizationId = ORG) => ({ organizationId, userId, requestId: 'cover-library-test' });
const later = (ms: number) => new Date(Date.parse(T0) + ms).toISOString();
let n = 0; const ids = () => ({ id: `library_upload_${++n}`, objectKey: `organisations/${ORG}/covers/library/${n}.png` });
const good: CoverObservation = { sizeBytes: 5000, contentType: 'image/png', generation: '1712345678900001', bytesAcceptable: coverBytesAcceptable('image/png', pngHeader(1600, 900)) };
const request = (extra = {}) => ({ purpose: 'cover_library' as const, contentType: 'image/png' as const, sizeBytes: 5000, ...extra });
const run = (s: Workspace, user: string, cmd: unknown) => applyCommand(s, ctx(user), cmd, () => T0, () => `id_${++n}`);
/** Upload, verify and list a picture as an administrator. Returns the new state, the upload and the library item. */
function listed(s: Workspace, label = 'Harbour at dawn', user = DEMO_ADMIN, at = T0) {
    const begun = beginCoverLibraryUpload(s, ctx(user), request(), ids(), at);
    const done = completeCoverUpload(begun.workspace, ctx(user), begun.upload.id, good, at);
    assert.equal(done.outcome, 'ready');
    const added = run(done.workspace, user, { type: 'cover.library.add', fileId: begun.upload.id, label });
    return { s: added.workspace, fileId: begun.upload.id, itemId: added.objectId!, message: added.message };
}

test('library requests carry no track, project or storage key, and labels are short', () => {
    assert.deepEqual(coverLibraryUploadRequest.parse(request()), request());
    assert.throws(() => coverLibraryUploadRequest.parse(request({ subject: 'track', subjectId: 'track_story' })), 'a library picture belongs to no track');
    assert.throws(() => coverLibraryUploadRequest.parse(request({ objectKey: 'chosen-by-client' })), 'clients never name storage keys');
    assert.throws(() => coverLibraryUploadRequest.parse(request({ contentType: 'image/svg+xml' })));
    assert.throws(() => coverLibraryUploadRequest.parse(request({ sizeBytes: MAX_COVER_BYTES + 1 })));
    assert.deepEqual(commandSchema.parse({ type: 'cover.library.add', fileId: 'f1', label: '  Harbour  ' }), { type: 'cover.library.add', fileId: 'f1', label: 'Harbour', tags: [] });
    assert.throws(() => commandSchema.parse({ type: 'cover.library.add', fileId: 'f1', label: '   ' }));
    assert.throws(() => commandSchema.parse({ type: 'cover.library.add', fileId: 'f1', label: 'x'.repeat(81) }));
    assert.throws(() => commandSchema.parse({ type: 'cover.library.add', fileId: 'f1', label: 'Harbour', addedBy: DEMO_USER }), 'the server records who added it');
});
test('the demo library has one fictional picture, and another community has none', () => {
    const s = createSeed();
    assert.deepEqual(s.coverLibrary.map(i => [i.id, i.fileId, i.label, i.addedBy]), [['library_mountain', DEMO_COVER_LIBRARY_FILE, 'Mountain ridge', DEMO_ADMIN]]);
    assert.equal(s.uploads.find(u => u.id === DEMO_COVER_LIBRARY_FILE)!.purpose, 'cover_library');
    assert.deepEqual(createSeed('studio-north').coverLibrary, []);
});
test('the demo picture the browser shows matches its seeded record and carries no words or metadata', () => {
    const bytes = new Uint8Array(readFileSync(new URL('../apps/web/src/assets/library-mountain.jpg', import.meta.url)));
    const upload = createSeed().uploads.find(u => u.id === DEMO_COVER_LIBRARY_FILE)!, item = createSeed().coverLibrary[0];
    assert.deepEqual([upload.sizeBytes, item.sizeBytes, upload.contentType, item.contentType], [bytes.length, bytes.length, 'image/jpeg', 'image/jpeg']);
    assert(coverBytesAcceptable('image/jpeg', bytes));
    assert.deepEqual(imageDimensions('image/jpeg', bytes), { width: 440, height: 288 }, 'cropped above the caption the original carries');
    assert(!Buffer.from(bytes).includes('Exif'), 'no camera metadata');
});
test('only active owners and administrators upload, list and remove library pictures', () => {
    const s = createSeed();
    for (const user of [DEMO_USER, DEMO_INSTRUCTOR, 'member_jordan']) {
        assert.throws(() => beginCoverLibraryUpload(s, ctx(user), request(), ids(), T0), { code: 'ADMIN_REQUIRED' }, user);
        assert.throws(() => run(s, user, { type: 'cover.library.add', fileId: DEMO_COVER_LIBRARY_FILE, label: 'Mine now' }), { code: 'ADMIN_REQUIRED' }, user);
        assert.throws(() => removeCoverLibraryItem(s, ctx(user), 'library_mountain', T0), { code: 'ADMIN_REQUIRED' }, user);
    }
    const begun = beginCoverLibraryUpload(s, ctx(DEMO_ADMIN), request(), ids(), T0);
    assert.deepEqual([begun.upload.purpose, begun.upload.status, begun.upload.trackId, begun.upload.coverTrackId, begun.upload.coverProjectId], ['cover_library', 'pending', null, null, null]);
    const suspended = structuredClone(begun.workspace);
    suspended.members.find(m => m.userId === DEMO_ADMIN)!.status = 'suspended';
    assert.throws(() => completeCoverUpload(suspended, ctx(DEMO_ADMIN), begun.upload.id, good, T0), { code: 'FORBIDDEN' }, 'suspension ends it at once');
    const demoted = structuredClone(begun.workspace);
    demoted.members.find(m => m.userId === DEMO_ADMIN)!.role = 'member';
    assert.throws(() => completeCoverUpload(demoted, ctx(DEMO_ADMIN), begun.upload.id, good, T0), { code: 'ADMIN_REQUIRED' }, 'a former administrator cannot finish');
    assert.throws(() => beginCoverLibraryUpload(createSeed('studio-north'), ctx(DEMO_ADMIN), request(), ids(), T0), { code: 'NOT_FOUND' }, 'another tenant');
});
test('a picture joins the library only after verification, with its type and size from the upload', () => {
    let s = createSeed();
    const begun = beginCoverLibraryUpload(s, ctx(DEMO_ADMIN), request(), ids(), T0); s = begun.workspace;
    assert.throws(() => run(s, DEMO_ADMIN, { type: 'cover.library.add', fileId: begun.upload.id, label: 'Too soon' }), { code: 'COVER_NOT_READY' });
    assert.throws(() => completeCoverUpload(s, ctx('member_maya'), begun.upload.id, good, T0), { code: 'NOT_FOUND' }, 'only the uploader completes');
    const rejected = completeCoverUpload(s, ctx(DEMO_ADMIN), begun.upload.id, { ...good, bytesAcceptable: false }, T0);
    assert.equal(rejected.outcome, 'rejected');
    assert(rejected.workspace.audit.some(a => a.action === 'cover.library.rejected' && a.objectId === begun.upload.id));
    assert.throws(() => run(rejected.workspace, DEMO_ADMIN, { type: 'cover.library.add', fileId: begun.upload.id, label: 'Rejected' }), { code: 'COVER_NOT_READY' });
    const done = completeCoverUpload(s, ctx(DEMO_ADMIN), begun.upload.id, good, T0);
    assert(done.workspace.audit.some(a => a.action === 'cover.library.uploaded' && a.objectId === begun.upload.id));
    const added = run(done.workspace, DEMO_ADMIN, { type: 'cover.library.add', fileId: begun.upload.id, label: 'Harbour at dawn' });
    assert.equal(added.message, 'Harbour at dawn is in the cover library.');
    const item = added.workspace.coverLibrary.find(i => i.id === added.objectId)!;
    assert.deepEqual([item.fileId, item.label, item.contentType, item.sizeBytes, item.addedBy], [begun.upload.id, 'Harbour at dawn', 'image/png', 5000, DEMO_ADMIN]);
    assert(added.workspace.audit.some(a => a.action === 'cover.library.add' && a.objectId === item.id));
    const again = run(added.workspace, DEMO_ADMIN, { type: 'cover.library.add', fileId: begun.upload.id, label: 'Twice' });
    assert.equal(again.workspace.coverLibrary.length, added.workspace.coverLibrary.length, 'a picture is listed once');
    assert.equal(again.workspace.revision, added.workspace.revision, 'repeating it records nothing');
    // A track's own cover upload is not a library picture, and nothing crosses communities.
    const own = beginCoverUpload(added.workspace, ctx(DEMO_ADMIN), { purpose: 'cover_image', subject: 'track', subjectId: 'track_story', contentType: 'image/png', sizeBytes: 5000 }, ids(), T0);
    const ownDone = completeCoverUpload(own.workspace, ctx(DEMO_ADMIN), own.upload.id, good, T0).workspace;
    assert.throws(() => run(ownDone, DEMO_ADMIN, { type: 'cover.library.add', fileId: own.upload.id, label: 'Borrowed' }), { code: 'COVER_UNAVAILABLE' });
    const other = createSeed('studio-north');
    other.uploads.push(structuredClone(createSeed().uploads.find(u => u.id === DEMO_COVER_LIBRARY_FILE)!));
    assert.throws(() => applyCommand(other, ctx(DEMO_ADMIN, 'org_studio_north'), { type: 'cover.library.add', fileId: DEMO_COVER_LIBRARY_FILE, label: 'Elsewhere' }, () => T0, () => 'x'), { code: 'COVER_UNAVAILABLE' }, 'another community’s upload, even if a row leaked');
});
test('the library holds a bounded number of pictures', () => {
    let s = createSeed();
    for (let i = s.coverLibrary.length; i < MAX_COVER_LIBRARY_ITEMS; i++) s = listed(s, `Picture ${i}`).s;
    assert.equal(s.coverLibrary.length, MAX_COVER_LIBRARY_ITEMS);
    assert.throws(() => beginCoverLibraryUpload(s, ctx(DEMO_ADMIN), request(), ids(), T0), { code: 'LIBRARY_FULL' });
    const removed = removeCoverLibraryItem(s, ctx(DEMO_ADMIN), s.coverLibrary[1].id, T0);
    assert.ok(beginCoverLibraryUpload(removed.workspace, ctx(DEMO_ADMIN), request(), ids(), T0), 'removing one makes room');
});
test('anyone who may change a cover can choose a library picture, and nobody else', () => {
    let { s, fileId } = listed(createSeed());
    // The instructor of the product track, the project's owner and an administrator.
    s = run(s, DEMO_INSTRUCTOR, { type: 'track.cover.set', trackId: 'track_product', fileId, focusX: 40, focusY: 60 }).workspace;
    assert.deepEqual(s.tracks.find(t => t.id === 'track_product')!.coverImage, { fileId, contentType: 'image/png', sizeBytes: 5000, focusX: 40, focusY: 60 });
    s = run(s, 'member_jordan', { type: 'project.cover.set', projectId: 'project_still', fileId: DEMO_COVER_LIBRARY_FILE }).workspace;
    assert.equal(s.projects.find(p => p.id === 'project_still')!.coverImage!.fileId, DEMO_COVER_LIBRARY_FILE);
    s = run(s, DEMO_ADMIN, { type: 'track.cover.set', trackId: 'track_story', fileId }).workspace;
    assert.equal(s.tracks.find(t => t.id === 'track_story')!.coverImage!.fileId, fileId, 'one picture can cover several tracks');
    assert.throws(() => run(s, DEMO_USER, { type: 'track.cover.set', trackId: 'track_brand', fileId }), { code: 'COVER_EDITOR_REQUIRED' });
    assert.throws(() => run(s, DEMO_INSTRUCTOR, { type: 'track.cover.set', trackId: 'track_brand', fileId }), { code: 'COVER_EDITOR_REQUIRED' }, 'not their track');
    // An uploaded picture that was never listed is not a choice.
    const unlisted = beginCoverLibraryUpload(s, ctx(DEMO_ADMIN), request(), ids(), T0);
    const ready = completeCoverUpload(unlisted.workspace, ctx(DEMO_ADMIN), unlisted.upload.id, good, T0).workspace;
    assert.throws(() => run(ready, DEMO_ADMIN, { type: 'track.cover.set', trackId: 'track_brand', fileId: unlisted.upload.id }), { code: 'COVER_UNAVAILABLE' });
});
test('every active member sees the library; covers made from it follow the track or project', () => {
    let { s, fileId, itemId } = listed(createSeed());
    s = run(s, DEMO_ADMIN, { type: 'track.cover.set', trackId: 'track_story', fileId }).workspace;
    assert.equal(resolveLibraryPicture(s, ctx(DEMO_USER), itemId).upload.generation, good.generation);
    assert.equal(resolveLibraryPicture(s, ctx(DEMO_USER), 'library_mountain').upload.id, DEMO_COVER_LIBRARY_FILE);
    assert.throws(() => resolveLibraryPicture(s, ctx(DEMO_USER), 'library_missing'), { code: 'NOT_FOUND' });
    assert.equal(resolveCoverImage(s, ctx(DEMO_USER), 'track', 'track_story', fileId).upload.id, fileId);
    s.tracks.find(t => t.id === 'track_story')!.published = false;
    assert.throws(() => resolveCoverImage(s, ctx(DEMO_USER), 'track', 'track_story', fileId), { code: 'NOT_FOUND' }, 'an unpublished track keeps its cover to itself');
    const member = visibleWorkspace(s, ctx(DEMO_USER));
    assert.deepEqual(member.coverLibrary.map(i => i.label).sort(), ['Harbour at dawn', 'Mountain ridge']);
    assert.deepEqual(member.uploads, [], 'upload records never reach the browser');
    assert(!JSON.stringify(member).includes('covers/library'), 'no storage keys in the workspace');
    const other = createSeed('studio-north');
    other.coverLibrary.push({ ...s.coverLibrary[0], organizationId: 'org_code_black' });
    assert.deepEqual(visibleWorkspace(other, ctx(DEMO_ADMIN, other.organisation.id)).coverLibrary, [], 'another community’s rows never travel');
    s.members.find(m => m.userId === DEMO_USER)!.status = 'suspended';
    assert.throws(() => resolveLibraryPicture(s, ctx(DEMO_USER), itemId), { code: 'FORBIDDEN' });
});
test('a picture in use cannot be removed; once free, it leaves with its stored file', () => {
    let { s, fileId, itemId } = listed(createSeed());
    s = run(s, DEMO_ADMIN, { type: 'track.cover.set', trackId: 'track_story', fileId }).workspace;
    s = run(s, 'member_jordan', { type: 'project.cover.set', projectId: 'project_still', fileId }).workspace;
    assert.throws(() => removeCoverLibraryItem(s, ctx(DEMO_ADMIN), itemId, T0), { code: 'COVER_IN_USE', message: /2 tracks or projects/ });
    s = run(s, DEMO_ADMIN, { type: 'track.cover.set', trackId: 'track_story', fileId: null }).workspace;
    assert.throws(() => removeCoverLibraryItem(s, ctx(DEMO_ADMIN), itemId, T0), { code: 'COVER_IN_USE', message: /1 track or project/ });
    s = run(s, 'member_jordan', { type: 'project.cover.set', projectId: 'project_still', fileId: null }).workspace;
    const removed = removeCoverLibraryItem(s, ctx(DEMO_ADMIN), itemId, T0);
    assert.equal(removed.objectKey, s.uploads.find(u => u.id === fileId)!.objectKey);
    assert(!removed.workspace.coverLibrary.some(i => i.id === itemId));
    assert(!removed.workspace.uploads.some(u => u.id === fileId), 'the upload record goes too');
    assert(removed.workspace.audit.some(a => a.action === 'cover.library.removed' && a.objectId === itemId));
    assert.throws(() => removeCoverLibraryItem(removed.workspace, ctx(DEMO_ADMIN), itemId, T0), { code: 'NOT_FOUND' });
    assert.throws(() => run(removed.workspace, DEMO_ADMIN, { type: 'track.cover.set', trackId: 'track_story', fileId }), { code: 'COVER_UNAVAILABLE' });
});
test('unlisted library uploads are pruned; listed pictures and track covers are not', () => {
    let s = createSeed();
    const stale = beginCoverLibraryUpload(s, ctx(DEMO_ADMIN), request(), ids(), T0); s = stale.workspace;
    const bad = beginCoverLibraryUpload(s, ctx(DEMO_ADMIN), request(), ids(), T0);
    s = completeCoverUpload(bad.workspace, ctx(DEMO_ADMIN), bad.upload.id, { ...good, bytesAcceptable: false }, T0).workspace;
    const kept = beginCoverLibraryUpload(s, ctx(DEMO_ADMIN), request(), ids(), T0);
    assert.deepEqual(kept.expired.map(x => x.id), [bad.upload.id], 'a rejected upload goes at the next start');
    s = completeCoverUpload(kept.workspace, ctx(DEMO_ADMIN), kept.upload.id, good, T0).workspace;
    s = run(s, DEMO_ADMIN, { type: 'cover.library.add', fileId: kept.upload.id, label: 'Kept' }).workspace;
    const next = beginCoverLibraryUpload(s, ctx(DEMO_ADMIN), request(), ids(), later(COVER_UPLOAD_TTL_MS + 1));
    assert.deepEqual(next.expired.map(x => x.id), [stale.upload.id], 'an unfinished upload goes after an hour');
    assert(next.workspace.uploads.some(u => u.id === kept.upload.id) && next.workspace.uploads.some(u => u.id === DEMO_COVER_LIBRARY_FILE), 'listed pictures stay, however old');
    const track = beginCoverUpload(s, ctx(DEMO_ADMIN), { purpose: 'cover_image', subject: 'track', subjectId: 'track_story', contentType: 'image/png', sizeBytes: 5000 }, ids(), later(COVER_UPLOAD_TTL_MS + 1));
    assert.deepEqual(track.expired, [], 'track cover pruning leaves library uploads alone');
});
test('pending library uploads are capped per person', () => {
    let s = createSeed();
    for (let i = 0; i < 3; i++) s = beginCoverLibraryUpload(s, ctx(DEMO_ADMIN), request(), ids(), T0).workspace;
    assert.throws(() => beginCoverLibraryUpload(s, ctx(DEMO_ADMIN), request(), ids(), T0), { code: 'UPLOADS_IN_PROGRESS' });
});
