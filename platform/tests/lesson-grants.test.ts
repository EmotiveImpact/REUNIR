import { test } from 'node:test';
import assert from 'node:assert/strict';
import { commandSchema, type Workspace } from '../packages/contracts/src/index';
import { applyCommand, visibleRecords } from '../packages/domain/src/engine';
import { beginCoverUpload } from '../packages/domain/src/covers';
import { contributes, holdsGrant, teaches, teachesAny } from '../packages/domain/src/instructors';
import { pageOf } from '../packages/domain/src/pages';
import { createSeed, DEMO_ADMIN } from '../packages/domain/src/seed';

const ORG = 'org_code_black', NOW = '2026-10-03T12:00:00.000Z', MAYA = 'member_maya';
let seq = 0;
const ctx = (userId: string) => ({ organizationId: ORG, userId, requestId: 'lesson_grants_test' });
const exec = (s: Workspace, cmd: unknown, user: string) => applyCommand(s, ctx(user), cmd, () => NOW, () => `lg_${++seq}`);
const run = (s: Workspace, cmd: unknown, user = DEMO_ADMIN) => exec(s, cmd, user).workspace;
const throwsCode = (fn: () => unknown, code: string) => assert.throws(fn, (e: { code?: string }) => e.code === code, code);
const member = (s: Workspace, userId: string) => s.members.find(m => m.userId === userId && m.organizationId === ORG)!;
/** Maya teaches lesson 6 of the product track only, where Sofia's answer waits. */
const scoped = (role = 'instructor', lessonIds = ['lesson_6']) => run(createSeed(), { type: 'track.instructor.add', trackId: 'track_product', userId: MAYA, role, lessonIds });
const draft = (s: Workspace, lessonId: string | null) => { const r = exec(s, { type: 'lesson.draft.create', trackId: 'track_product', lessonId }, MAYA); return { s: r.workspace, id: r.objectId! }; };

test('lessons are optional, bounded and must belong to the track', () => {
    const parsed = commandSchema.parse({ type: 'track.instructor.add', trackId: 'track_product', userId: MAYA });
    assert.equal(parsed.type === 'track.instructor.add' && parsed.lessonIds, null, 'the whole track by default');
    assert.equal(commandSchema.safeParse({ type: 'track.instructor.add', trackId: 'track_product', userId: MAYA, lessonIds: [] }).success, false, 'an empty list is not a grant');
    throwsCode(() => run(createSeed(), { type: 'track.instructor.add', trackId: 'track_product', userId: MAYA, lessonIds: ['lesson_1'] }), 'LESSON_UNAVAILABLE');
    const s = run(createSeed(), { type: 'track.instructor.add', trackId: 'track_product', userId: MAYA, lessonIds: ['lesson_6', 'lesson_5', 'lesson_6'] });
    assert.deepEqual(s.trackInstructors.find(i => i.userId === MAYA)!.lessonIds, ['lesson_5', 'lesson_6'], 'stored once each, in a stable order');
    assert.equal(s.notifications.at(-1)!.title, 'You can now teach 2 lessons of From idea to first version');
});

test('a grant for some lessons opens those lessons and nothing that belongs to the whole track', () => {
    const s = scoped(), maya = member(s, MAYA);
    assert.equal(holdsGrant(s, maya, 'track_product'), true);
    assert.equal(teaches(s, maya, 'track_product', 'lesson_6'), true);
    assert.equal(teaches(s, maya, 'track_product', 'lesson_5'), false);
    assert.equal(teaches(s, maya, 'track_product'), false, 'not the whole track');
    assert.equal(contributes(s, maya, 'track_product', null), false);
    const opened = draft(s, 'lesson_6');
    throwsCode(() => draft(opened.s, 'lesson_5'), 'LESSON_NOT_GRANTED');
    throwsCode(() => draft(opened.s, null), 'LESSON_NOT_GRANTED');
    const order = s.lessons.filter(l => l.trackId === 'track_product').sort((a, b) => a.position - b.position).map(l => l.id);
    throwsCode(() => exec(opened.s, { type: 'track.lessons.reorder', trackId: 'track_product', expectedOrder: order, lessonIds: [...order].reverse() }, MAYA), 'LESSON_NOT_GRANTED');
    throwsCode(() => beginCoverUpload(s, ctx(MAYA), { purpose: 'cover_image', subject: 'track', subjectId: 'track_product', contentType: 'image/jpeg', sizeBytes: 1000 }, { id: 'c', objectKey: 'k' }, NOW), 'COVER_EDITOR_REQUIRED');
    // Saving and publishing their own lesson works.
    const d = opened.s.lessonDrafts.find(x => x.id === opened.id)!;
    const saved = run(opened.s, { type: 'lesson.draft.save', draftId: d.id, expectedVersion: 1, title: 'Watch someone use it, again', summary: d.summary, body: d.body, minutes: d.minutes, resourceUrl: '', richBody: d.richBody, resources: d.resources ?? [], quiz: d.quiz }, MAYA);
    const published = run(saved, { type: 'lesson.draft.publish', draftId: d.id, expectedVersion: 2 }, MAYA);
    assert.equal(published.lessons.find(l => l.id === 'lesson_6')!.title, 'Watch someone use it, again');
});

test('other lessons’ drafts, history and answers stay out of view', () => {
    // An administrator drafts lesson 5; Maya, with lesson 6 only, does not see it and cannot write it.
    const opened = exec(scoped(), { type: 'lesson.draft.create', trackId: 'track_product', lessonId: 'lesson_5' }, DEMO_ADMIN);
    const view = visibleRecords(opened.workspace, ctx(MAYA));
    assert(!view.lessonDrafts.some(d => d.id === opened.objectId));
    assert(!view.lessonRevisions.some(r => r.lessonId === 'lesson_5'));
    throwsCode(() => exec(opened.workspace, { type: 'lesson.draft.save', draftId: opened.objectId, expectedVersion: 1, title: 'x', summary: 'x', body: 'x', minutes: 5, resourceUrl: '' }, MAYA), 'NOT_FOUND');
    // Answer keys show for lesson 6 only.
    const lesson5 = view.lessons.find(l => l.id === 'lesson_5')!, lesson6 = view.lessons.find(l => l.id === 'lesson_6')!;
    assert(lesson6.quiz!.questions.some(q => q.kind !== 'written' && q.options.some(o => o.correct)), 'keys on their lesson');
    assert(!lesson5.quiz!.questions.some(q => q.options.some(o => o.correct)), 'no keys on another lesson');
    assert(view.quizAttempts.some(a => a.id === 'attempt_sofia'), 'the attempt on their lesson');
});

test('review follows the lesson: a lesson 6 instructor marks lesson 6 answers, a lesson 5 instructor cannot', () => {
    const six = scoped();
    assert.equal(pageOf(visibleRecords(six, ctx(MAYA)), ctx(MAYA), 'review-waiting', { limit: 20 }).items.length, 1);
    const reviewed = run(six, { type: 'quiz.attempt.review', attemptId: 'attempt_sofia', expectedVersion: 1, marks: [{ questionId: 'q6_change', points: 2 }], feedback: 'Clear.' }, MAYA);
    assert.equal(reviewed.quizAttempts.find(a => a.id === 'attempt_sofia')!.reviewerId, MAYA);
    const five = scoped('instructor', ['lesson_5']);
    assert.equal(teachesAny(five, member(five, MAYA)), true, 'review opens');
    assert.equal(pageOf(visibleRecords(five, ctx(MAYA)), ctx(MAYA), 'review-waiting', { limit: 20 }).items.length, 0);
    throwsCode(() => exec(five, { type: 'quiz.attempt.review', attemptId: 'attempt_sofia', expectedVersion: 1, marks: [{ questionId: 'q6_change', points: 2 }], feedback: 'x' }, MAYA), 'NOT_FOUND');
});

test('a contributor for some lessons drafts only those, and widening the grant replaces it', () => {
    const s = scoped('contributor', ['lesson_6']);
    const opened = draft(s, 'lesson_6');
    throwsCode(() => exec(opened.s, { type: 'lesson.draft.publish', draftId: opened.id, expectedVersion: 1 }, MAYA), 'INSTRUCTOR_REQUIRED');
    const before = s.trackInstructors.find(i => i.userId === MAYA)!;
    const widened = run(s, { type: 'track.instructor.add', trackId: 'track_product', userId: MAYA, role: 'contributor', lessonIds: null });
    const after = widened.trackInstructors.filter(i => i.userId === MAYA);
    assert.equal(after.length, 1); assert.notEqual(after[0].id, before.id); assert.equal(after[0].lessonIds, null);
    assert.equal(contributes(widened, member(widened, MAYA), 'track_product'), true);
    const same = exec(widened, { type: 'track.instructor.add', trackId: 'track_product', userId: MAYA, role: 'contributor' }, DEMO_ADMIN);
    assert.equal(same.workspace.revision, widened.revision, 'the same grant again changes nothing');
});
