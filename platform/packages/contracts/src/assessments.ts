import { z } from 'zod';

/** Knowledge checks: one optional quiz per lesson, authored in the lesson draft and scored on the server. */
export const MAX_QUIZ_QUESTIONS = 15;
export const MAX_QUIZ_OPTIONS = 6;
export const MAX_QUIZ_BYTES = 16000;
export const MAX_QUIZ_ATTEMPTS = 10;
export const MAX_WRITTEN_ANSWER = 2000;
export const MAX_SHORT_ANSWER = 120;
/** All answers in one attempt, as JSON. Keeps attempts well inside the request and storage limits. */
export const MAX_ANSWER_BYTES = 32000;

export type QuestionKind = 'single' | 'multiple' | 'short' | 'written';
export const questionKinds: Record<QuestionKind, string> = { single: 'Single choice', multiple: 'Multiple choice', short: 'Short answer', written: 'Written response' };
/** `correct`, `acceptedAnswers` and `explanation` are removed before a quiz reaches anyone but its authors. */
export interface QuizOption { id: string; text: string; correct?: boolean }
export interface QuizQuestion { id: string; kind: QuestionKind; prompt: string; points: number; options: QuizOption[]; acceptedAnswers?: string[]; explanation?: string }
export interface LessonQuiz { questions: QuizQuestion[]; passPercentage: number | null; maxAttempts: number | null; revealAnswers: boolean }
export interface QuizAnswer { questionId: string; optionIds: string[]; text: string }
/** `correct` and `points` stay null for written answers until a reviewer marks them. */
export interface QuizResult { questionId: string; correct: boolean | null; points: number | null; maxPoints: number }

const key = z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/);
const controls = /[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/;
const plain = (max: number, label: string) => z.string().trim().max(max, `Keep ${label} under ${max} characters.`).refine(v => !controls.test(v), `Use plain text for ${label}.`);
const option = z.object({ id: key, text: plain(150, 'options').pipe(z.string().min(1, 'Give every option some text.')), correct: z.boolean() }).strict();
const question = z.object({
    id: key, kind: z.enum(['single', 'multiple', 'short', 'written']),
    prompt: plain(300, 'questions').pipe(z.string().min(1, 'Write each question before saving.')),
    points: z.number().int().min(1).max(10),
    options: z.array(option).max(MAX_QUIZ_OPTIONS, `Use up to ${MAX_QUIZ_OPTIONS} options.`),
    acceptedAnswers: z.array(plain(MAX_SHORT_ANSWER, 'accepted answers').pipe(z.string().min(1, 'Fill in or remove each empty accepted answer.'))).max(10, 'Use up to 10 accepted answers.'),
    explanation: plain(300, 'explanations').default(''),
}).strict().superRefine((q, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: 'custom', message });
    if (q.kind === 'single' || q.kind === 'multiple') {
        const correct = q.options.filter(o => o.correct).length;
        if (q.options.length < 2) issue('Give each choice question at least two options.');
        if (q.kind === 'single' && correct !== 1) issue('Mark exactly one correct option for a single-choice question.');
        if (q.kind === 'multiple' && correct < 1) issue('Mark at least one correct option.');
        if (new Set(q.options.map(o => o.id)).size !== q.options.length) issue('Each option needs its own identifier.');
        if (new Set(q.options.map(o => normaliseAnswer(o.text))).size !== q.options.length) issue('Each option needs different text.');
        if (q.acceptedAnswers.length) issue('Choice questions do not take typed answers.');
    }
    else {
        if (q.options.length) issue('Only choice questions have options.');
        if (q.kind === 'short' && !q.acceptedAnswers.length) issue('Add at least one accepted answer for a short-answer question.');
        if (q.kind === 'written' && q.acceptedAnswers.length) issue('Written responses are marked by a reviewer, not matched.');
    }
});
export const lessonQuizSchema = z.object({
    questions: z.array(question).min(1, 'Add at least one question, or remove the knowledge check.').max(MAX_QUIZ_QUESTIONS, `Use up to ${MAX_QUIZ_QUESTIONS} questions.`),
    passPercentage: z.number().int().min(1).max(100).nullable(),
    maxAttempts: z.number().int().min(1).max(MAX_QUIZ_ATTEMPTS).nullable(),
    revealAnswers: z.boolean(),
}).strict().superRefine((quiz, ctx) => {
    if (new Set(quiz.questions.map(q => q.id)).size !== quiz.questions.length) ctx.addIssue({ code: 'custom', message: 'Each question needs its own identifier.' });
    if (new TextEncoder().encode(JSON.stringify(quiz)).length > MAX_QUIZ_BYTES) ctx.addIssue({ code: 'custom', message: 'This knowledge check is too long. Shorten or remove some questions.' });
});

/** A quiz as authors edit and save it: every option marked, every list present. */
export type AuthoredQuiz = z.output<typeof lessonQuizSchema>;

const answer = z.object({ questionId: key, optionIds: z.array(key).max(MAX_QUIZ_OPTIONS).default([]), text: z.string().max(MAX_WRITTEN_ANSWER, `Keep answers under ${MAX_WRITTEN_ANSWER} characters.`).default('') }).strict();
export const quizAnswersInput = z.array(answer).min(1).max(MAX_QUIZ_QUESTIONS)
    .refine(items => new Set(items.map(i => i.questionId)).size === items.length, 'Answer each question once.')
    .refine(items => new TextEncoder().encode(JSON.stringify(items)).length <= MAX_ANSWER_BYTES, 'These answers are too long. Shorten your written responses.');
export const quizMarksInput = z.array(z.object({ questionId: key, points: z.number().int().min(0).max(10) }).strict()).max(MAX_QUIZ_QUESTIONS);

/** Short answers match after Unicode, whitespace and case normalisation. No fuzzy matching. */
export function normaliseAnswer(value: string): string {
    return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-GB');
}
/** Learner view of a quiz: the same questions and options without anything that reveals the answers. */
export function learnerQuiz(quiz: LessonQuiz): LessonQuiz {
    return { ...quiz, questions: quiz.questions.map(q => ({ id: q.id, kind: q.kind, prompt: q.prompt, points: q.points, options: q.options.map(o => ({ id: o.id, text: o.text })) })) };
}
export const quizMaxScore = (quiz: LessonQuiz) => quiz.questions.reduce((total, q) => total + q.points, 0);
/** Deterministic server-side scoring. Choice questions need the exact set; written answers wait for a reviewer. */
export function scoreQuiz(quiz: LessonQuiz, answers: QuizAnswer[]): { results: QuizResult[]; autoScore: number; maxScore: number; needsReview: boolean } {
    const results = quiz.questions.map(q => {
        const given = answers.find(a => a.questionId === q.id) ?? { questionId: q.id, optionIds: [], text: '' };
        let correct: boolean | null = null;
        if (q.kind === 'single' || q.kind === 'multiple') {
            const expected = new Set(q.options.filter(o => o.correct).map(o => o.id)), chosen = new Set(given.optionIds);
            correct = expected.size === chosen.size && [...expected].every(id => chosen.has(id));
        }
        else if (q.kind === 'short') correct = !!given.text.trim() && (q.acceptedAnswers ?? []).some(a => normaliseAnswer(a) === normaliseAnswer(given.text));
        return { questionId: q.id, correct, points: correct === null ? null : correct ? q.points : 0, maxPoints: q.points };
    });
    return { results, autoScore: results.reduce((t, r) => t + (r.points ?? 0), 0), maxScore: quizMaxScore(quiz), needsReview: results.some(r => r.correct === null) };
}
/**
 * Short, stable fingerprint of everything a learner sees: settings, questions and options, never answers.
 * A submission carries the fingerprint it answered, so edits published meanwhile are detected rather than scored.
 */
export function quizFingerprint(quiz: LessonQuiz): string {
    const visible = [quiz.passPercentage, quiz.maxAttempts, quiz.revealAnswers, quiz.questions.map(q => [q.id, q.kind, q.prompt, q.points, q.options.map(o => [o.id, o.text])])];
    let hash = 0x811c9dc5;
    for (const byte of new TextEncoder().encode(JSON.stringify(visible))) hash = Math.imul(hash ^ byte, 0x01000193) >>> 0;
    return hash.toString(16).padStart(8, '0');
}
export const quizFingerprintInput = z.string().regex(/^[0-9a-f]{8}$/);
/** Floor, so a score never rounds up into a pass. */
export const quizPercentage = (score: number, maxScore: number) => maxScore > 0 ? Math.floor(score * 100 / maxScore) : 0;
