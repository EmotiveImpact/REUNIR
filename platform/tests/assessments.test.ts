import { test } from 'node:test';
import assert from 'node:assert/strict';
import { commandSchema, type QuizAttempt, type Workspace } from '../packages/contracts/src/index';
import {
    MAX_QUIZ_QUESTIONS, learnerQuiz, lessonQuizSchema, normaliseAnswer, quizAnswersInput, quizFingerprint, quizPercentage, scoreQuiz,
    type AuthoredQuiz, type LessonQuiz, type QuizAnswer,
} from '../packages/contracts/src/assessments';
import { visibleRecords, applyCommand, visibleWorkspace } from '../packages/domain/src/engine';
import { lessonContent } from '../packages/domain/src/authoring';
import { answersUnlocked, normaliseQuiz } from '../packages/domain/src/assessments';
import { createSeed, DEMO_ADMIN, DEMO_USER } from '../packages/domain/src/seed';

const ORG = 'org_code_black', NOW = '2026-10-02T12:00:00.000Z';
let seq = 0;
const ctx = (userId = DEMO_USER, organizationId = ORG) => ({ organizationId, userId, requestId: 'assessments_test' });
const exec = (s: Workspace, cmd: unknown, user = DEMO_USER) => applyCommand(s, ctx(user), cmd, () => NOW, () => `quiz_${++seq}`);
const run = (s: Workspace, cmd: unknown, user = DEMO_USER) => exec(s, cmd, user).workspace;
const quizOf = (s: Workspace, lessonId: string) => s.lessons.find(l => l.id === lessonId)!.quiz!;
const lesson5Right: QuizAnswer[] = [
    { questionId: 'q5_feedback', optionIds: ['a'], text: '' },
    { questionId: 'q5_essentials', optionIds: ['a', 'b'], text: '' },
    { questionId: 'q5_outcome', optionIds: [], text: '  USEFUL ' },
];
const lesson6Answers: QuizAnswer[] = [{ questionId: 'q6_watch', optionIds: ['b'], text: '' }, { questionId: 'q6_change', optionIds: [], text: 'Autosave, because they lost work.' }];
/** Submit as the learner sees the quiz: the fingerprint comes from their own (key-free) copy. */
function submit(s: Workspace, lessonId: string, answers: QuizAnswer[], user = DEMO_USER) {
    const seen = visibleWorkspace(s, ctx(user)).lessons.find(l => l.id === lessonId)!.quiz!;
    return exec(s, { type: 'quiz.attempt.submit', lessonId, fingerprint: quizFingerprint(seen), answers }, user);
}
const mine = (s: Workspace, user = DEMO_USER, lessonId?: string) => visibleWorkspace(s, ctx(user)).quizAttempts.filter(a => a.userId === user && (!lessonId || a.lessonId === lessonId));
const enrol = (s: Workspace, user: string, trackId = 'track_product') => run(s, { type: 'track.enrol', trackId }, user);
const throwsCode = (fn: () => unknown, code: string) => assert.throws(fn, (e: { code?: string }) => e.code === code);
const keyless = (quiz: LessonQuiz) => !quiz.questions.some(q => 'acceptedAnswers' in q || 'explanation' in q || q.options.some(o => 'correct' in o));
const valid = (): AuthoredQuiz => normaliseQuiz(quizOf(createSeed(), 'lesson_5'))!;

test('the seeded knowledge checks satisfy the authoring schema', () => {
    const s = createSeed();
    for (const id of ['lesson_5', 'lesson_6']) assert.equal(lessonQuizSchema.safeParse(quizOf(s, id)).success, true, id);
    assert.equal(createSeed('studio-north').lessons.some(l => l.quiz), false);
});

test('the schema rejects ambiguous or malformed questions', () => {
    const bad = (change: (q: AuthoredQuiz) => void) => { const quiz = valid(); change(quiz); return lessonQuizSchema.safeParse(quiz).success; };
    assert.equal(bad(q => { q.questions[0].options[1].correct = true; }), false, 'two correct options on a single-choice question');
    assert.equal(bad(q => { q.questions[1].options.forEach(o => { o.correct = false; }); }), false, 'no correct option');
    assert.equal(bad(q => { q.questions[0].options = q.questions[0].options.slice(0, 1); }), false, 'one option');
    assert.equal(bad(q => { q.questions[0].options[1].text = ' exactly WHAT you need feedback on '; }), false, 'duplicate option text after normalisation');
    assert.equal(bad(q => { q.questions[2].acceptedAnswers = []; }), false, 'short answer without accepted answers');
    assert.equal(bad(q => { q.questions[2].acceptedAnswers = ['']; }), false, 'empty accepted answer');
    assert.equal(bad(q => { q.questions[2].kind = 'written'; }), false, 'written response with accepted answers');
    assert.equal(bad(q => { q.questions[2].options = [{ id: 'a', text: 'Useful', correct: true }, { id: 'b', text: 'Big', correct: false }]; }), false, 'short answer with options');
    assert.equal(bad(q => { q.questions[1].id = q.questions[0].id; }), false, 'duplicate question ids');
    assert.equal(bad(q => { q.questions[0].prompt = 'Line\u0007bell'; }), false, 'control characters');
    assert.equal(bad(q => { q.questions[0].points = 11; }), false, 'too many points');
    assert.equal(bad(q => { q.passPercentage = 0; }), false, 'zero pass mark');
    assert.equal(bad(q => { q.maxAttempts = 11; }), false, 'too many attempts');
    assert.equal(bad(q => { q.questions = Array.from({ length: MAX_QUIZ_QUESTIONS + 1 }, (_, i) => ({ ...q.questions[0], id: `q${i}` })); }), false, 'too many questions');
    assert.equal(bad(q => { q.questions = Array.from({ length: MAX_QUIZ_QUESTIONS }, (_, i) => ({ ...q.questions[0], id: `q${i}`, prompt: 'x'.repeat(300), explanation: 'y'.repeat(300), options: q.questions[0].options.map(o => ({ ...o, text: o.id.repeat(150) })) })); }), false, 'over the byte budget');
    assert.equal(bad(q => { q.questions = []; }), false, 'no questions');
    assert.equal(bad(() => undefined), true);
});

test('scoring is deterministic, exact for choices and normalised for short answers', () => {
    const quiz = valid();
    assert.equal(normaliseAnswer('  Ｕｓｅｆｕｌ\n  OUTCOME '), 'useful outcome');
    const right = scoreQuiz(quiz, lesson5Right);
    assert.deepEqual([right.autoScore, right.maxScore, right.needsReview], [4, 4, false]);
    const partial = scoreQuiz(quiz, [lesson5Right[0], { questionId: 'q5_essentials', optionIds: ['a'], text: '' }, { questionId: 'q5_outcome', optionIds: [], text: 'usefull' }]);
    assert.deepEqual(partial.results.map(r => [r.correct, r.points]), [[true, 1], [false, 0], [false, 0]]);
    const extra = scoreQuiz(quiz, [lesson5Right[0], { questionId: 'q5_essentials', optionIds: ['a', 'b', 'c'], text: '' }, lesson5Right[2]]);
    assert.equal(extra.results[1].correct, false, 'choosing every option is not rewarded');
    const written = scoreQuiz(normaliseQuiz(quizOf(createSeed(), 'lesson_6'))!, lesson6Answers);
    assert.deepEqual([written.autoScore, written.maxScore, written.needsReview, written.results[1].points], [0, 4, true, null]);
    assert.equal(quizPercentage(2, 3), 66, 'percentages round down, never up into a pass');
    assert.equal(quizPercentage(0, 0), 0);
});

test('learner copies of a quiz carry no answers and fingerprints ignore answer keys', () => {
    const quiz = valid(), learner = learnerQuiz(quiz);
    assert(keyless(learner));
    assert.equal(quizFingerprint(learner), quizFingerprint(quiz));
    const reverseKeys = (v: unknown): unknown => Array.isArray(v) ? v.map(reverseKeys) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).reverse().map(([k, x]) => [k, reverseKeys(x)])) : v;
    const reordered = reverseKeys(quiz) as LessonQuiz;
    assert.equal(quizFingerprint(reordered), quizFingerprint(quiz), 'database key order does not matter');
    assert.equal(JSON.stringify(normaliseQuiz(reordered)), JSON.stringify(quiz), 'normalised key order is canonical');
    const changed = (edit: (q: AuthoredQuiz) => void) => { const q = valid(); edit(q); return quizFingerprint(q) !== quizFingerprint(quiz); };
    assert.equal(changed(q => { q.questions[0].prompt += '?'; }), true);
    assert.equal(changed(q => { q.questions[0].options[2].text = 'Something else'; }), true);
    assert.equal(changed(q => { q.maxAttempts = 2; }), true);
    assert.equal(changed(q => { q.questions[0].options[0].correct = false; q.questions[0].options[1].correct = true; }), false);
    assert.equal(changed(q => { q.questions[2].acceptedAnswers.push('helpful'); q.questions[2].explanation = 'Changed'; }), false);
    assert.match(quizFingerprint(quiz), /^[0-9a-f]{8}$/);
});

test('answer input is bounded and unambiguous', () => {
    assert.equal(quizAnswersInput.safeParse([lesson5Right[0], lesson5Right[0]]).success, false);
    assert.equal(quizAnswersInput.safeParse([]).success, false);
    const long = Array.from({ length: 15 }, (_, i) => ({ questionId: `q${i}`, optionIds: [], text: 'é'.repeat(1500) }));
    assert.equal(quizAnswersInput.safeParse(long).success, false, 'byte budget across all answers');
    assert.equal(commandSchema.safeParse({ type: 'quiz.attempt.submit', lessonId: 'lesson_5', fingerprint: 'nope', answers: lesson5Right }).success, false);
    assert.equal(commandSchema.safeParse({ type: 'quiz.attempt.review', attemptId: 'a', expectedVersion: 1, marks: [], feedback: '   ' }).success, false, 'feedback is required');
});

test('members never receive answer keys; owners and administrators do', () => {
    const s = createSeed();
    for (const user of [DEMO_USER, 'member_maya']) {
        const seen = visibleWorkspace(s, ctx(user));
        assert(seen.lessons.filter(l => l.quiz).every(l => keyless(l.quiz!)), user);
        assert(!JSON.stringify(seen.lessons).includes('acceptedAnswers'), user);
    }
    assert.equal(quizOf(visibleWorkspace(s, ctx(DEMO_ADMIN)), 'lesson_5').questions[0].options[0].correct, true);
    assert.equal(quizOf(s, 'lesson_5').questions[0].options[0].correct, true, 'filtering works on a copy');
});

test('a correct attempt is scored on the server and changes no completion or reputation', () => {
    const s = createSeed();
    const r = submit(s, 'lesson_5', lesson5Right);
    const attempt = r.workspace.quizAttempts.at(-1)!;
    assert.deepEqual([attempt.status, attempt.score, attempt.maxScore, attempt.passed, attempt.attemptNumber, attempt.userId], ['scored', 4, 4, true, 1, DEMO_USER]);
    assert.equal(attempt.answers[2].text, 'USEFUL', 'answers are stored trimmed, as given');
    assert.match(r.message, /4 of 4 \(100%\)\. You passed\./);
    assert.deepEqual(r.workspace.completions, s.completions);
    assert.deepEqual(r.workspace.reputation, s.reputation);
    assert.equal(r.workspace.audit.length, s.audit.length, 'learner attempts are not administrative actions');
});

test('pass marks use the floor percentage and partial multiple choice earns nothing', () => {
    let s = createSeed();
    const essentialsWrong = [lesson5Right[0], { questionId: 'q5_essentials', optionIds: ['a'], text: '' }, lesson5Right[2]];
    s = submit(s, 'lesson_5', essentialsWrong).workspace;
    assert.deepEqual([s.quizAttempts.at(-1)!.score, s.quizAttempts.at(-1)!.passed], [2, false]);
    const r = submit(s, 'lesson_5', [lesson5Right[0], lesson5Right[1], { questionId: 'q5_outcome', optionIds: [], text: 'pretty' }]);
    assert.deepEqual([r.workspace.quizAttempts.at(-1)!.score, r.workspace.quizAttempts.at(-1)!.passed, r.workspace.quizAttempts.at(-1)!.attemptNumber], [3, true, 2], '3 of 4 is exactly the 75% mark');
});

test('incomplete answers are refused without recording an attempt', () => {
    const s = createSeed();
    throwsCode(() => submit(s, 'lesson_5', [{ ...lesson5Right[0], optionIds: [] }, lesson5Right[1], lesson5Right[2]]), 'INCOMPLETE_ATTEMPT');
    throwsCode(() => submit(s, 'lesson_5', [{ ...lesson5Right[0], optionIds: ['a', 'b'] }, lesson5Right[1], lesson5Right[2]]), 'INCOMPLETE_ATTEMPT');
    throwsCode(() => submit(s, 'lesson_5', [lesson5Right[0], lesson5Right[1], { ...lesson5Right[2], text: '   ' }]), 'INCOMPLETE_ATTEMPT');
    throwsCode(() => submit(s, 'lesson_5', [lesson5Right[0], lesson5Right[1], { ...lesson5Right[2], text: 'u'.repeat(121) }]), 'INCOMPLETE_ATTEMPT');
    assert.equal(s.quizAttempts.filter(a => a.userId === DEMO_USER).length, 0);
});

test('answers to a quiz that has since changed are detected, not scored', () => {
    const s = createSeed(), seen = quizOf(visibleWorkspace(s, ctx()), 'lesson_5');
    const send = (fingerprint: string, answers: QuizAnswer[]) => exec(s, { type: 'quiz.attempt.submit', lessonId: 'lesson_5', fingerprint, answers });
    throwsCode(() => send('00000000', lesson5Right), 'STALE_QUIZ');
    throwsCode(() => send(quizFingerprint(seen), lesson5Right.slice(0, 2)), 'STALE_QUIZ');
    throwsCode(() => send(quizFingerprint(seen), [{ ...lesson5Right[0], optionIds: ['z'] }, lesson5Right[1], lesson5Right[2]]), 'STALE_QUIZ');
    throwsCode(() => send(quizFingerprint(seen), [{ ...lesson5Right[0], text: 'a' }, lesson5Right[1], lesson5Right[2]]), 'STALE_QUIZ');
    throwsCode(() => send(quizFingerprint(seen), [lesson5Right[0], lesson5Right[1], { ...lesson5Right[2], questionId: 'q5_other' }]), 'STALE_QUIZ');
    // An author publishes a reworded question while the learner is answering.
    let edited = run(s, { type: 'lesson.draft.create', trackId: 'track_product', lessonId: 'lesson_5' }, DEMO_ADMIN);
    let draft = edited.lessonDrafts.at(-1)!;
    const quiz = normaliseQuiz(draft.quiz)!; quiz.questions[0].prompt = 'What should reviewers know first?';
    edited = run(edited, { type: 'lesson.draft.save', draftId: draft.id, expectedVersion: draft.version, ...lessonContent(draft), quiz }, DEMO_ADMIN);
    draft = edited.lessonDrafts.at(-1)!;
    edited = run(edited, { type: 'lesson.draft.publish', draftId: draft.id, expectedVersion: draft.version }, DEMO_ADMIN);
    throwsCode(() => exec(edited, { type: 'quiz.attempt.submit', lessonId: 'lesson_5', fingerprint: quizFingerprint(seen), answers: lesson5Right }), 'STALE_QUIZ');
    assert.equal(submit(edited, 'lesson_5', lesson5Right).workspace.quizAttempts.at(-1)!.quiz.questions[0].prompt, 'What should reviewers know first?');
});

test('attempt limits are enforced and answers unlock only under the author’s rule', () => {
    let s = createSeed();
    const wrong = [{ ...lesson5Right[0], optionIds: ['b'] }, { ...lesson5Right[1], optionIds: ['a'] }, lesson5Right[2]];
    s = submit(s, 'lesson_5', wrong).workspace;
    assert.deepEqual([s.quizAttempts.at(-1)!.score, s.quizAttempts.at(-1)!.passed], [1, false]);
    let seen = mine(s, DEMO_USER, 'lesson_5');
    assert(keyless(seen[0].quiz), 'a failed attempt with attempts left reveals nothing');
    s = submit(s, 'lesson_5', wrong).workspace;
    s = submit(s, 'lesson_5', wrong).workspace;
    throwsCode(() => submit(s, 'lesson_5', lesson5Right), 'NO_ATTEMPTS_LEFT');
    seen = mine(s, DEMO_USER, 'lesson_5');
    assert.equal(seen.length, 3);
    assert(seen.every(a => !keyless(a.quiz) && a.quiz.questions[0].explanation), 'every attempt used: answers and explanations unlock');
    // Passing unlocks too.
    let passed = submit(createSeed(), 'lesson_5', lesson5Right).workspace;
    assert(!keyless(mine(passed)[0].quiz));
    // Without permission to reveal, nothing unlocks even after passing.
    passed = structuredClone(passed); for (const a of passed.quizAttempts) a.quiz.revealAnswers = false;
    assert(keyless(mine(passed)[0].quiz));
});

test('the reveal rule waits for review and handles checks without a pass mark', () => {
    const base = { organizationId: ORG, lessonId: 'l', userId: 'u', status: 'scored', passed: null } as unknown as QuizAttempt;
    const quiz = (passPercentage: number | null, maxAttempts: number | null) => ({ ...valid(), passPercentage, maxAttempts });
    assert.equal(answersUnlocked([], { ...base, quiz: quiz(null, null) }), true, 'nothing to pass: a final attempt reveals answers');
    assert.equal(answersUnlocked([], { ...base, status: 'awaiting_review', quiz: quiz(null, null) }), false, 'not before review');
    assert.equal(answersUnlocked([{ ...base, quiz: quiz(50, null) }], { ...base, quiz: quiz(50, null) }), false, 'unlimited attempts and not passed');
    assert.equal(answersUnlocked([{ ...base, passed: true, quiz: quiz(50, null) }], { ...base, quiz: quiz(50, null) }), true);
    assert.equal(answersUnlocked([{ ...base, passed: true, organizationId: 'org_other', quiz: quiz(50, null) }], { ...base, quiz: quiz(50, null) }), false, 'another tenant’s pass is irrelevant');
});

test('enrolment, visibility and active membership are required to answer', () => {
    const s = createSeed();
    throwsCode(() => submit(s, 'lesson_5', lesson5Right, 'member_jordan'), 'ENROL_FIRST');
    const hidden = structuredClone(s); hidden.lessons.find(l => l.id === 'lesson_5')!.published = false;
    throwsCode(() => exec(hidden, { type: 'quiz.attempt.submit', lessonId: 'lesson_5', fingerprint: quizFingerprint(quizOf(s, 'lesson_5')), answers: lesson5Right }), 'NOT_FOUND');
    const privateTrack = structuredClone(s); privateTrack.tracks.find(t => t.id === 'track_product')!.spaceId = 'space_studio';
    throwsCode(() => exec(privateTrack, { type: 'quiz.attempt.submit', lessonId: 'lesson_5', fingerprint: quizFingerprint(quizOf(s, 'lesson_5')), answers: lesson5Right }), 'NOT_FOUND');
    throwsCode(() => exec(s, { type: 'quiz.attempt.submit', lessonId: 'lesson_4', fingerprint: '00000000', answers: lesson5Right }), 'NOT_FOUND');
    const suspended = structuredClone(s); suspended.members.find(m => m.userId === DEMO_USER)!.status = 'suspended';
    throwsCode(() => exec(suspended, { type: 'quiz.attempt.submit', lessonId: 'lesson_5', fingerprint: quizFingerprint(quizOf(s, 'lesson_5')), answers: lesson5Right }), 'FORBIDDEN');
});

test('written answers wait for a reviewer and block another attempt until reviewed', () => {
    const s = createSeed();
    const r = submit(s, 'lesson_6', lesson6Answers);
    const attempt = r.workspace.quizAttempts.at(-1)!;
    assert.deepEqual([attempt.status, attempt.score, attempt.passed], ['awaiting_review', 0, null]);
    const note = r.workspace.notifications.filter(n => !s.notifications.some(o => o.id === n.id));
    // Alpha 12: the track's instructor (seeded for the product track) is told as well, and goes to their teaching page.
    assert.deepEqual(note.map(n => [n.userId, n.href]), [[DEMO_ADMIN, '/admin/knowledge-checks'], ['member_idris', '/teaching']], 'only active owners, administrators and the track’s instructors are told');
    throwsCode(() => submit(r.workspace, 'lesson_6', lesson6Answers), 'AWAITING_REVIEW');
});

test('reviews are for active administrators, never the learner, and need every written mark', () => {
    let s = submit(createSeed(), 'lesson_6', lesson6Answers).workspace;
    const attempt = s.quizAttempts.at(-1)!;
    const review = (marks: { questionId: string; points: number }[], user = DEMO_ADMIN, expectedVersion = attempt.version, feedback = 'Clear reasoning. Name the person next time.') => exec(s, { type: 'quiz.attempt.review', attemptId: attempt.id, expectedVersion, marks, feedback }, user);
    throwsCode(() => review([{ questionId: 'q6_change', points: 2 }], 'member_maya'), 'REVIEWER_REQUIRED');
    throwsCode(() => review([{ questionId: 'q6_change', points: 2 }], DEMO_USER), 'REVIEWER_REQUIRED');
    throwsCode(() => review([]), 'INVALID_MARKS');
    throwsCode(() => review([{ questionId: 'q6_change', points: 4 }]), 'INVALID_MARKS');
    throwsCode(() => review([{ questionId: 'q6_change', points: 2 }, { questionId: 'q6_watch', points: 1 }]), 'INVALID_MARKS');
    throwsCode(() => review([{ questionId: 'q6_change', points: 2 }], DEMO_ADMIN, attempt.version + 1), 'STALE_ATTEMPT');
    const demoted = structuredClone(s); demoted.members.find(m => m.userId === DEMO_ADMIN)!.role = 'member';
    throwsCode(() => exec(demoted, { type: 'quiz.attempt.review', attemptId: attempt.id, expectedVersion: 1, marks: [{ questionId: 'q6_change', points: 2 }], feedback: 'Good' }, DEMO_ADMIN), 'REVIEWER_REQUIRED');
    const suspended = structuredClone(s); suspended.members.find(m => m.userId === DEMO_ADMIN)!.status = 'suspended';
    throwsCode(() => exec(suspended, { type: 'quiz.attempt.review', attemptId: attempt.id, expectedVersion: 1, marks: [{ questionId: 'q6_change', points: 2 }], feedback: 'Good' }, DEMO_ADMIN), 'FORBIDDEN');
    const r = review([{ questionId: 'q6_change', points: 2 }]);
    const reviewed = r.workspace.quizAttempts.find(a => a.id === attempt.id)!;
    assert.deepEqual([reviewed.status, reviewed.score, reviewed.passed, reviewed.reviewerId, reviewed.reviewedAt, reviewed.version], ['reviewed', 2, null, DEMO_ADMIN, NOW, 2]);
    assert.deepEqual(reviewed.results.map(x => x.points), [0, 2]);
    assert.deepEqual(reviewed.answers, attempt.answers, 'answers never change');
    assert.equal(r.workspace.audit.at(-1)?.action, 'quiz.attempt.review');
    const told = r.workspace.notifications.at(-1)!;
    assert.deepEqual([told.userId, told.href], [DEMO_USER, '/learn/track_product/lesson_6']);
    s = r.workspace;
    throwsCode(() => review([{ questionId: 'q6_change', points: 3 }], DEMO_ADMIN, 2), 'ALREADY_REVIEWED');
    throwsCode(() => review([{ questionId: 'q6_change', points: 3 }], DEMO_ADMIN, 1), 'STALE_ATTEMPT');
    const learnerView = mine(s, DEMO_USER, 'lesson_6')[0];
    assert.equal(learnerView.feedback, 'Clear reasoning. Name the person next time.');
    assert(keyless(learnerView.quiz), 'this check never reveals answers');
    assert.equal(submit(s, 'lesson_6', lesson6Answers).workspace.quizAttempts.at(-1)!.attemptNumber, 2, 'after review the learner may try again');
});

test('administrators cannot review their own attempt, and can add feedback to a scored one', () => {
    let s = enrol(createSeed(), DEMO_ADMIN);
    s = submit(s, 'lesson_6', lesson6Answers, DEMO_ADMIN).workspace;
    const own = s.quizAttempts.at(-1)!;
    throwsCode(() => exec(s, { type: 'quiz.attempt.review', attemptId: own.id, expectedVersion: 1, marks: [{ questionId: 'q6_change', points: 3 }], feedback: 'Great' }, DEMO_ADMIN), 'SELF_REVIEW');
    s = submit(s, 'lesson_5', lesson5Right).workspace;
    const scored = s.quizAttempts.at(-1)!;
    throwsCode(() => exec(s, { type: 'quiz.attempt.review', attemptId: scored.id, expectedVersion: 1, marks: [{ questionId: 'q5_outcome', points: 1 }], feedback: 'Well done' }, DEMO_ADMIN), 'INVALID_MARKS');
    const r = exec(s, { type: 'quiz.attempt.review', attemptId: scored.id, expectedVersion: 1, marks: [], feedback: 'Well done. Try it with someone new this week.' }, DEMO_ADMIN).workspace.quizAttempts.find(a => a.id === scored.id)!;
    assert.deepEqual([r.status, r.score, r.passed, r.feedback], ['reviewed', 4, true, 'Well done. Try it with someone new this week.']);
});

test('attempts are private to the learner and the community’s administrators, within one tenant', () => {
    const s = submit(createSeed(), 'lesson_6', lesson6Answers).workspace;
    const alex = visibleRecords(s, ctx(DEMO_USER)).quizAttempts, sofia = visibleRecords(s, ctx('member_sofia')).quizAttempts;
    assert(alex.every(a => a.userId === DEMO_USER) && alex.length === 1);
    assert(sofia.every(a => a.userId === 'member_sofia') && sofia.length === 1);
    assert.equal(visibleRecords(s, ctx('member_maya')).quizAttempts.length, 0, 'moderators are not reviewers');
    assert.equal(visibleRecords(s, ctx(DEMO_ADMIN)).quizAttempts.length, 2);
    assert.equal(visibleWorkspace(s, ctx(DEMO_ADMIN)).quizAttempts.length, 0, 'the snapshot leaves other people’s attempts to the paged review queue');
    // A row from another tenant never appears and cannot be reviewed.
    const north = createSeed('studio-north');
    north.quizAttempts.push({ ...s.quizAttempts.at(-1)!, id: 'foreign_attempt' });
    assert.equal(visibleRecords(north, { organizationId: 'org_studio_north', userId: DEMO_ADMIN, requestId: 't' }).quizAttempts.length, 0);
    assert.throws(() => applyCommand(north, { organizationId: 'org_studio_north', userId: DEMO_ADMIN, requestId: 't' }, { type: 'quiz.attempt.review', attemptId: 'foreign_attempt', expectedVersion: 1, marks: [{ questionId: 'q6_change', points: 1 }], feedback: 'No' }, () => NOW, () => 'x'), (e: { code?: string }) => e.code === 'NOT_FOUND');
});

test('knowledge checks follow draft, preview, publication, revision and restore', () => {
    let s = createSeed();
    s = run(s, { type: 'lesson.draft.create', trackId: 'track_product', lessonId: 'lesson_5' }, DEMO_ADMIN);
    let draft = s.lessonDrafts.at(-1)!;
    assert.deepEqual(draft.quiz, normaliseQuiz(quizOf(s, 'lesson_5')), 'a draft starts from the published check');
    throwsCode(() => exec(s, { type: 'lesson.draft.save', draftId: draft.id, expectedVersion: draft.version, title: draft.title, summary: draft.summary, body: draft.body, minutes: draft.minutes, resources: [] }, DEMO_ADMIN), 'QUIZ_REQUIRED');
    const edited = normaliseQuiz(draft.quiz)!;
    edited.questions.push({ id: 'q5_private', kind: 'written', prompt: 'PRIVATE_DRAFT_QUESTION', points: 2, options: [], acceptedAnswers: [], explanation: '' });
    s = run(s, { type: 'lesson.draft.save', draftId: draft.id, expectedVersion: draft.version, ...lessonContent(draft), quiz: edited }, DEMO_ADMIN);
    draft = s.lessonDrafts.at(-1)!;
    assert.equal(draft.quiz!.questions.length, 4);
    assert(!JSON.stringify(visibleWorkspace(s, ctx())).includes('PRIVATE_DRAFT_QUESTION'), 'drafts stay private');
    s = run(s, { type: 'lesson.draft.publish', draftId: draft.id, expectedVersion: draft.version }, DEMO_ADMIN);
    const published = quizOf(visibleWorkspace(s, ctx()), 'lesson_5');
    assert.equal(published.questions.at(-1)!.prompt, 'PRIVATE_DRAFT_QUESTION');
    assert(keyless(published));
    const revisions = s.lessonRevisions.filter(r => r.lessonId === 'lesson_5');
    assert.deepEqual(revisions.map(r => [r.kind, r.quiz?.questions.length]), [['captured', 3], ['published', 4]]);
    // Removing the check, then restoring the captured revision, brings the original back as a draft only.
    draft = s.lessonDrafts.at(-1)!;
    s = run(s, { type: 'lesson.draft.save', draftId: draft.id, expectedVersion: draft.version, ...lessonContent(draft), quiz: null }, DEMO_ADMIN);
    draft = s.lessonDrafts.at(-1)!;
    assert.equal(draft.quiz, null);
    s = run(s, { type: 'lesson.draft.restore', draftId: draft.id, expectedVersion: draft.version, revisionId: revisions[0].id }, DEMO_ADMIN);
    assert.equal(s.lessonDrafts.at(-1)!.quiz!.questions.length, 3);
    assert.equal(quizOf(s, 'lesson_5').questions.length, 4, 'the live lesson changes only on publish');
});

test('an attempt keeps the quiz it answered after the author changes or removes the check', () => {
    let s = submit(createSeed(), 'lesson_5', lesson5Right).workspace;
    s = run(s, { type: 'lesson.draft.create', trackId: 'track_product', lessonId: 'lesson_5' }, DEMO_ADMIN);
    let draft = s.lessonDrafts.at(-1)!;
    s = run(s, { type: 'lesson.draft.save', draftId: draft.id, expectedVersion: draft.version, ...lessonContent(draft), quiz: null }, DEMO_ADMIN);
    draft = s.lessonDrafts.at(-1)!;
    s = run(s, { type: 'lesson.draft.publish', draftId: draft.id, expectedVersion: draft.version }, DEMO_ADMIN);
    const view = visibleWorkspace(s, ctx());
    assert.equal(view.lessons.find(l => l.id === 'lesson_5')!.quiz, null);
    assert.equal(view.quizAttempts.length, 1);
    assert.equal(view.quizAttempts[0].quiz.questions.length, 3);
    throwsCode(() => exec(s, { type: 'quiz.attempt.submit', lessonId: 'lesson_5', fingerprint: '00000000', answers: lesson5Right }), 'NOT_FOUND');
});

test('the seeded review queue is fictional and complete', () => {
    const s = createSeed(), waiting = s.quizAttempts.filter(a => a.status === 'awaiting_review');
    assert.deepEqual(waiting.map(a => [a.userId, a.lessonId, a.score, a.maxScore]), [['member_sofia', 'lesson_6', 1, 4]]);
    assert(s.enrolments.some(e => e.userId === 'member_sofia' && e.trackId === 'track_product'));
    assert.deepEqual(waiting[0].quiz, normaliseQuiz(quizOf(s, 'lesson_6')));
    assert.equal(createSeed('studio-north').quizAttempts.length, 0);
});
