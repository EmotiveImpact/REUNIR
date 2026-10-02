import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { learnerQuiz, lessonQuizSchema, type AuthoredQuiz } from '../packages/contracts/src/assessments';
import type { QuizAttempt } from '../packages/contracts/src/index';
import { normaliseQuiz } from '../packages/domain/src/assessments';
import { createSeed } from '../packages/domain/src/seed';
import { AttemptView, QuizPreview, QuizQuestions, attemptStatus, hasAnswerKey, quizSummary } from '../apps/web/src/components/quiz-view';
import { QuizEditor, blankQuestion, convertQuestion, quizProblems } from '../apps/web/src/components/quiz-editor';

const seed = createSeed();
const lesson5 = normaliseQuiz(seed.lessons.find(l => l.id === 'lesson_5')!.quiz)!;
const sofia = seed.quizAttempts[0];
const attempt = (overrides: Partial<QuizAttempt> = {}): QuizAttempt => ({
    ...sofia, lessonId: 'lesson_5', quiz: lesson5, status: 'scored', passed: false, score: 1, maxScore: 4,
    answers: [{ questionId: 'q5_feedback', optionIds: ['b'], text: '' }, { questionId: 'q5_essentials', optionIds: ['a', 'b'], text: '' }, { questionId: 'q5_outcome', optionIds: [], text: 'pretty' }],
    results: [{ questionId: 'q5_feedback', correct: false, points: 0, maxPoints: 1 }, { questionId: 'q5_essentials', correct: true, points: 2, maxPoints: 2 }, { questionId: 'q5_outcome', correct: false, points: 0, maxPoints: 1 }],
    ...overrides,
});
const html = (element: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(element);

test('a locked attempt shows results per question but never the correct option, accepted answers or explanation', () => {
    const locked = attempt({ quiz: learnerQuiz(lesson5) });
    assert.equal(hasAnswerKey(locked.quiz), false);
    const markup = html(createElement(AttemptView, { attempt: locked, revealed: hasAnswerKey(locked.quiz) }));
    assert.match(markup, /Not correct · 0 of 1 point/);
    assert.match(markup, /Correct · 2 of 2 points/);
    assert.match(markup, /Your answer/);
    assert.doesNotMatch(markup, /Correct answer|Accepted answers|Reviewers help most/);
});

test('an unlocked attempt marks the correct options and shows explanations and accepted answers', () => {
    const markup = html(createElement(AttemptView, { attempt: attempt({ passed: true, score: 3 }), revealed: true }));
    assert.match(markup, /Correct answer/);
    assert.match(markup, /Accepted answers: useful/);
    assert.match(markup, /Reviewers help most when they know the question/);
    assert.match(markup, /3 of 4 points · 75%/);
});

test('waiting and reviewed attempts say so in words and show feedback with its reviewer', () => {
    assert.equal(attemptStatus(sofia), 'Waiting for feedback');
    const waiting = html(createElement(AttemptView, { attempt: sofia, revealed: false }));
    assert.match(waiting, /1 of 4 points so far/);
    assert.match(waiting, /Waiting for review · 3 points/);
    const reviewed = html(createElement(AttemptView, { attempt: { ...sofia, status: 'reviewed', score: 3, feedback: 'Specific and observed.', results: [sofia.results[0], { ...sofia.results[1], points: 2 }] }, revealed: false, reviewerName: 'Amina Okafor' }));
    assert.match(reviewed, /Feedback from Amina Okafor/);
    assert.match(reviewed, /Specific and observed\./);
    assert.match(reviewed, /Marked · 2 of 3 points/);
    assert.doesNotMatch(html(createElement(AttemptView, { attempt: sofia, revealed: false })), /Feedback/, 'no feedback block before review');
});

test('questions render as labelled, inert inputs in the preview', () => {
    const markup = html(createElement(QuizQuestions, { quiz: learnerQuiz(lesson5), name: 'preview', answers: {} }));
    assert.equal((markup.match(/<fieldset class="quiz-question" disabled="">/g) ?? []).length, 3);
    assert.equal((markup.match(/type="radio"/g) ?? []).length, 3);
    assert.equal((markup.match(/type="checkbox"/g) ?? []).length, 4);
    assert.match(markup, /aria-labelledby="preview-q5_outcome-prompt"/);
    const preview = html(createElement(QuizPreview, { quiz: lesson5, name: 'draft' }));
    assert.doesNotMatch(preview, /Reviewers help most|Accepted answers|quiz-correct|acceptedAnswers/, 'the preview shows the learners’ view, not the key');
    assert.match(quizSummary(lesson5, 1), /^3 questions · 4 points · Pass mark 75% · 2 of 3 attempts left$/);
});

test('the studio editor offers an optional check and explains every blocking problem', () => {
    assert.match(html(createElement(QuizEditor, { quiz: null, disabled: false, onChange: () => undefined })), /Add a knowledge check/);
    const draft: AuthoredQuiz = { questions: [blankQuestion('single')], passPercentage: null, maxAttempts: null, revealAnswers: true };
    assert.deepEqual(quizProblems(draft), ['Write each question before saving.', 'Give every option some text.']);
    draft.questions[0] = { ...draft.questions[0], prompt: 'Ready?', options: [{ id: 'a', text: 'Yes', correct: true }, { id: 'b', text: 'Not yet', correct: false }] };
    assert.deepEqual(quizProblems(draft), []);
    const editor = html(createElement(QuizEditor, { quiz: draft, disabled: false, onChange: () => undefined }));
    assert.match(editor, /Option 1 of question 1 is correct/);
    assert.doesNotMatch(editor, /Before you save/);
    assert.match(quizProblems({ ...draft, passPercentage: 120 })[0], /Set a pass mark from 1% to 100%/);
});

test('changing a question’s type keeps what still applies and stays valid once filled in', () => {
    const single = { ...blankQuestion('multiple'), prompt: 'Pick', options: [{ id: 'a', text: 'One', correct: true }, { id: 'b', text: 'Two', correct: true }] };
    const asSingle = convertQuestion(single, 'single');
    assert.deepEqual(asSingle.options.map(o => o.correct), [true, false], 'one correct answer remains');
    const asShort = convertQuestion(asSingle, 'short');
    assert.deepEqual([asShort.options, asShort.acceptedAnswers], [[], ['']]);
    const asWritten = convertQuestion({ ...asShort, acceptedAnswers: ['one'] }, 'written');
    assert.deepEqual(asWritten.acceptedAnswers, []);
    const back = convertQuestion(asWritten, 'multiple');
    assert.equal(back.options.length, 2);
    for (const q of [asSingle, { ...asShort, acceptedAnswers: ['one'] }, asWritten, { ...back, options: [{ id: 'a', text: 'A', correct: true }, { id: 'b', text: 'B', correct: false }] }])
        assert.equal(lessonQuizSchema.safeParse({ questions: [q], passPercentage: null, maxAttempts: null, revealAnswers: false }).success, true, q.kind);
});
