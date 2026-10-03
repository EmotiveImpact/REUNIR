import { test } from 'node:test';
import assert from 'node:assert/strict';
import { type Workspace } from '../packages/contracts/src/index';
import { applyCommand, visibleRecords } from '../packages/domain/src/engine';
import { reliesOnAdministration } from '../packages/domain/src/administration';
import { beginCoverUpload } from '../packages/domain/src/covers';
import { startsTracks } from '../packages/domain/src/instructors';
import { createSeed, DEMO_ADMIN, DEMO_USER } from '../packages/domain/src/seed';

const ORG = 'org_code_black', NOW = '2026-10-03T12:00:00.000Z', IDRIS = 'member_idris', MAYA = 'member_maya';
let seq = 0;
const ctx = (userId: string) => ({ organizationId: ORG, userId, requestId: 'instructor_tracks_test' });
const exec = (s: Workspace, cmd: unknown, user: string) => applyCommand(s, ctx(user), cmd, () => NOW, () => `it_${++seq}`);
const throwsCode = (fn: () => unknown, code: string) => assert.throws(fn, (e: { code?: string }) => e.code === code, code);
const member = (s: Workspace, userId: string) => s.members.find(m => m.userId === userId && m.organizationId === ORG)!;
const start = { type: 'track.create', title: 'Interviews that change your mind', summary: 'Hear what people actually do.', description: 'Five short lessons on listening.', category: 'Product building' };

test('only administrators and instructors of a whole track start tracks', () => {
    const s = createSeed();
    assert.equal(startsTracks(s, member(s, IDRIS)), true);
    assert.equal(startsTracks(s, member(s, DEMO_USER)), false);
    throwsCode(() => exec(s, start, DEMO_USER), 'TRACK_STARTER_REQUIRED');
    // A contributor, or an instructor of some lessons only, does not.
    for (const grant of [{ role: 'contributor' }, { role: 'instructor', lessonIds: ['lesson_6'] }]) {
        const t = exec(s, { type: 'track.instructor.add', trackId: 'track_product', userId: MAYA, ...grant }, DEMO_ADMIN).workspace;
        throwsCode(() => exec(t, start, MAYA), 'TRACK_STARTER_REQUIRED');
    }
    const suspended = structuredClone(s); member(suspended, IDRIS).status = 'suspended';
    assert.equal(startsTracks(suspended, member(suspended, IDRIS)), false);
});

test('an instructor’s new track is unpublished, theirs to teach, and hidden from members', () => {
    const r = exec(createSeed(), start, IDRIS), s = r.workspace, id = r.objectId!;
    const track = s.tracks.find(t => t.id === id)!;
    assert.equal(track.published, false); assert.equal(track.authorId, IDRIS);
    assert.deepEqual(s.trackInstructors.filter(i => i.trackId === id).map(i => ({ userId: i.userId, grantedBy: i.grantedBy, role: i.role, lessonIds: i.lessonIds })), [{ userId: IDRIS, grantedBy: IDRIS, role: 'instructor', lessonIds: null }]);
    assert(s.notifications.some(n => n.userId === DEMO_ADMIN && n.title === 'Idris Cole started a new track'), 'administrators are told');
    assert(visibleRecords(s, ctx(IDRIS)).tracks.some(t => t.id === id));
    assert(visibleRecords(s, ctx(DEMO_ADMIN)).tracks.some(t => t.id === id));
    assert(!visibleRecords(s, ctx(DEMO_USER)).tracks.some(t => t.id === id), 'members do not see it');
    throwsCode(() => exec(s, { type: 'track.enrol', trackId: id }, DEMO_USER), 'NOT_FOUND');
    // They author it, and may give it a cover.
    const drafted = exec(s, { type: 'lesson.draft.create', trackId: id }, IDRIS);
    assert(drafted.objectId);
    assert.doesNotThrow(() => beginCoverUpload(s, ctx(IDRIS), { purpose: 'cover_image', subject: 'track', subjectId: id, contentType: 'image/jpeg', sizeBytes: 1000 }, { id: 'c1', objectKey: 'k1' }, NOW));
});

test('only an administrator publishes it, once, and the author is told', () => {
    const r = exec(createSeed(), start, IDRIS), id = r.objectId!;
    throwsCode(() => exec(r.workspace, { type: 'track.publish', trackId: id }, IDRIS), 'FORBIDDEN');
    const published = exec(r.workspace, { type: 'track.publish', trackId: id }, DEMO_ADMIN).workspace;
    assert.equal(published.tracks.find(t => t.id === id)!.published, true);
    assert(published.notifications.some(n => n.userId === IDRIS && n.title === 'Interviews that change your mind is published'));
    assert(published.audit.some(a => a.action === 'track.published' && a.objectId === id));
    assert(visibleRecords(published, ctx(DEMO_USER)).tracks.some(t => t.id === id));
    const again = exec(published, { type: 'track.publish', trackId: id }, DEMO_ADMIN);
    assert.equal(again.workspace.revision, published.revision);
});

test('an administrator’s track is published at once and needs administrator authority', () => {
    const s = createSeed();
    const r = exec(s, start, DEMO_ADMIN);
    assert.equal(r.workspace.tracks.find(t => t.id === r.objectId)!.published, true);
    assert.equal(r.workspace.trackInstructors.length, s.trackInstructors.length, 'administrators need no grant');
    assert.equal(reliesOnAdministration(s, ctx(DEMO_ADMIN), start), true);
    // An administrator who also holds a whole-track grant still publishes only as an administrator.
    const granted = structuredClone(s);
    granted.trackInstructors.push({ id: 'g_admin', organizationId: ORG, createdAt: NOW, trackId: 'track_story', userId: DEMO_ADMIN, grantedBy: DEMO_ADMIN, role: 'instructor', lessonIds: null });
    assert.equal(reliesOnAdministration(granted, ctx(DEMO_ADMIN), start), true, 'a moderator’s track would wait, so the outcome differs');
    assert.equal(reliesOnAdministration(s, ctx(DEMO_ADMIN), { type: 'post.create', spaceId: 'space_general', kind: 'update', title: '', body: 'Hello.' }), false);
});
