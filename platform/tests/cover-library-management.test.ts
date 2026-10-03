import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSeed, DEMO_ADMIN, DEMO_INSTRUCTOR, DEMO_USER } from '../packages/domain/src/seed';
import { applyCommand, visibleWorkspace } from '../packages/domain/src/engine';
import { reliesOnAdministration } from '../packages/domain/src/administration';
import { normalisePurposeState } from '../packages/domain/src/purpose';
import { beginCoverLibraryUpload, completeCoverUpload, updateCoverLibraryItem, type CoverObservation } from '../packages/domain/src/covers';
import {
    MAX_COVER_LIBRARY_ITEMS, MAX_COVER_LIBRARY_TAGS, MAX_COVER_TAG_LENGTH, coverBytesAcceptable, coverLibraryDetails, coverLibraryMatches, coverLibraryTags, splitCoverTags,
} from '../packages/contracts/src/covers';
import { commandSchema, DomainError, type Workspace } from '../packages/contracts/src/index';
import { pngHeader } from './helpers/images';
import { DEMO_COVER_LIBRARY_FILE } from '../packages/domain/src/demo-files';

const ORG = 'org_code_black', T0 = '2026-10-03T09:00:00.000Z';
const ctx = (userId: string, organizationId = ORG) => ({ organizationId, userId, requestId: 'cover-library-management-test' });
let n = 0;
const good: CoverObservation = { sizeBytes: 5000, contentType: 'image/png', generation: '1712345678900001', bytesAcceptable: coverBytesAcceptable('image/png', pngHeader(1600, 900)) };
const run = (s: Workspace, user: string, cmd: unknown) => applyCommand(s, ctx(user), cmd, () => T0, () => `id_${++n}`);
const update = (s: Workspace, user: string, itemId: string, details: unknown, org = ORG) => updateCoverLibraryItem(s, ctx(user, org), itemId, details as never, T0, () => `id_${++n}`);
const refused = (code: string) => (e: unknown) => e instanceof DomainError && e.code === code;
const withRole = (s: Workspace, userId: string, change: Partial<Workspace['members'][number]>) => ({ ...s, members: s.members.map(m => m.userId === userId && m.organizationId === ORG ? { ...m, ...change } : m) });

test('tags are trimmed, lower-cased and deduplicated; too many, too long or odd tags are refused, never cut', () => {
    assert.deepEqual(coverLibraryTags.parse(['  Landscape ', 'landscape', 'Night   Sky', '', 'café', 'well-lit']), ['landscape', 'night sky', 'café', 'well-lit']);
    assert.deepEqual(splitCoverTags(' Harbour, , Dawn ,harbour'), ['harbour', 'dawn', 'harbour'], 'splitting keeps repeats for the schema to remove');
    assert.equal(MAX_COVER_LIBRARY_TAGS, 5); assert.equal(MAX_COVER_TAG_LENGTH, 24);
    assert.throws(() => coverLibraryTags.parse(['a', 'b', 'c', 'd', 'e', 'f']), /up to 5 tags/);
    assert.deepEqual(coverLibraryTags.parse(['a', 'A', 'b', 'c', 'd', 'e']), ['a', 'b', 'c', 'd', 'e'], 'repeats do not count towards the limit');
    assert.throws(() => coverLibraryTags.parse(['x'.repeat(25)]), /24 characters/);
    assert.deepEqual(coverLibraryTags.parse(['x'.repeat(24)]), ['x'.repeat(24)]);
    for (const bad of ['a,b', 'tag!', '-lead', 'trail-', 'two  -  words', '<b>', 'null\u0000byte']) assert.throws(() => coverLibraryTags.parse([bad]), bad);
    assert.deepEqual(coverLibraryTags.parse(['tab\tand\nline']), ['tab and line'], 'white space of any kind becomes one space');
    assert.throws(() => coverLibraryTags.parse([1]));
    assert.throws(() => coverLibraryDetails.parse({ label: 'Harbour', tags: [], fileId: 'other' }), 'only the name and tags change');
    assert.throws(() => coverLibraryDetails.parse({ label: '   ', tags: [] }), /short name/);
    assert.deepEqual(commandSchema.parse({ type: 'cover.library.add', fileId: 'f1', label: 'Harbour', tags: ['Sea', 'sea'] }), { type: 'cover.library.add', fileId: 'f1', label: 'Harbour', tags: ['sea'] });
});

test('the picker matches every word against the name and tags, and an exact tag', () => {
    const item = { label: 'Harbour at dawn', tags: ['sea', 'morning light'] };
    assert(coverLibraryMatches(item, ''));
    assert(coverLibraryMatches(item, 'HARBOUR'));
    assert(coverLibraryMatches(item, 'dawn sea'));
    assert(coverLibraryMatches(item, 'light'));
    assert(!coverLibraryMatches(item, 'harbour forest'));
    assert(coverLibraryMatches(item, '', 'sea'));
    assert(!coverLibraryMatches(item, '', 'se'), 'a chosen tag matches exactly');
    assert(!coverLibraryMatches({ label: 'Old picture' }, '', 'sea'), 'pictures stored before tags have none');
});

test('the library holds up to sixty pictures, enforced by the rules', () => {
    assert.equal(MAX_COVER_LIBRARY_ITEMS, 60);
    let s = createSeed();
    const fill = (state: Workspace) => {
        const begun = beginCoverLibraryUpload(state, ctx(DEMO_ADMIN), { purpose: 'cover_library', contentType: 'image/png', sizeBytes: 5000 }, { id: `fill_${++n}`, objectKey: `k/${n}.png` }, T0);
        const done = completeCoverUpload(begun.workspace, ctx(DEMO_ADMIN), begun.upload.id, good, T0);
        return { s: done.workspace, fileId: begun.upload.id };
    };
    while (s.coverLibrary.length < MAX_COVER_LIBRARY_ITEMS) { const f = fill(s); s = run(f.s, DEMO_ADMIN, { type: 'cover.library.add', fileId: f.fileId, label: `Picture ${s.coverLibrary.length}` }).workspace; }
    assert.throws(() => beginCoverLibraryUpload(s, ctx(DEMO_ADMIN), { purpose: 'cover_library', contentType: 'image/png', sizeBytes: 5000 }, { id: 'one_more', objectKey: 'k/more.png' }, T0), refused('LIBRARY_FULL'));
});

test('an owner or administrator renames and tags a picture; the picture and the covers that show it stay put', () => {
    let s = run(createSeed(), 'member_jordan', { type: 'project.cover.set', projectId: 'project_still', fileId: DEMO_COVER_LIBRARY_FILE, focusX: 30, focusY: 40 }).workspace;
    const before = s.coverLibrary.find(i => i.id === 'library_mountain')!, cover = structuredClone(s.projects.find(p => p.id === 'project_still')!.coverImage);
    assert.deepEqual(before.tags, ['landscape', 'outdoors']);
    const r = update(s, DEMO_ADMIN, 'library_mountain', { label: '  Ridge at noon ', tags: ['Hills', 'hills', 'Outdoors'] });
    assert.equal(r.changed, true);
    const after = r.workspace.coverLibrary.find(i => i.id === 'library_mountain')!;
    assert.deepEqual({ label: after.label, tags: after.tags }, { label: 'Ridge at noon', tags: ['hills', 'outdoors'] });
    assert.deepEqual({ ...after, label: before.label, tags: before.tags }, before, 'file, type, size and who added it are unchanged');
    assert.deepEqual(r.workspace.projects.find(p => p.id === 'project_still')!.coverImage, cover);
    assert.equal(r.workspace.revision, s.revision + 1);
    const audit = r.workspace.audit.at(-1)!;
    assert.deepEqual([audit.action, audit.objectId, audit.actorId], ['cover.library.updated', 'library_mountain', DEMO_ADMIN]);
    s = r.workspace;
    const same = update(s, DEMO_ADMIN, 'library_mountain', { label: 'Ridge at noon', tags: ['hills', 'outdoors'] });
    assert.equal(same.changed, false); assert.equal(same.workspace, s, 'nothing is written when nothing changed');
    const admin = withRole(s, 'member_jordan', { role: 'admin' });
    assert.deepEqual(update(admin, 'member_jordan', 'library_mountain', { label: 'Ridge', tags: [] }).item.tags, [], 'an administrator may clear the tags');
    assert.deepEqual(visibleWorkspace(r.workspace, ctx(DEMO_USER)).coverLibrary.find(i => i.id === 'library_mountain')!.tags, ['hills', 'outdoors'], 'members see the tags');
});

test('members, moderators, instructors and inactive administrators cannot rename or tag, and other communities see nothing', () => {
    const s = createSeed();
    for (const user of [DEMO_USER, DEMO_INSTRUCTOR, 'member_maya'])
        assert.throws(() => update(s, user, 'library_mountain', { label: 'Mine', tags: [] }), refused('ADMIN_REQUIRED'), user);
    for (const status of ['suspended', 'removed'] as const) {
        const inactive = withRole(s, DEMO_ADMIN, { status } as never);
        assert.throws(() => update(inactive, DEMO_ADMIN, 'library_mountain', { label: 'Mine', tags: [] }), (e: unknown) => e instanceof DomainError, status);
    }
    const studio = createSeed('studio-north'), studioOwner = studio.members.find(m => m.role === 'owner')!.userId;
    assert.throws(() => update(studio, studioOwner, 'library_mountain', { label: 'Taken', tags: [] }, 'org_studio_north'), refused('NOT_FOUND'), 'another community’s picture');
    assert.throws(() => update(s, studioOwner, 'library_mountain', { label: 'Taken', tags: [] }, 'org_studio_north'), refused('NOT_FOUND'), 'a context for another community');
    assert.throws(() => update(s, DEMO_ADMIN, 'no_such_item', { label: 'Taken', tags: [] }), refused('NOT_FOUND'));
    assert.throws(() => update(s, DEMO_ADMIN, 'library_mountain', { label: 'x'.repeat(81), tags: [] }));
    assert.equal(s.coverLibrary.find(i => i.id === 'library_mountain')!.label, 'Mountain ridge');
});

test('adding a picture can carry tags; pictures stored before tags read as untagged', () => {
    const begun = beginCoverLibraryUpload(createSeed(), ctx(DEMO_ADMIN), { purpose: 'cover_library', contentType: 'image/png', sizeBytes: 5000 }, { id: 'tagged_upload', objectKey: 'k/tagged.png' }, T0);
    const done = completeCoverUpload(begun.workspace, ctx(DEMO_ADMIN), begun.upload.id, good, T0);
    const added = run(done.workspace, DEMO_ADMIN, { type: 'cover.library.add', fileId: 'tagged_upload', label: 'Workshop', tags: ['Tools', 'people at work'] });
    assert.deepEqual(added.workspace.coverLibrary.find(i => i.fileId === 'tagged_upload')!.tags, ['tools', 'people at work']);
    assert.equal(reliesOnAdministration(done.workspace, ctx(DEMO_ADMIN), { type: 'cover.library.add', fileId: 'tagged_upload', label: 'Workshop', tags: [] }), true, 'listing is administrator authority, so two-step sign-in applies');
    const legacy = createSeed(); delete (legacy.coverLibrary[0] as { tags?: string[] }).tags;
    assert.deepEqual(normalisePurposeState(legacy).coverLibrary[0].tags, []);
});
