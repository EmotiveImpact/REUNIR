import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSeed, DEMO_ADMIN, DEMO_USER } from '../packages/domain/src/seed';
import { applyCommand, visibleWorkspace } from '../packages/domain/src/engine';
import { beginCoverUpload, completeCoverUpload, releasedCoverKeys, resolveCoverImage, type CoverObservation } from '../packages/domain/src/covers';
import { COVER_UPLOAD_TTL_MS, MAX_COVER_BYTES, coverBytesAcceptable, coverPosition, coverUploadRequest, imageDimensions } from '../packages/contracts/src/covers';
import { commandSchema, type Workspace } from '../packages/contracts/src/index';
import { jpegHeader, pngHeader, webpHeader } from './helpers/images';

const ORG = 'org_code_black', T0 = '2026-10-03T09:00:00.000Z';
const ctx = (userId: string, organizationId = ORG) => ({ organizationId, userId, requestId: 'covers-test' });
const later = (ms: number) => new Date(Date.parse(T0) + ms).toISOString();
let n = 0; const ids = () => ({ id: `cover_upload_${++n}`, objectKey: `organisations/${ORG}/covers/test/${n}.png` });
const png = pngHeader(1600, 900);
const good: CoverObservation = { sizeBytes: 5000, contentType: 'image/png', generation: '1712345678900001', bytesAcceptable: coverBytesAcceptable('image/png', png) };
const request = (subject: 'track' | 'project', subjectId: string, extra = {}) => ({ purpose: 'cover_image' as const, subject, subjectId, contentType: 'image/png' as const, sizeBytes: 5000, ...extra });
/** Begin and verify a cover upload, returning the new state and upload ID. */
function verified(s: Workspace, user: string, subject: 'track' | 'project', subjectId: string, at = T0) {
    const begun = beginCoverUpload(s, ctx(user), request(subject, subjectId), ids(), at);
    const done = completeCoverUpload(begun.workspace, ctx(user), begun.upload.id, good, at);
    assert.equal(done.outcome, 'ready');
    return { s: done.workspace, id: begun.upload.id, expired: begun.expired };
}
const run = (s: Workspace, user: string, cmd: unknown) => applyCommand(s, ctx(user), cmd, () => T0, () => `id_${++n}`);

test('image headers report their dimensions for PNG, JPEG and every WebP variant', () => {
    assert.deepEqual(imageDimensions('image/png', pngHeader(1600, 900)), { width: 1600, height: 900 });
    assert.deepEqual(imageDimensions('image/jpeg', jpegHeader(1200, 675)), { width: 1200, height: 675 });
    assert.deepEqual(imageDimensions('image/webp', webpHeader(1600, 900, 'VP8X')), { width: 1600, height: 900 });
    assert.deepEqual(imageDimensions('image/webp', webpHeader(800, 450, 'VP8 ')), { width: 800, height: 450 });
    assert.deepEqual(imageDimensions('image/webp', webpHeader(640, 360, 'VP8L')), { width: 640, height: 360 });
    assert.equal(imageDimensions('image/png', pngHeader(10, 10).slice(0, 20)), null, 'truncated header');
    assert.equal(imageDimensions('image/jpeg', jpegHeader(10, 10).slice(0, 40)), null, 'no frame header in the bytes read');
    assert.equal(imageDimensions('image/gif', pngHeader(10, 10)), null);
});
test('cover bytes need a matching signature and a sane declared size', () => {
    assert(coverBytesAcceptable('image/jpeg', jpegHeader(1600, 900)));
    assert(coverBytesAcceptable('image/webp', webpHeader(4096, 4096)));
    assert(!coverBytesAcceptable('image/png', pngHeader(5000, 900)), 'larger than the edge limit');
    assert(!coverBytesAcceptable('image/png', pngHeader(40000, 40000)), 'a decompression bomb declares a huge canvas');
    assert(!coverBytesAcceptable('image/png', pngHeader(8, 8)), 'too small to be a cover');
    assert(!coverBytesAcceptable('image/jpeg', pngHeader(1600, 900)), 'declared type must match the bytes');
    assert(!coverBytesAcceptable('image/svg+xml', new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>')), 'SVG is never a cover');
    assert.equal(coverPosition({ focusX: 30, focusY: 70 }), '30% 70%');
});
test('requests are bounded: images only, up to 3 MB, whole-percentage focus', () => {
    assert.throws(() => coverUploadRequest.parse(request('track', 'track_story', { contentType: 'image/svg+xml' })));
    assert.throws(() => coverUploadRequest.parse(request('track', 'track_story', { sizeBytes: MAX_COVER_BYTES + 1 })));
    assert.throws(() => coverUploadRequest.parse(request('track', '../track_story')));
    assert.throws(() => coverUploadRequest.parse({ ...request('track', 'track_story'), objectKey: 'chosen-by-client' }), 'clients never name storage keys');
    assert.throws(() => commandSchema.parse({ type: 'track.cover.set', trackId: 'track_story', fileId: 'f', focusX: 101, focusY: 0 }));
    assert.throws(() => commandSchema.parse({ type: 'track.cover.set', trackId: 'track_story', fileId: 'f', focusX: 10.5, focusY: 0 }));
    assert.deepEqual(commandSchema.parse({ type: 'project.cover.set', projectId: 'project_still', fileId: null }), { type: 'project.cover.set', projectId: 'project_still', fileId: null, focusX: 50, focusY: 50 });
});
test('only owners and administrators change track covers; a project owner changes their own project cover', () => {
    const s = createSeed();
    assert.throws(() => beginCoverUpload(s, ctx(DEMO_USER), request('track', 'track_story'), ids(), T0), { code: 'COVER_EDITOR_REQUIRED' });
    assert.throws(() => beginCoverUpload(s, ctx(DEMO_USER), request('project', 'project_still'), ids(), T0), { code: 'COVER_EDITOR_REQUIRED' }, 'another member’s project');
    assert.throws(() => beginCoverUpload(s, ctx(DEMO_ADMIN), request('track', 'track_missing'), ids(), T0), { code: 'NOT_FOUND' });
    assert.equal(beginCoverUpload(s, ctx(DEMO_ADMIN), request('track', 'track_story'), ids(), T0).upload.coverTrackId, 'track_story');
    const own = beginCoverUpload(s, ctx('member_jordan'), request('project', 'project_still'), ids(), T0).upload;
    assert.deepEqual([own.coverProjectId, own.coverTrackId, own.trackId, own.purpose, own.status], ['project_still', null, null, 'cover_image', 'pending']);
    assert.throws(() => beginCoverUpload(createSeed('studio-north'), ctx(DEMO_ADMIN), request('track', 'track_story'), ids(), T0), { code: 'NOT_FOUND' }, 'another tenant');
});
test('completion accepts only the declared, verified image and pins its generation', () => {
    const s = createSeed();
    const begun = beginCoverUpload(s, ctx(DEMO_ADMIN), request('track', 'track_story'), ids(), T0);
    const id = begun.upload.id;
    assert.throws(() => completeCoverUpload(begun.workspace, ctx('member_maya'), id, good, T0), { code: 'NOT_FOUND' }, 'only the uploader completes');
    const bad = completeCoverUpload(begun.workspace, ctx(DEMO_ADMIN), id, { ...good, bytesAcceptable: false }, T0);
    assert.equal(bad.outcome, 'rejected'); assert.equal(bad.upload.generation, null);
    assert.equal(completeCoverUpload(begun.workspace, ctx(DEMO_ADMIN), id, { ...good, sizeBytes: 4999 }, T0).outcome, 'rejected');
    assert.equal(completeCoverUpload(begun.workspace, ctx(DEMO_ADMIN), id, { ...good, generation: 'abc' }, T0).outcome, 'rejected');
    assert.throws(() => completeCoverUpload(begun.workspace, ctx(DEMO_ADMIN), id, good, later(COVER_UPLOAD_TTL_MS + 1)), { code: 'UPLOAD_EXPIRED' });
    const done = completeCoverUpload(begun.workspace, ctx(DEMO_ADMIN), id, good, T0);
    assert.deepEqual([done.outcome, done.upload.status, done.upload.generation], ['ready', 'ready', good.generation]);
    assert.equal(completeCoverUpload(done.workspace, ctx(DEMO_ADMIN), id, { ...good, bytesAcceptable: false }, T0).outcome, 'unchanged');
});
test('setting a cover copies type and size from the verified upload and keeps the chosen focus', () => {
    let { s, id } = verified(createSeed(), DEMO_ADMIN, 'track', 'track_story');
    const pending = beginCoverUpload(s, ctx(DEMO_ADMIN), request('track', 'track_story'), ids(), T0); s = pending.workspace;
    assert.throws(() => run(s, DEMO_ADMIN, { type: 'track.cover.set', trackId: 'track_story', fileId: pending.upload.id }), { code: 'COVER_NOT_READY' });
    assert.throws(() => run(s, DEMO_ADMIN, { type: 'track.cover.set', trackId: 'track_product', fileId: id }), { code: 'COVER_UNAVAILABLE' }, 'an upload belongs to one track');
    assert.throws(() => run(s, DEMO_USER, { type: 'track.cover.set', trackId: 'track_story', fileId: id }), { code: 'COVER_EDITOR_REQUIRED' });
    let r = run(s, DEMO_ADMIN, { type: 'track.cover.set', trackId: 'track_story', fileId: id, focusX: 30, focusY: 65 });
    assert.deepEqual(r.workspace.tracks.find(t => t.id === 'track_story')!.coverImage, { fileId: id, contentType: 'image/png', sizeBytes: 5000, focusX: 30, focusY: 65 });
    assert(r.workspace.audit.some(a => a.action === 'track.cover.set' && a.objectId === 'track_story'));
    r = run(r.workspace, DEMO_ADMIN, { type: 'track.cover.set', trackId: 'track_story', fileId: id, focusX: 50, focusY: 10 });
    assert.equal(r.workspace.tracks.find(t => t.id === 'track_story')!.coverImage!.focusY, 10, 'refocusing keeps the same file');
    const unchanged = run(r.workspace, DEMO_ADMIN, { type: 'track.cover.set', trackId: 'track_story', fileId: id, focusX: 50, focusY: 10 });
    assert.equal(unchanged.workspace.revision, r.workspace.revision, 'an identical change records nothing');
    r = run(r.workspace, DEMO_ADMIN, { type: 'track.cover.set', trackId: 'track_story', fileId: null });
    assert.equal(r.workspace.tracks.find(t => t.id === 'track_story')!.coverImage, null);
});
test('members see covers wherever they can see the track or project, and nowhere else', () => {
    let { s, id } = verified(createSeed(), DEMO_ADMIN, 'track', 'track_story');
    s = run(s, DEMO_ADMIN, { type: 'track.cover.set', trackId: 'track_story', fileId: id }).workspace;
    assert.equal(resolveCoverImage(s, ctx(DEMO_USER), 'track', 'track_story', id).upload.generation, good.generation);
    assert.throws(() => resolveCoverImage(s, ctx(DEMO_USER), 'track', 'track_story', 'some_other_file'), { code: 'NOT_FOUND' });
    assert.throws(() => resolveCoverImage(s, ctx(DEMO_USER), 'project', 'track_story', id), { code: 'NOT_FOUND' });
    s.tracks.find(t => t.id === 'track_story')!.published = false;
    assert.throws(() => resolveCoverImage(s, ctx(DEMO_USER), 'track', 'track_story', id), { code: 'NOT_FOUND' }, 'unpublished tracks stay with administrators');
    assert.ok(resolveCoverImage(s, ctx(DEMO_ADMIN), 'track', 'track_story', id));
    // A project in the private studio space: the cover follows the space.
    const made = run(s, DEMO_ADMIN, { type: 'project.create', title: 'Studio plan', tagline: 'Private planning.', summary: 'Only for the studio.', category: 'Ops', skills: [], spaceId: 'space_studio' });
    const pid = made.objectId!, own = verified(made.workspace, DEMO_ADMIN, 'project', pid);
    s = run(own.s, DEMO_ADMIN, { type: 'project.cover.set', projectId: pid, fileId: own.id }).workspace;
    assert.ok(resolveCoverImage(s, ctx(DEMO_ADMIN), 'project', pid, own.id));
    assert.throws(() => resolveCoverImage(s, ctx(DEMO_USER), 'project', pid, own.id), { code: 'NOT_FOUND' });
    assert.throws(() => resolveCoverImage(s, ctx(DEMO_USER, 'org_studio_north'), 'project', pid, own.id), { code: 'NOT_FOUND' }, 'tenant mismatch');
    const member = visibleWorkspace(s, ctx(DEMO_USER));
    assert.deepEqual(member.uploads, [], 'cover upload records never reach the browser');
    assert(!JSON.stringify(member).includes('covers/test'), 'no storage keys in the workspace');
    s.members.find(m => m.userId === DEMO_USER)!.status = 'suspended';
    assert.throws(() => resolveCoverImage(s, ctx(DEMO_USER), 'track', 'track_product', id), { code: 'FORBIDDEN' });
});
test('starting an upload prunes rejected, stale and replaced covers but never the one in use', () => {
    let first = verified(createSeed(), DEMO_ADMIN, 'track', 'track_story');
    let s = run(first.s, DEMO_ADMIN, { type: 'track.cover.set', trackId: 'track_story', fileId: first.id }).workspace;
    const second = verified(s, DEMO_ADMIN, 'track', 'track_story');
    s = run(second.s, DEMO_ADMIN, { type: 'track.cover.set', trackId: 'track_story', fileId: second.id }).workspace;
    assert(!s.uploads.some(u => u.id === first.id), 'the replaced cover went with the change');
    const rejected = beginCoverUpload(s, ctx(DEMO_ADMIN), request('track', 'track_product'), ids(), T0);
    s = completeCoverUpload(rejected.workspace, ctx(DEMO_ADMIN), rejected.upload.id, { ...good, bytesAcceptable: false }, T0).workspace;
    const stale = beginCoverUpload(s, ctx(DEMO_ADMIN), request('project', 'project_still'), ids(), T0); s = stale.workspace;
    assert.deepEqual(stale.expired.map(x => x.id), [rejected.upload.id], 'a rejected upload goes at the next start');
    const next = beginCoverUpload(s, ctx(DEMO_ADMIN), request('track', 'track_brand'), ids(), later(COVER_UPLOAD_TTL_MS + 1));
    assert.deepEqual(next.expired.map(x => x.id), [stale.upload.id], 'a stale upload goes after an hour');
    assert(next.workspace.uploads.some(u => u.id === second.id), 'the current cover stays stored');
    assert(!next.workspace.uploads.some(u => next.expired.some(x => x.id === u.id)));
});
test('pending uploads are capped per person', () => {
    let s = createSeed();
    for (let i = 0; i < 3; i++) s = beginCoverUpload(s, ctx(DEMO_ADMIN), request('track', 'track_story'), ids(), T0).workspace;
    assert.throws(() => beginCoverUpload(s, ctx(DEMO_ADMIN), request('track', 'track_story'), ids(), T0), { code: 'UPLOADS_IN_PROGRESS' });
    assert.ok(beginCoverUpload(s, ctx('member_jordan'), request('project', 'project_still'), ids(), T0), 'other people are not blocked');
});
test('a replaced or removed cover picture goes at once; a library picture and a shared file stay', () => {
    const first = verified(createSeed(), DEMO_ADMIN, 'track', 'track_story');
    let s = run(first.s, DEMO_ADMIN, { type: 'track.cover.set', trackId: 'track_story', fileId: first.id }).workspace;
    const second = verified(s, DEMO_ADMIN, 'track', 'track_story');
    const before = run(second.s, DEMO_ADMIN, { type: 'track.cover.set', trackId: 'track_story', fileId: first.id, focusX: 20, focusY: 30 }).workspace;
    assert(before.uploads.some(u => u.id === first.id), 'moving the focal point keeps the picture');
    assert(before.uploads.some(u => u.id === second.id), 'an upload not yet shown stays until it is chosen or expires');
    const replaced = run(before, DEMO_ADMIN, { type: 'track.cover.set', trackId: 'track_story', fileId: second.id }).workspace;
    assert.deepEqual(releasedCoverKeys(before, replaced), [first.s.uploads.find(u => u.id === first.id)!.objectKey]);
    const removed = run(replaced, DEMO_ADMIN, { type: 'track.cover.set', trackId: 'track_story', fileId: null }).workspace;
    assert(!removed.uploads.some(u => u.id === second.id), 'removing the cover removes its picture');
    assert.equal(releasedCoverKeys(replaced, removed).length, 1);
    assert.deepEqual(releasedCoverKeys(removed, removed), [], 'nothing else is released');
});

test('a cover description is kept with its picture, cleared with a new one, and validated', () => {
    let { s, id } = verified(createSeed(), DEMO_ADMIN, 'track', 'track_story');
    const set = (extra: Record<string, unknown>) => run(s, DEMO_ADMIN, { type: 'track.cover.set', trackId: 'track_story', fileId: id, focusX: 40, focusY: 60, ...extra });
    let r = set({ description: '  Hands sketching on a notebook beside a laptop  ' });
    assert.equal(r.message, 'Cover and its description saved.');
    s = r.workspace;
    const cover = () => s.tracks.find(t => t.id === 'track_story')!.coverImage!;
    assert.equal(cover().description, 'Hands sketching on a notebook beside a laptop', 'trimmed');
    s = set({ focusX: 10 }).workspace;
    assert.equal(cover().description, 'Hands sketching on a notebook beside a laptop', 'moving the focal point without a description keeps it');
    s = set({ description: '' }).workspace;
    assert.equal(cover().description, undefined, 'an empty description makes the picture decorative');
    s = set({ description: 'A quiet studio' }).workspace;
    const next = verified(s, DEMO_ADMIN, 'track', 'track_story');
    s = next.s; id = next.id;
    s = set({}).workspace;
    assert.equal(cover().description, undefined, 'a new picture starts without the old description');
    for (const bad of ['x'.repeat(151), 'Line one\nline two', 'Tab\there'])
        assert.equal(commandSchema.safeParse({ type: 'track.cover.set', trackId: 'track_story', fileId: id, description: bad }).success, false, JSON.stringify(bad));
    assert.equal(commandSchema.safeParse({ type: 'project.cover.set', projectId: 'project_still', fileId: null }).success, true, 'removal needs no description');
    assert.equal(visibleWorkspace(set({ description: 'A quiet studio' }).workspace, ctx(DEMO_USER)).tracks.find(t => t.id === 'track_story')?.coverImage?.description, 'A quiet studio', 'members receive it to read aloud');
});
