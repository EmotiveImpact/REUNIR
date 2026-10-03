import { test } from 'node:test';
import assert from 'node:assert/strict';
import { commandSchema, type Workspace } from '../packages/contracts/src/index';
import { applyCommand, visibleRecords } from '../packages/domain/src/engine';
import { beginResourceUpload } from '../packages/domain/src/resources';
import { beginCoverUpload } from '../packages/domain/src/covers';
import { contributes, contributesAny, teaches, teachesAny, teachingRole } from '../packages/domain/src/instructors';
import { pageOf } from '../packages/domain/src/pages';
import { createSeed, DEMO_ADMIN } from '../packages/domain/src/seed';

const ORG = 'org_code_black', NOW = '2026-10-03T12:00:00.000Z', MAYA = 'member_maya', IDRIS = 'member_idris';
let seq = 0;
const ctx = (userId: string) => ({ organizationId: ORG, userId, requestId: 'contributor_test' });
const exec = (s: Workspace, cmd: unknown, user: string) => applyCommand(s, ctx(user), cmd, () => NOW, () => `contrib_${++seq}`);
const run = (s: Workspace, cmd: unknown, user = DEMO_ADMIN) => exec(s, cmd, user).workspace;
const throwsCode = (fn: () => unknown, code: string) => assert.throws(fn, (e: { code?: string }) => e.code === code, code);
const member = (s: Workspace, userId: string) => s.members.find(m => m.userId === userId && m.organizationId === ORG)!;
/** Maya contributes to the product track that Idris teaches. */
const withContributor = () => run(createSeed(), { type: 'track.instructor.add', trackId: 'track_product', userId: MAYA, role: 'contributor' });

test('the role is optional, defaults to instructor and accepts nothing else', () => {
    const parsed = commandSchema.parse({ type: 'track.instructor.add', trackId: 'track_story', userId: MAYA });
    assert.equal(parsed.type === 'track.instructor.add' && parsed.role, 'instructor');
    assert.equal(commandSchema.safeParse({ type: 'track.instructor.add', trackId: 'track_story', userId: MAYA, role: 'contributor' }).success, true);
    assert.equal(commandSchema.safeParse({ type: 'track.instructor.add', trackId: 'track_story', userId: MAYA, role: 'owner' }).success, false);
    assert.equal(teachingRole({}), 'instructor', 'grants stored before roles are instructors');
});

test('a contributor writes drafts and files for their track but does not teach it', () => {
    const s = withContributor(), maya = member(s, MAYA);
    assert.equal(s.trackInstructors.find(i => i.userId === MAYA)!.role, 'contributor');
    assert.equal(contributes(s, maya, 'track_product'), true);
    assert.equal(teaches(s, maya, 'track_product'), false);
    assert.equal(contributesAny(s, maya), true);
    assert.equal(teachesAny(s, maya), false);
    assert.equal(contributes(s, maya, 'track_story'), false, 'other tracks stay closed');
    assert.equal(s.notifications.at(-1)!.title, 'You can now contribute to From idea to first version');
    // Opening and saving a draft of an existing lesson works and records the usual captured baseline.
    const opened = exec(s, { type: 'lesson.draft.create', trackId: 'track_product', lessonId: 'lesson_4' }, MAYA);
    const draft = opened.workspace.lessonDrafts.find(d => d.id === opened.objectId)!;
    assert.equal(opened.workspace.lessonRevisions.filter(r => r.lessonId === 'lesson_4').map(r => r.kind).join(), 'captured');
    const saved = run(opened.workspace, { type: 'lesson.draft.save', draftId: draft.id, expectedVersion: 1, title: 'Choose one real problem, again', summary: draft.summary, body: draft.body, minutes: draft.minutes, resourceUrl: '', richBody: draft.richBody, resources: [], quiz: draft.quiz }, MAYA);
    assert.equal(saved.lessonDrafts.find(d => d.id === draft.id)!.version, 2);
    // A lesson file can be uploaded for the track.
    const upload = beginResourceUpload(saved, ctx(MAYA), { purpose: 'lesson_resource', trackId: 'track_product', name: 'notes.pdf', contentType: 'application/pdf', sizeBytes: 100 }, { id: 'up_maya', objectKey: 'k/up_maya' }, NOW);
    assert.equal(upload.upload.userId, MAYA);
    // The contributor sees the track's drafts and history, and its upload records.
    const view = visibleRecords(upload.workspace, ctx(MAYA));
    assert.deepEqual(view.lessonDrafts.map(d => d.id), [draft.id]);
    assert(view.uploads.some(u => u.id === 'up_maya'));
});

test('publishing, archiving, ordering and the cover stay with the track’s instructors', () => {
    const s = withContributor();
    const opened = exec(s, { type: 'lesson.draft.create', trackId: 'track_product' }, MAYA);
    const draft = opened.workspace.lessonDrafts.find(d => d.id === opened.objectId)!;
    const saved = run(opened.workspace, { type: 'lesson.draft.save', draftId: draft.id, expectedVersion: 1, title: 'A new lesson', summary: 'Why it matters.', body: 'Something useful.', minutes: 5, resourceUrl: '' }, MAYA);
    throwsCode(() => exec(saved, { type: 'lesson.draft.publish', draftId: draft.id, expectedVersion: 2 }, MAYA), 'INSTRUCTOR_REQUIRED');
    throwsCode(() => exec(saved, { type: 'lesson.draft.archive', draftId: draft.id, expectedVersion: 2, archived: true }, MAYA), 'INSTRUCTOR_REQUIRED');
    const order = saved.lessons.filter(l => l.trackId === 'track_product').sort((a, b) => a.position - b.position).map(l => l.id);
    throwsCode(() => exec(saved, { type: 'track.lessons.reorder', trackId: 'track_product', expectedOrder: order, lessonIds: [...order].reverse() }, MAYA), 'INSTRUCTOR_REQUIRED');
    throwsCode(() => beginCoverUpload(saved, ctx(MAYA), { purpose: 'cover_image', subject: 'track', subjectId: 'track_product', contentType: 'image/jpeg', sizeBytes: 1000 }, { id: 'cover_maya', objectKey: 'k/cover' }, NOW), 'COVER_EDITOR_REQUIRED');
    // The track's instructor publishes the contributor's saved draft.
    const published = run(saved, { type: 'lesson.draft.publish', draftId: draft.id, expectedVersion: 2 }, IDRIS);
    assert(published.lessons.some(l => l.title === 'A new lesson' && l.published));
});

test('knowledge-check answers and their review stay with instructors', () => {
    const s = withContributor();
    const view = visibleRecords(s, ctx(MAYA));
    assert(!view.quizAttempts.some(a => a.id === 'attempt_sofia'), 'a contributor does not see learners’ attempts');
    assert.equal(pageOf(visibleRecords(s, ctx(MAYA)), ctx(MAYA), 'review-waiting', { limit: 20 }).items.length, 0);
    throwsCode(() => exec(s, { type: 'quiz.attempt.review', attemptId: 'attempt_sofia', expectedVersion: 1, marks: [{ questionId: 'q6_change', points: 2 }], feedback: 'Good.' }, MAYA), 'REVIEWER_REQUIRED');
});

test('changing a role replaces the grant in the acting administrator’s name, and repeats change nothing', () => {
    const s = withContributor();
    const before = s.trackInstructors.find(i => i.userId === MAYA)!;
    const promoted = exec(s, { type: 'track.instructor.add', trackId: 'track_product', userId: MAYA, role: 'instructor' }, DEMO_ADMIN);
    const after = promoted.workspace.trackInstructors.filter(i => i.userId === MAYA);
    assert.equal(after.length, 1);
    assert.notEqual(after[0].id, before.id, 'a new grant, not an edited one');
    assert.equal(after[0].role, 'instructor');
    assert.match(promoted.message, /earlier grant is replaced/);
    assert.equal(teaches(promoted.workspace, member(promoted.workspace, MAYA), 'track_product'), true);
    const again = exec(promoted.workspace, { type: 'track.instructor.add', trackId: 'track_product', userId: MAYA, role: 'instructor' }, DEMO_ADMIN);
    assert.equal(again.workspace.revision, promoted.workspace.revision);
    throwsCode(() => exec(s, { type: 'track.instructor.add', trackId: 'track_product', userId: MAYA, role: 'instructor' }, IDRIS), 'ADMIN_REQUIRED');
});

test('suspension ends a contributor’s access at once', () => {
    const s = withContributor();
    member(s, MAYA).status = 'suspended';
    assert.equal(contributes(s, member(s, MAYA), 'track_product'), false);
});
