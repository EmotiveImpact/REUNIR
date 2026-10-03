import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { commandSchema, type Workspace } from '../packages/contracts/src/index';
import {
    MAX_LESSON_RESOURCES, MAX_RESOURCE_BYTES, RESOURCE_UPLOAD_TTL_MS, attachmentDisposition, fileSignatureMatches, lessonResourceInput, lessonResourcesInput,
    resourceFileName, resourceTypeForFile, resourceUploadRequest, type LessonResource,
} from '../packages/contracts/src/lesson-resources';
import { applyCommand, visibleWorkspace, progress } from '../packages/domain/src/engine';
import { lessonContent } from '../packages/domain/src/authoring';
import { beginResourceUpload, completeResourceUpload, discardResourceUpload, resolveResourceDownload, type StoredObservation } from '../packages/domain/src/resources';
import { DEMO_COVER_LIBRARY_FILE, DEMO_WORKSHEET_FILE, demoWorksheetPdf } from '../packages/domain/src/demo-files';
import { createSeed, DEMO_ADMIN, DEMO_USER } from '../packages/domain/src/seed';
import { ResourceList } from '../apps/web/src/components/resource-list';

const ORG = 'org_code_black', PDF = 'application/pdf' as const, NOW = '2026-10-02T12:00:00.000Z';
let seq = 0;
const ctx = (userId = DEMO_ADMIN, organizationId = ORG) => ({ organizationId, userId, requestId: 'resources_test' });
const run = (s: Workspace, cmd: unknown, user = DEMO_ADMIN) => applyCommand(s, ctx(user), cmd, () => NOW, () => `res_${++seq}`).workspace;
const pdf = (text = 'fictional') => new TextEncoder().encode(`%PDF-1.4\n% ${text}\n`);
const seen = (bytes: Uint8Array, contentType = PDF): StoredObservation => ({ sizeBytes: bytes.length, contentType, generation: '1712345678901234', signatureMatches: fileSignatureMatches(contentType, bytes) });
/** Upload and verify a file as the given administrator. Returns the new state and upload id. */
function stored(s: Workspace, name = 'Extra notes.pdf', bytes = pdf(name), user = DEMO_ADMIN, trackId = 'track_product') {
    const id = `upload_${++seq}`;
    const begun = beginResourceUpload(s, ctx(user), { purpose: 'lesson_resource', trackId, name, contentType: PDF, sizeBytes: bytes.length }, { id, objectKey: `organisations/${ORG}/lesson-resources/${trackId}/${id}.pdf` }, NOW, () => `res_${++seq}`);
    const done = completeResourceUpload(begun.workspace, ctx(user), id, seen(bytes), NOW, () => `res_${++seq}`);
    assert.equal(done.outcome, 'ready');
    return { s: done.workspace, id };
}
const open = (s = createSeed(), lessonId: string | null = 'lesson_4') => run(s, { type: 'lesson.draft.create', trackId: 'track_product', lessonId });
const draft = (s: Workspace) => s.lessonDrafts[0];
const save = (s: Workspace, resources: unknown, user = DEMO_ADMIN) => run(s, { type: 'lesson.draft.save', draftId: draft(s).id, expectedVersion: draft(s).version, ...lessonContent(draft(s)), resources }, user);
const publish = (s: Workspace) => run(s, { type: 'lesson.draft.publish', draftId: draft(s).id, expectedVersion: draft(s).version });
const entry = (fileId: string, name = 'Extra notes', id = 'resource_' + fileId) => ({ id, fileId, name, description: '' });
const download = (s: Workspace, context: 'lesson' | 'draft' | 'revision', recordId: string, resourceId: string, user = DEMO_USER, org = ORG) => resolveResourceDownload(s, ctx(user, org), { context, recordId, resourceId });
const lesson = (s: Workspace) => s.lessons.find(l => l.id === 'lesson_4')!;
const seeded = 'resource_problem_worksheet';
/** Draft of lesson 4 with the seeded worksheet plus one new file, saved and published. */
function published() {
    const a = stored(open());
    const s = publish(save(a.s, [...lessonContent(draft(a.s)).resources, entry(a.id)]));
    return { s, id: a.id };
}

test('only allowed lesson file types, sizes and names reach an upload intent', () => {
    assert(resourceUploadRequest.safeParse({ purpose: 'lesson_resource', trackId: 'track_product', name: 'Slides.pptx', contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', sizeBytes: 10 }).success);
    for (const bad of [{ contentType: 'text/html' }, { contentType: 'image/svg+xml' }, { sizeBytes: 0 }, { sizeBytes: MAX_RESOURCE_BYTES + 1 }, { name: '../secret.pdf' }, { name: 'a\u0000.pdf' }, { objectKey: 'chosen/by/client' }])
        assert.equal(resourceUploadRequest.safeParse({ purpose: 'lesson_resource', trackId: 'track_product', name: 'x.pdf', contentType: PDF, sizeBytes: 10, ...bad }).success, false, JSON.stringify(bad));
    assert.equal(resourceTypeForFile('Deck.PPTX', ''), 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    assert.equal(resourceTypeForFile('photo.jpeg', 'application/octet-stream'), 'image/jpeg');
    assert.equal(resourceTypeForFile('legacy.doc', 'application/msword'), null);
    assert.equal(resourceTypeForFile('page.html', 'text/html'), null);
});
test('stored bytes must carry the declared file signature', () => {
    assert(fileSignatureMatches(PDF, pdf()));
    assert(fileSignatureMatches(PDF, new TextEncoder().encode('\n\n%PDF-1.7 tolerated within the first kilobyte')));
    assert(fileSignatureMatches('image/png', Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])));
    assert(fileSignatureMatches('image/jpeg', Uint8Array.from([0xff, 0xd8, 0xff, 0xe0])));
    assert(fileSignatureMatches('image/webp', new TextEncoder().encode('RIFF\u0000\u0000\u0000\u0000WEBPVP8 ')));
    assert(fileSignatureMatches('application/vnd.openxmlformats-officedocument.wordprocessingml.document', Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 1])));
    for (const [type, bytes] of [[PDF, new TextEncoder().encode('<html><script>alert(1)</script>')], [PDF, new Uint8Array()], ['image/png', Uint8Array.from([0xff, 0xd8, 0xff])], ['image/webp', new TextEncoder().encode('RIFF....WAVE')], ['text/html', pdf()]] as const)
        assert.equal(fileSignatureMatches(type, bytes), false, type);
});
test('download names are safe, keep the author label and use the verified extension', () => {
    assert.equal(resourceFileName('Problem interview worksheet', PDF), 'Problem interview worksheet.pdf');
    assert.equal(resourceFileName('Already named.PDF', PDF), 'Already named.PDF');
    assert.equal(resourceFileName('photo.jpeg', 'image/jpeg'), 'photo.jpeg');
    assert.equal(resourceFileName('../../etc/passwd', PDF), 'etc passwd.pdf');
    assert.equal(resourceFileName('Notes "quoted"\r\nInjected: header', PDF), 'Notes quoted Injected header.pdf');
    assert.equal(resourceFileName('...', PDF), 'lesson-resource.pdf');
    assert.equal(resourceFileName('Café résumé 简历', PDF), 'Café résumé 简历.pdf');
    const header = attachmentDisposition('Café "plan"; x.pdf');
    assert(header.startsWith('attachment; filename="Caf_ _plan__ x.pdf"; filename*=UTF-8\'\'Caf%C3%A9%20%22plan%22%3B%20x.pdf'), header);
    assert(!/[\r\n]/.test(attachmentDisposition(resourceFileName('a\r\nSet-Cookie: x', PDF))));
});
test('submitted resource entries are strict, bounded and unique', () => {
    const ok = { id: 'r1', fileId: 'f1', name: 'Worksheet' };
    assert(lessonResourceInput.safeParse(ok).success);
    for (const bad of [{ ...ok, objectKey: 'k' }, { ...ok, name: '' }, { ...ok, name: 'x'.repeat(121) }, { ...ok, name: 'Line\nbreak' }, { ...ok, description: 'd'.repeat(281) }, { ...ok, fileId: '../f' }, { ...ok, contentType: 'text/html' }])
        assert.equal(lessonResourceInput.safeParse(bad).success, false, JSON.stringify(bad));
    assert.equal(lessonResourcesInput.safeParse([ok, { ...ok, fileId: 'f2' }]).success, false);
    assert.equal(lessonResourcesInput.safeParse([ok, { ...ok, id: 'r2' }]).success, false);
    assert.equal(lessonResourcesInput.safeParse(Array.from({ length: MAX_LESSON_RESOURCES + 1 }, (_, i) => ({ id: 'r' + i, fileId: 'f' + i, name: 'N' }))).success, false);
    assert.equal(commandSchema.safeParse({ type: 'lesson.draft.save', draftId: 'd', expectedVersion: 1, title: 'T', summary: 'S', body: 'B', minutes: 3, resources: [{ ...ok, url: 'https://evil.test' }] }).success, false);
});
test('old browser snapshots gain an empty upload collection; members never receive upload records', () => {
    const s = createSeed(); delete (s as Partial<Workspace>).uploads;
    assert.deepEqual(visibleWorkspace(s, ctx(DEMO_USER)).uploads, []);
    const admin = visibleWorkspace(createSeed(), ctx());
    assert.equal(admin.uploads.length, 1);
    assert(admin.uploads.every(u => u.objectKey === '' && u.generation === null));
    assert.deepEqual(visibleWorkspace(createSeed(), ctx(DEMO_USER)).uploads, []);
});
test('only active owners and administrators can begin lesson uploads', () => {
    const request = { purpose: 'lesson_resource' as const, trackId: 'track_product', name: 'x.pdf', contentType: PDF, sizeBytes: 10 } as const;
    const ids = { id: 'u1', objectKey: 'k1' };
    for (const role of ['member', 'moderator'] as const) {
        const s = createSeed(); s.members.find(m => m.userId === 'member_maya')!.role = role;
        assert.throws(() => beginResourceUpload(s, ctx('member_maya'), request, ids, NOW), { code: 'AUTHOR_REQUIRED' });
    }
    const suspended = createSeed(); suspended.members.find(m => m.userId === DEMO_ADMIN)!.status = 'suspended';
    assert.throws(() => beginResourceUpload(suspended, ctx(), request, ids, NOW), { code: 'FORBIDDEN' });
    assert.throws(() => beginResourceUpload(createSeed(), ctx(DEMO_ADMIN, 'org_studio_north'), request, ids, NOW), { code: 'NOT_FOUND' });
    assert.throws(() => beginResourceUpload(createSeed(), ctx(), { ...request, trackId: 'track_elsewhere' }, ids, NOW), { code: 'NOT_FOUND' });
    assert.throws(() => beginResourceUpload(createSeed(), ctx(), { ...request, contentType: 'text/html' as typeof PDF }, ids, NOW));
});
test('an upload intent is recorded before storage is involved, without mutating the input', () => {
    const input = createSeed(), before = structuredClone(input);
    const r = beginResourceUpload(input, ctx(), { purpose: 'lesson_resource', trackId: 'track_product', name: 'Notes.pdf', contentType: PDF, sizeBytes: 12 }, { id: 'u1', objectKey: 'server/chosen/key.pdf' }, NOW);
    assert.deepEqual(input, before);
    assert.equal(r.upload.status, 'pending'); assert.equal(r.upload.objectKey, 'server/chosen/key.pdf'); assert.equal(r.upload.userId, DEMO_ADMIN); assert.equal(r.upload.trackId, 'track_product');
    assert.equal(r.workspace.revision, input.revision + 1);
    assert(!JSON.stringify(r.workspace.outbox).includes('Notes.pdf'));
});
test('abandoned and rejected intents are pruned; pending and community caps are enforced', () => {
    let s = createSeed();
    const request = (name: string) => ({ purpose: 'lesson_resource' as const, trackId: 'track_product', name, contentType: PDF, sizeBytes: 9 });
    s = beginResourceUpload(s, ctx(), request('old.pdf'), { id: 'old', objectKey: 'k-old' }, '2026-10-02T08:00:00.000Z').workspace;
    const first = beginResourceUpload(s, ctx(), request('bad.pdf'), { id: 'bad', objectKey: 'k-bad' }, NOW);
    assert.deepEqual(first.expired.map(x => x.objectKey), ['k-old']);
    s = completeResourceUpload(first.workspace, ctx(), 'bad', seen(new TextEncoder().encode('<html>')), NOW).workspace;
    const r = beginResourceUpload(s, ctx(), request('new.pdf'), { id: 'new', objectKey: 'k-new' }, NOW);
    assert.deepEqual(r.expired.map(x => x.objectKey), ['k-bad']);
    assert.deepEqual(r.workspace.uploads.map(u => u.id).sort(), [DEMO_COVER_LIBRARY_FILE, DEMO_WORKSHEET_FILE, 'new']); // Pruning lesson files leaves the cover library alone.
    s = r.workspace;
    for (let i = 0; i < 4; i++) s = beginResourceUpload(s, ctx(), request(`p${i}.pdf`), { id: 'p' + i, objectKey: 'kp' + i }, NOW).workspace;
    assert.throws(() => beginResourceUpload(s, ctx(), request('sixth.pdf'), { id: 'p6', objectKey: 'kp6' }, NOW), { code: 'UPLOADS_IN_PROGRESS' });
    const crowded = createSeed();
    for (let i = 0; i < 499; i++) crowded.uploads.push({ ...crowded.uploads[0], id: 'fill' + i, objectKey: 'fill' + i });
    assert.throws(() => beginResourceUpload(crowded, ctx(), request('one-more.pdf'), { id: 'x', objectKey: 'kx' }, NOW), { code: 'UPLOAD_LIMIT' });
});
test('completion verifies size, type, signature and generation, and only the uploader can complete', () => {
    const begin = (s = createSeed(), id = 'u1') => beginResourceUpload(s, ctx(), { purpose: 'lesson_resource', trackId: 'track_product', name: 'n.pdf', contentType: PDF, sizeBytes: pdf().length }, { id, objectKey: 'k-' + id }, NOW).workspace;
    let s = begin();
    s.members.find(m => m.userId === 'member_maya')!.role = 'admin';
    assert.throws(() => completeResourceUpload(s, ctx('member_maya'), 'u1', seen(pdf()), NOW), { code: 'NOT_FOUND' });
    for (const observed of [{ ...seen(pdf()), sizeBytes: 999 }, { ...seen(pdf()), contentType: 'text/html' }, { ...seen(pdf()), signatureMatches: false }, { ...seen(pdf()), generation: null }, { ...seen(pdf()), generation: 'not-a-number' }]) {
        const r = completeResourceUpload(begin(), ctx(), 'u1', observed, NOW);
        assert.equal(r.outcome, 'rejected', JSON.stringify(observed));
        assert.equal(r.upload.generation, null);
        assert.throws(() => completeResourceUpload(r.workspace, ctx(), 'u1', seen(pdf()), NOW), { code: 'FILE_REJECTED' });
    }
    const ok = completeResourceUpload(s, ctx(), 'u1', seen(pdf()), NOW);
    assert.equal(ok.outcome, 'ready'); assert.equal(ok.upload.generation, '1712345678901234');
    const again = completeResourceUpload(ok.workspace, ctx(), 'u1', { ...seen(pdf()), sizeBytes: 1 }, NOW);
    assert.equal(again.outcome, 'unchanged'); assert.equal(again.workspace, ok.workspace);
    assert.throws(() => completeResourceUpload(begin(), ctx(), 'u1', seen(pdf()), new Date(Date.parse(NOW) + RESOURCE_UPLOAD_TTL_MS + 1).toISOString()), { code: 'UPLOAD_EXPIRED' });
    const demoted = begin(); demoted.members.find(m => m.userId === DEMO_ADMIN)!.role = 'member';
    assert.throws(() => completeResourceUpload(demoted, ctx(), 'u1', seen(pdf()), NOW), { code: 'AUTHOR_REQUIRED' });
    assert(ok.workspace.audit.some(a => a.action === 'lesson.resource.uploaded' && a.objectId === 'u1'));
    assert(!JSON.stringify(ok.workspace.audit).includes('n.pdf'));
});
test('saving attaches verified files with server-derived type and size, in the chosen order', () => {
    const a = stored(open());
    const s = save(a.s, [{ ...entry(a.id, 'Notes', 'r-new'), contentType: 'image/png', sizeBytes: 1 }, ...lessonContent(draft(a.s)).resources]);
    const resources = draft(s).resources!;
    assert.deepEqual(resources.map(r => r.id), ['r-new', seeded]);
    assert.equal(resources[0].contentType, PDF);
    assert.equal(resources[0].sizeBytes, a.s.uploads.find(u => u.id === a.id)!.sizeBytes);
    const noop = run(s, { type: 'lesson.draft.save', draftId: draft(s).id, expectedVersion: draft(s).version, ...lessonContent(draft(s)) });
    assert.equal(noop.revision, s.revision);
});
test('pending, rejected, foreign-track, foreign-tenant and member-private files cannot be attached', () => {
    let s = open();
    s = beginResourceUpload(s, ctx(), { purpose: 'lesson_resource', trackId: 'track_product', name: 'p.pdf', contentType: PDF, sizeBytes: 9 }, { id: 'pending', objectKey: 'kp' }, NOW).workspace;
    assert.throws(() => save(s, [entry('pending')]), { code: 'RESOURCE_NOT_READY' });
    const other = stored(s, 'story.pdf', pdf(), DEMO_ADMIN, 'track_story');
    assert.throws(() => save(other.s, [entry(other.id)]), { code: 'RESOURCE_UNAVAILABLE' });
    const north = createSeed('studio-north');
    const foreign = beginResourceUpload(north, ctx(DEMO_ADMIN, 'org_studio_north'), { purpose: 'lesson_resource', trackId: 'track_product', name: 'f.pdf', contentType: PDF, sizeBytes: 9 }, { id: 'foreign', objectKey: 'kf' }, NOW).upload;
    s.uploads.push({ ...foreign, status: 'ready', generation: '1', completedAt: NOW });
    assert.throws(() => save(s, [entry('foreign')]), { code: 'RESOURCE_UNAVAILABLE' });
    s.uploads.push({ ...foreign, id: 'member-proof', organizationId: ORG, purpose: 'member', trackId: null, status: 'ready' });
    assert.throws(() => save(s, [entry('member-proof')]), { code: 'RESOURCE_UNAVAILABLE' });
    assert.throws(() => save(s, [entry('missing')]), { code: 'RESOURCE_UNAVAILABLE' });
});
test('members cannot manage lesson files and stale or pre-resource editors cannot overwrite them', () => {
    const a = stored(open()), s = save(a.s, [...lessonContent(draft(a.s)).resources, entry(a.id)]);
    assert.throws(() => save(s, [], DEMO_USER), { code: 'AUTHOR_REQUIRED' });
    assert.throws(() => run(s, { type: 'lesson.draft.save', draftId: draft(s).id, expectedVersion: 1, ...lessonContent(draft(s)), resources: [] }), { code: 'STALE_DRAFT' });
    const { resources, ...legacy } = lessonContent(draft(s));
    assert.equal(resources.length, 2);
    assert.throws(() => run(s, { type: 'lesson.draft.save', draftId: draft(s).id, expectedVersion: draft(s).version, ...legacy }), { code: 'RESOURCES_REQUIRED' });
    assert.throws(() => applyCommand(s, ctx(DEMO_ADMIN, 'org_studio_north'), { type: 'lesson.draft.save', draftId: draft(s).id, expectedVersion: draft(s).version, ...lessonContent(draft(s)) }), { code: 'NOT_FOUND' });
});
test('draft files stay private until publication and never enter events or audit text', () => {
    const a = stored(open(), 'PRIVATE_DRAFT_FILE.pdf');
    const s = save(a.s, [...lessonContent(draft(a.s)).resources, { ...entry(a.id, 'PRIVATE_DRAFT_LABEL'), description: 'PRIVATE_DRAFT_NOTE' }]);
    const member = JSON.stringify(visibleWorkspace(s, ctx(DEMO_USER)));
    for (const marker of ['PRIVATE_DRAFT_FILE', 'PRIVATE_DRAFT_LABEL', 'PRIVATE_DRAFT_NOTE']) {
        assert(!member.includes(marker), marker);
        assert(!JSON.stringify(s.outbox).includes(marker) && !JSON.stringify(s.audit).includes(marker), marker);
    }
    assert.deepEqual(lesson(s).resources!.map(r => r.id), [seeded]);
    assert.throws(() => download(s, 'draft', draft(s).id, 'resource_' + a.id), { code: 'NOT_FOUND' });
    assert.throws(() => download(s, 'lesson', 'lesson_4', 'resource_' + a.id), { code: 'NOT_FOUND' });
    assert.equal(download(s, 'draft', draft(s).id, 'resource_' + a.id, DEMO_ADMIN).filename, 'PRIVATE_DRAFT_LABEL.pdf');
});
test('publication copies files to the lesson and history without touching completion evidence', () => {
    const before = createSeed(), { s, id } = published();
    assert.deepEqual(lesson(s).resources!.map(r => r.fileId), [DEMO_WORKSHEET_FILE, id]);
    assert.deepEqual(s.lessonRevisions.at(-1)!.resources!.map(r => r.fileId), [DEMO_WORKSHEET_FILE, id]);
    assert.deepEqual(s.completions, before.completions); assert.deepEqual(s.reputation, before.reputation);
    assert.deepEqual(progress(s, DEMO_USER, 'track_product'), progress(before, DEMO_USER, 'track_product'));
    const got = download(s, 'lesson', 'lesson_4', 'resource_' + id);
    assert.equal(got.filename, 'Extra notes.pdf'); assert.equal(got.upload.generation, '1712345678901234');
});
test('publication fails closed if an attached file stopped being available', () => {
    const a = stored(open()), s = save(a.s, [entry(a.id)]);
    s.uploads.find(u => u.id === a.id)!.status = 'rejected';
    assert.throws(() => publish(s), { code: 'RESOURCE_NOT_READY' });
    assert.deepEqual(lesson(s).resources!.map(r => r.id), [seeded]);
});
test('replacement changes the draft first; learners keep the published file until republication', () => {
    const p = published(), next = stored(p.s, 'Revised worksheet.pdf');
    const swapped = lessonContent(draft(next.s)).resources.map(r => r.id === seeded ? { ...r, fileId: next.id } : r);
    let s = save(next.s, swapped);
    assert.equal(download(s, 'lesson', 'lesson_4', seeded).upload.id, DEMO_WORKSHEET_FILE);
    assert.equal(download(s, 'draft', draft(s).id, seeded, DEMO_ADMIN).upload.id, next.id);
    s = publish(s);
    assert.equal(download(s, 'lesson', 'lesson_4', seeded).upload.id, next.id);
    const older = s.lessonRevisions.filter(r => r.lessonId === 'lesson_4').at(-2)!;
    assert.equal(download(s, 'revision', older.id, seeded, DEMO_ADMIN).upload.id, DEMO_WORKSHEET_FILE);
    assert.throws(() => download(s, 'revision', older.id, seeded), { code: 'NOT_FOUND' });
});
test('removal is a draft change; after publication learners lose access but history keeps the file', () => {
    const p = published();
    let s = save(p.s, lessonContent(draft(p.s)).resources.filter(r => r.fileId !== p.id));
    assert.equal(download(s, 'lesson', 'lesson_4', 'resource_' + p.id).upload.id, p.id);
    s = publish(s);
    assert.throws(() => download(s, 'lesson', 'lesson_4', 'resource_' + p.id), { code: 'NOT_FOUND' });
    const history = s.lessonRevisions.filter(r => r.resources?.some(x => x.fileId === p.id));
    assert.equal(download(s, 'revision', history[0].id, 'resource_' + p.id, DEMO_ADMIN).upload.id, p.id);
    assert.throws(() => discardResourceUpload(s, ctx(), p.id, NOW), { code: 'RESOURCE_IN_USE' });
});
test('restoring a revision brings back its files only in the draft', () => {
    const p = published();
    let s = publish(save(p.s, []));
    assert.deepEqual(lesson(s).resources, []);
    const withFiles = s.lessonRevisions.find(r => (r.resources ?? []).length === 2)!;
    s = run(s, { type: 'lesson.draft.restore', draftId: draft(s).id, expectedVersion: draft(s).version, revisionId: withFiles.id });
    assert.deepEqual(draft(s).resources!.map(r => r.fileId), [DEMO_WORKSHEET_FILE, p.id]);
    assert.deepEqual(lesson(s).resources, []);
});
test('downloads follow current lesson, space, role and tenant access', () => {
    const { s } = published();
    assert.equal(download(s, 'lesson', 'lesson_4', seeded).filename, 'Problem interview worksheet.pdf');
    const privateTrack = structuredClone(s); privateTrack.tracks.find(t => t.id === 'track_product')!.spaceId = 'space_studio';
    assert.throws(() => download(privateTrack, 'lesson', 'lesson_4', seeded), { code: 'NOT_FOUND' });
    privateTrack.spaceMembers.push({ id: 'grant', organizationId: ORG, createdAt: NOW, spaceId: 'space_studio', userId: DEMO_USER });
    assert.equal(download(privateTrack, 'lesson', 'lesson_4', seeded).upload.id, DEMO_WORKSHEET_FILE);
    const hidden = structuredClone(s); hidden.tracks.find(t => t.id === 'track_product')!.published = false;
    assert.throws(() => download(hidden, 'lesson', 'lesson_4', seeded), { code: 'NOT_FOUND' });
    assert.equal(download(hidden, 'lesson', 'lesson_4', seeded, DEMO_ADMIN).upload.id, DEMO_WORKSHEET_FILE);
    const suspended = structuredClone(s); suspended.members.find(m => m.userId === DEMO_USER)!.status = 'suspended';
    assert.throws(() => download(suspended, 'lesson', 'lesson_4', seeded), { code: 'FORBIDDEN' });
    assert.throws(() => download(s, 'lesson', 'lesson_4', seeded, DEMO_USER, 'org_studio_north'), { code: 'NOT_FOUND' });
    assert.throws(() => download(s, 'lesson', 'lesson_4', 'resource_unknown'), { code: 'NOT_FOUND' });
    assert.throws(() => download(s, 'lesson', 'lesson_1', seeded), { code: 'NOT_FOUND' });
    const demoted = structuredClone(s); demoted.members.find(m => m.userId === DEMO_ADMIN)!.role = 'member';
    assert.throws(() => download(demoted, 'draft', draft(s).id, seeded, DEMO_ADMIN), { code: 'NOT_FOUND' });
    const tampered = structuredClone(s); tampered.uploads.find(u => u.id === DEMO_WORKSHEET_FILE)!.trackId = 'track_story';
    assert.throws(() => download(tampered, 'lesson', 'lesson_4', seeded), { code: 'NOT_FOUND' });
    const unverified = structuredClone(s); unverified.uploads.find(u => u.id === DEMO_WORKSHEET_FILE)!.generation = null;
    assert.throws(() => download(unverified, 'lesson', 'lesson_4', seeded), { code: 'FILE_NOT_READY' });
});
test('only unreferenced uploads can be discarded, by an authorised author', () => {
    const a = stored(open());
    assert.throws(() => discardResourceUpload(a.s, ctx(DEMO_USER), a.id, NOW), { code: 'AUTHOR_REQUIRED' });
    assert.throws(() => discardResourceUpload(a.s, ctx(), DEMO_WORKSHEET_FILE, NOW), { code: 'RESOURCE_IN_USE' });
    const saved = save(a.s, [entry(a.id)]);
    assert.throws(() => discardResourceUpload(saved, ctx(), a.id, NOW), { code: 'RESOURCE_IN_USE' });
    const r = discardResourceUpload(a.s, ctx(), a.id, NOW);
    assert.equal(r.objectKey, `organisations/${ORG}/lesson-resources/track_product/${a.id}.pdf`);
    assert(!r.workspace.uploads.some(u => u.id === a.id));
    assert(r.workspace.audit.some(x => x.action === 'lesson.resource.discarded'));
    assert.throws(() => discardResourceUpload(createSeed('studio-north'), ctx(DEMO_ADMIN, 'org_studio_north'), a.id, NOW), { code: 'NOT_FOUND' });
});
test('lessons published before resources keep working and the demo file is a real PDF', () => {
    const s = createSeed(); for (const l of s.lessons) delete l.resources;
    const r = run(s, { type: 'lesson.draft.create', trackId: 'track_story', lessonId: 'lesson_1' });
    assert.deepEqual(draft(r).resources, []);
    assert.deepEqual(lessonContent({ ...s.lessons[0], resources: null }).resources, []);
    const bytes = demoWorksheetPdf();
    assert(fileSignatureMatches(PDF, bytes));
    assert.equal(createSeed().uploads[0].sizeBytes, bytes.length);
    assert(new TextDecoder().decode(bytes).endsWith('%%EOF\n'));
});
test('the file list renders names as text, hides when empty and labels each download', () => {
    const resources: LessonResource[] = [{ id: 'r', fileId: 'f', name: '<img src=x onerror=alert(1)>', description: '<script>bad()</script>', contentType: PDF, sizeBytes: 2048 }];
    const html = renderToStaticMarkup(createElement(ResourceList, { resources, onDownload: async () => true }));
    assert(!html.includes('<img') && !html.includes('<script>'));
    assert(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
    assert(html.includes('PDF · 2 KB'));
    assert(html.includes('aria-label="Download &lt;img src=x onerror=alert(1)&gt;"'));
    assert.equal(renderToStaticMarkup(createElement(ResourceList, { resources: [], onDownload: async () => true })), '');
});
