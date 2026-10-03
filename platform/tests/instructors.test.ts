import { test } from 'node:test';
import assert from 'node:assert/strict';
import { commandSchema, type Workspace } from '../packages/contracts/src/index';
import { quizFingerprint, type QuizAnswer } from '../packages/contracts/src/assessments';
import { visibleRecords, applyCommand, visibleWorkspace } from '../packages/domain/src/engine';
import { lessonContent } from '../packages/domain/src/authoring';
import { beginResourceUpload, completeResourceUpload, discardResourceUpload, resolveResourceDownload } from '../packages/domain/src/resources';
import { beginCoverUpload } from '../packages/domain/src/covers';
import { taughtTracks, teaches, teachesAny } from '../packages/domain/src/instructors';
import { createSeed, DEMO_ADMIN, DEMO_USER } from '../packages/domain/src/seed';

const ORG = 'org_code_black', NOW = '2026-10-03T12:00:00.000Z', IDRIS = 'member_idris';
let seq = 0;
const ctx = (userId = DEMO_USER, organizationId = ORG) => ({ organizationId, userId, requestId: 'instructors_test' });
const exec = (s: Workspace, cmd: unknown, user = DEMO_USER) => applyCommand(s, ctx(user), cmd, () => NOW, () => `instr_${++seq}`);
const run = (s: Workspace, cmd: unknown, user = DEMO_USER) => exec(s, cmd, user).workspace;
const throwsCode = (fn: () => unknown, code: string) => assert.throws(fn, (e: { code?: string }) => e.code === code, code);
/** A command changed something when it advanced the workspace revision. */
const changes = (s: Workspace, cmd: unknown, user: string) => exec(s, cmd, user).workspace.revision !== s.revision;
const member = (s: Workspace, userId: string) => s.members.find(m => m.userId === userId && m.organizationId === ORG)!;
const draftFor = (s: Workspace, trackId: string, user: string) => { const r = exec(s, { type: 'lesson.draft.create', trackId }, user); return { s: r.workspace, draft: r.workspace.lessonDrafts.find(d => d.id === r.objectId)! }; };
const lesson6Answers: QuizAnswer[] = [{ questionId: 'q6_watch', optionIds: ['b'], text: '' }, { questionId: 'q6_change', optionIds: [], text: 'Autosave, because they lost work.' }];
function submit(s: Workspace, lessonId: string, answers: QuizAnswer[], user: string) {
    const seen = visibleWorkspace(s, ctx(user)).lessons.find(l => l.id === lessonId)!.quiz!;
    return exec(s, { type: 'quiz.attempt.submit', lessonId, fingerprint: quizFingerprint(seen), answers }, user);
}

test('the instructor commands are strict and bounded', () => {
    assert.equal(commandSchema.safeParse({ type: 'track.instructor.add', trackId: 'track_story', userId: 'member_maya' }).success, true);
    assert.equal(commandSchema.safeParse({ type: 'track.instructor.add', trackId: 'track_story', userId: 'member_maya', role: 'admin' }).success, false);
    assert.equal(commandSchema.safeParse({ type: 'track.instructor.remove', trackId: 'track story', userId: 'member_maya' }).success, false);
});

test('being named as a track author grants nothing; only explicit grants teach', () => {
    const s = createSeed();
    assert.equal(s.tracks.find(t => t.id === 'track_story')!.authorId, 'member_maya');
    assert.equal(teaches(s, member(s, 'member_maya'), 'track_story'), false, 'the named author of a track is not its instructor');
    throwsCode(() => exec(s, { type: 'lesson.draft.create', trackId: 'track_story' }, 'member_maya'), 'AUTHOR_REQUIRED');
    assert.deepEqual([...taughtTracks(s, member(s, IDRIS))], ['track_product'], 'the seeded grant covers one track');
    assert.equal(teachesAny(s, member(s, DEMO_USER)), false);
    assert.equal(taughtTracks(s, member(s, DEMO_ADMIN)).size, s.tracks.length, 'administrators teach every track');
});

test('only active owners and administrators grant and revoke, idempotently, to active members', () => {
    let s = createSeed();
    for (const user of [DEMO_USER, 'member_maya', IDRIS]) throwsCode(() => exec(s, { type: 'track.instructor.add', trackId: 'track_story', userId: user }, user), 'ADMIN_REQUIRED');
    throwsCode(() => exec(s, { type: 'track.instructor.add', trackId: 'track_missing', userId: 'member_maya' }, DEMO_ADMIN), 'NOT_FOUND');
    throwsCode(() => exec(s, { type: 'track.instructor.add', trackId: 'track_story', userId: 'member_nobody' }, DEMO_ADMIN), 'MEMBER_UNAVAILABLE');
    const suspended = structuredClone(s); member(suspended, 'member_theo').status = 'suspended';
    throwsCode(() => exec(suspended, { type: 'track.instructor.add', trackId: 'track_story', userId: 'member_theo' }, DEMO_ADMIN), 'MEMBER_UNAVAILABLE');
    assert.equal(changes(s, { type: 'track.instructor.add', trackId: 'track_story', userId: 'member_maya' }, DEMO_ADMIN), true);
    s = run(s, { type: 'track.instructor.add', trackId: 'track_story', userId: 'member_maya' }, DEMO_ADMIN);
    const grant = s.trackInstructors.find(i => i.trackId === 'track_story')!;
    assert.deepEqual([grant.userId, grant.grantedBy, grant.organizationId], ['member_maya', DEMO_ADMIN, ORG]);
    assert(s.notifications.some(n => n.userId === 'member_maya' && n.href === '/learn/track_story/studio'), 'the new instructor is told where to start');
    assert(s.audit.some(a => a.action === 'track.instructor.add' && a.objectId === 'track_story'));
    assert.equal(changes(s, { type: 'track.instructor.add', trackId: 'track_story', userId: 'member_maya' }, DEMO_ADMIN), false, 'granting twice changes nothing');
    s = run(s, { type: 'track.instructor.remove', trackId: 'track_story', userId: 'member_maya' }, DEMO_ADMIN);
    assert.equal(s.trackInstructors.some(i => i.trackId === 'track_story'), false);
    assert.equal(changes(s, { type: 'track.instructor.remove', trackId: 'track_story', userId: 'member_maya' }, DEMO_ADMIN), false);
    throwsCode(() => exec(s, { type: 'lesson.draft.create', trackId: 'track_story' }, 'member_maya'), 'AUTHOR_REQUIRED');
});

test('an instructor authors, publishes and reorders only their own track', () => {
    let { s, draft } = draftFor(createSeed(), 'track_product', IDRIS);
    s = run(s, { type: 'lesson.draft.save', draftId: draft.id, expectedVersion: draft.version, ...lessonContent(draft), title: 'Talk to five people', summary: 'Five short conversations.', body: 'Book five calls this week.' }, IDRIS);
    draft = s.lessonDrafts.find(d => d.id === draft.id)!;
    s = run(s, { type: 'lesson.draft.publish', draftId: draft.id, expectedVersion: draft.version }, IDRIS);
    assert(s.lessons.some(l => l.trackId === 'track_product' && l.title === 'Talk to five people' && l.published));
    const order = s.lessons.filter(l => l.trackId === 'track_product').sort((a, b) => a.position - b.position).map(l => l.id);
    s = run(s, { type: 'track.lessons.reorder', trackId: 'track_product', expectedOrder: order, lessonIds: [...order].reverse() }, IDRIS);
    throwsCode(() => exec(s, { type: 'lesson.draft.create', trackId: 'track_story' }, IDRIS), 'NOT_FOUND');
    const other = draftFor(s, 'track_story', DEMO_ADMIN);
    throwsCode(() => exec(other.s, { type: 'lesson.draft.save', draftId: other.draft.id, expectedVersion: other.draft.version, ...lessonContent(other.draft) }, IDRIS), 'NOT_FOUND');
    const view = visibleWorkspace(other.s, ctx(IDRIS));
    assert(view.lessonDrafts.length > 0 && view.lessonDrafts.every(d => d.trackId === 'track_product'), 'drafts of other tracks stay private');
    assert(view.lessonRevisions.every(r => r.trackId === 'track_product'));
    assert.deepEqual(visibleWorkspace(other.s, ctx(DEMO_USER)).lessonDrafts, [], 'members still see no drafts');
});

test('an instructor sees answer keys and attempts for their track only, and reviews them but never their own', () => {
    let s = createSeed();
    const view = visibleRecords(s, ctx(IDRIS));
    assert('acceptedAnswers' in view.lessons.find(l => l.id === 'lesson_5')!.quiz!.questions[2], 'keys for the taught track');
    assert.deepEqual(view.quizAttempts.map(a => a.id), ['attempt_sofia'], 'attempts on the taught track');
    const r = exec(s, { type: 'quiz.attempt.review', attemptId: 'attempt_sofia', expectedVersion: 1, marks: [{ questionId: 'q6_change', points: 2 }], feedback: 'Specific and observed.' }, IDRIS);
    const reviewed = r.workspace.quizAttempts.find(a => a.id === 'attempt_sofia')!;
    assert.deepEqual([reviewed.status, reviewed.reviewerId, reviewed.score], ['reviewed', IDRIS, 3]);
    s = run(r.workspace, { type: 'track.enrol', trackId: 'track_product' }, IDRIS);
    const own = submit(s, 'lesson_6', lesson6Answers, IDRIS);
    throwsCode(() => exec(own.workspace, { type: 'quiz.attempt.review', attemptId: own.objectId!, expectedVersion: 1, marks: [{ questionId: 'q6_change', points: 1 }], feedback: 'Self' }, IDRIS), 'SELF_REVIEW');
    throwsCode(() => exec(own.workspace, { type: 'quiz.attempt.review', attemptId: own.objectId!, expectedVersion: 1, marks: [{ questionId: 'q6_change', points: 1 }], feedback: 'No' }, DEMO_USER), 'REVIEWER_REQUIRED');
});

test('an instructor of another track is told nothing about this track’s attempts', () => {
    let s = run(createSeed(), { type: 'track.instructor.remove', trackId: 'track_product', userId: IDRIS }, DEMO_ADMIN);
    s = run(s, { type: 'track.instructor.add', trackId: 'track_story', userId: IDRIS }, DEMO_ADMIN);
    const view = visibleRecords(s, ctx(IDRIS));
    assert.equal(view.quizAttempts.some(a => a.id === 'attempt_sofia'), false);
    assert.equal('acceptedAnswers' in view.lessons.find(l => l.id === 'lesson_5')!.quiz!.questions[2], false, 'no keys for the product track');
    throwsCode(() => exec(s, { type: 'quiz.attempt.review', attemptId: 'attempt_sofia', expectedVersion: 1, marks: [{ questionId: 'q6_change', points: 2 }], feedback: 'No' }, IDRIS), 'NOT_FOUND');
});

test('suspension ends an instructor’s rights at once, and reinstatement restores the grant', () => {
    const s = createSeed(); member(s, IDRIS).status = 'suspended';
    throwsCode(() => exec(s, { type: 'lesson.draft.create', trackId: 'track_product' }, IDRIS), 'FORBIDDEN');
    assert.equal(teaches(s, member(s, IDRIS), 'track_product'), false);
    member(s, IDRIS).status = 'active';
    assert.equal(changes(s, { type: 'lesson.draft.create', trackId: 'track_product' }, IDRIS), true);
});

test('lesson files and covers follow the same per-track rule', () => {
    const s = createSeed();
    const ids = { id: 'upload_idris', objectKey: 'k' };
    const begun = beginResourceUpload(s, ctx(IDRIS), { purpose: 'lesson_resource', trackId: 'track_product', name: 'Plan.pdf', contentType: 'application/pdf', sizeBytes: 100 }, ids, NOW);
    const done = completeResourceUpload(begun.workspace, ctx(IDRIS), 'upload_idris', { sizeBytes: 100, contentType: 'application/pdf', generation: '17', signatureMatches: true }, NOW);
    assert.equal(done.outcome, 'ready');
    assert.deepEqual(visibleWorkspace(done.workspace, ctx(IDRIS)).uploads.map(u => u.id).sort(), ['upload_idris', ...s.uploads.filter(u => u.trackId === 'track_product').map(u => u.id)].sort());
    assert.deepEqual(visibleWorkspace(done.workspace, ctx(DEMO_USER)).uploads, []);
    assert.throws(() => beginResourceUpload(s, ctx(IDRIS), { purpose: 'lesson_resource', trackId: 'track_story', name: 'Plan.pdf', contentType: 'application/pdf', sizeBytes: 100 }, ids, NOW), { code: 'NOT_FOUND' });
    assert.throws(() => beginResourceUpload(s, ctx(DEMO_USER), { purpose: 'lesson_resource', trackId: 'track_product', name: 'Plan.pdf', contentType: 'application/pdf', sizeBytes: 100 }, ids, NOW), { code: 'AUTHOR_REQUIRED' });
    assert.equal(discardResourceUpload(done.workspace, ctx(IDRIS), 'upload_idris', NOW).id, 'upload_idris');
    // Draft files of the taught track can be fetched by its instructor, never by a member.
    let { s: withDraft, draft } = draftFor(done.workspace, 'track_product', IDRIS);
    withDraft = run(withDraft, { type: 'lesson.draft.save', draftId: draft.id, expectedVersion: draft.version, ...lessonContent(draft), resources: [{ id: 'res_plan', fileId: 'upload_idris', name: 'Plan' }] }, IDRIS);
    assert.equal(resolveResourceDownload(withDraft, ctx(IDRIS), { context: 'draft', recordId: draft.id, resourceId: 'res_plan' }).filename, 'Plan.pdf');
    assert.throws(() => resolveResourceDownload(withDraft, ctx(DEMO_USER), { context: 'draft', recordId: draft.id, resourceId: 'res_plan' }), { code: 'NOT_FOUND' });
    assert.equal(beginCoverUpload(s, ctx(IDRIS), { purpose: 'cover_image', subject: 'track', subjectId: 'track_product', contentType: 'image/png', sizeBytes: 100 }, { id: 'c1', objectKey: 'c' }, NOW).upload.coverTrackId, 'track_product');
    assert.throws(() => beginCoverUpload(s, ctx(IDRIS), { purpose: 'cover_image', subject: 'track', subjectId: 'track_story', contentType: 'image/png', sizeBytes: 100 }, { id: 'c2', objectKey: 'c' }, NOW), { code: 'COVER_EDITOR_REQUIRED' });
});

test('grants never cross tenants', () => {
    const north = createSeed('studio-north');
    north.members.push({ ...member(createSeed(), IDRIS), organizationId: 'org_studio_north' });
    const grant = createSeed().trackInstructors[0];
    north.trackInstructors.push(grant);
    const idrisNorth = north.members.find(m => m.userId === IDRIS && m.organizationId === 'org_studio_north')!;
    assert.equal(teaches(north, idrisNorth, 'track_product'), false, 'a Code Black grant does not apply in Studio North');
    assert.deepEqual(visibleWorkspace(north, ctx(IDRIS, 'org_studio_north')).trackInstructors, []);
});
