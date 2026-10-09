import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Workspace } from '../packages/contracts/src/index';
import { learnerQuiz, lessonQuizSchema, partialPoints, quizFingerprint, scoreQuiz, type QuizAnswer, type QuizQuestion } from '../packages/contracts/src/assessments';
import { applyCommand, visibleWorkspace } from '../packages/domain/src/engine';
import { lessonContent } from '../packages/domain/src/authoring';
import { normaliseQuiz } from '../packages/domain/src/assessments';
import { createSeed, DEMO_ADMIN, DEMO_USER } from '../packages/domain/src/seed';

// Alpha 56: partial marks on multiple-choice questions (decision 056).
const ORG = 'org_code_black', NOW = '2026-10-09T12:00:00.000Z';
let seq = 0;
const ctx = (userId = DEMO_USER) => ({ organizationId: ORG, userId, requestId: 'partial_marks_test' });
const run = (s: Workspace, cmd: unknown, user = DEMO_USER) => applyCommand(s, ctx(user), cmd, () => NOW, () => `partial_${++seq}`);
const sixPoints: QuizQuestion = { id: 'q', kind: 'multiple', prompt: 'Which?', points: 6, partialCredit: true, options: [
    { id: 'a', text: 'A', correct: true }, { id: 'b', text: 'B', correct: true }, { id: 'c', text: 'C', correct: true }, { id: 'd', text: 'D', correct: false }, { id: 'e', text: 'E', correct: false }] };
const chose = (...ids: string[]) => new Set(ids);

test('partial marks: right options minus wrong ones, as a share of the right options, rounded down', () => {
    assert.equal(partialPoints(sixPoints, chose('a', 'b')), 4);
    assert.equal(partialPoints(sixPoints, chose('a', 'b', 'd')), 2);
    assert.equal(partialPoints(sixPoints, chose('a')), 2);
    assert.equal(partialPoints(sixPoints, chose('a', 'd', 'e')), 0, 'never below zero');
    assert.equal(partialPoints(sixPoints, chose('a', 'b', 'c', 'd', 'e')), 2, 'ticking everything is not a shortcut');
    assert.equal(partialPoints({ ...sixPoints, points: 1 }, chose('a', 'b')), 0, 'one point cannot be shared');
    const quiz = { questions: [sixPoints], passPercentage: 50, maxAttempts: null, revealAnswers: false };
    const answer = (...optionIds: string[]): QuizAnswer[] => [{ questionId: 'q', optionIds, text: '' }];
    assert.deepEqual(scoreQuiz(quiz, answer('a', 'b')).results, [{ questionId: 'q', correct: false, points: 4, maxPoints: 6 }]);
    assert.deepEqual(scoreQuiz(quiz, answer('a', 'b', 'c')).results, [{ questionId: 'q', correct: true, points: 6, maxPoints: 6 }]);
    assert.equal(scoreQuiz({ ...quiz, questions: [{ ...sixPoints, partialCredit: false }] }, answer('a', 'b')).autoScore, 0, 'off means the exact set');
});

test('only multiple-choice questions take partial marks, and older checks keep their fingerprints', () => {
    const single: QuizQuestion = { id: 's', kind: 'single', prompt: 'One?', points: 1, partialCredit: true, options: [{ id: 'a', text: 'A', correct: true }, { id: 'b', text: 'B', correct: false }], acceptedAnswers: [], explanation: '' };
    const parsed = lessonQuizSchema.safeParse({ questions: [single], passPercentage: null, maxAttempts: null, revealAnswers: false });
    assert.equal(parsed.success, false);
    assert(parsed.error!.issues.some(i => i.message === 'Only multiple-choice questions give partial marks.'));
    const seeded = createSeed().lessons.find(l => l.id === 'lesson_5')!.quiz!;
    const before = quizFingerprint(seeded);
    assert.equal(quizFingerprint(normaliseQuiz(seeded)!), before, 'normalising adds nothing to an older check');
    assert.equal(quizFingerprint({ ...seeded, questions: seeded.questions.map(q => ({ ...q, partialCredit: false })) }), before);
    const withPartial = { ...seeded, questions: seeded.questions.map(q => q.kind === 'multiple' ? { ...q, partialCredit: true } : q) };
    assert.notEqual(quizFingerprint(withPartial), before, 'learners see the rule, so a change to it is a change to the check');
    const seen = learnerQuiz(withPartial).questions.find(q => q.kind === 'multiple')!;
    assert.equal(seen.partialCredit, true);
    assert(seen.options.every(o => !('correct' in o)), 'still no answer key');
});

test('a learner who picks some of the right options earns part of the points on a published check', () => {
    let s = createSeed();
    s = run(s, { type: 'lesson.draft.create', trackId: 'track_product', lessonId: 'lesson_5' }, DEMO_ADMIN).workspace;
    let draft = s.lessonDrafts.at(-1)!;
    const quiz = normaliseQuiz(draft.quiz)!;
    quiz.questions = quiz.questions.map(q => q.kind === 'multiple' ? { ...q, partialCredit: true } : q);
    s = run(s, { type: 'lesson.draft.save', draftId: draft.id, expectedVersion: draft.version, ...lessonContent(draft), quiz }, DEMO_ADMIN).workspace;
    draft = s.lessonDrafts.at(-1)!;
    assert.equal(draft.quiz!.questions.find(q => q.id === 'q5_essentials')!.partialCredit, true, 'the setting is saved');
    s = run(s, { type: 'lesson.draft.publish', draftId: draft.id, expectedVersion: draft.version }, DEMO_ADMIN).workspace;
    s = run(s, { type: 'track.enrol', trackId: 'track_product' }).workspace;
    const seen = visibleWorkspace(s, ctx()).lessons.find(l => l.id === 'lesson_5')!.quiz!;
    // q5_essentials is worth 2 points with two right options; choosing one right option earns 1.
    const answers: QuizAnswer[] = [
        { questionId: 'q5_feedback', optionIds: ['a'], text: '' },
        { questionId: 'q5_essentials', optionIds: ['a'], text: '' },
        { questionId: 'q5_outcome', optionIds: [], text: 'useful' },
    ];
    const done = run(s, { type: 'quiz.attempt.submit', lessonId: 'lesson_5', fingerprint: quizFingerprint(seen), answers });
    const attempt = done.workspace.quizAttempts.at(-1)!;
    assert.deepEqual(attempt.results.find(r => r.questionId === 'q5_essentials'), { questionId: 'q5_essentials', correct: false, points: 1, maxPoints: 2 });
    assert.equal(attempt.score, attempt.maxScore - 1);
    assert.equal(attempt.quiz.questions.find(q => q.id === 'q5_essentials')!.partialCredit, true, 'the attempt keeps the rule it was marked by');
});
