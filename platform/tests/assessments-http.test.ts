import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { openDatabase, type Database } from '../packages/db/src/connection';
import { migrate } from '../packages/db/src/migrate';
import { WorkspaceRepository } from '../packages/db/src/repository';
import { createSeed, DEMO_ADMIN, DEMO_USER } from '../packages/domain/src/seed';
import { quizFingerprint, type LessonQuiz, type QuizAnswer } from '../packages/contracts/src/assessments';
import type { Workspace } from '../packages/contracts/src/index';
import { createApp } from '../apps/api/src/app';

const origin = 'https://reunir.test', base = '/api/organisations/code-black';
let db: Database, app: ReturnType<typeof createApp>;
let identity: { id: string; name: string } | null = null;
const as = (id: string | null) => { identity = id ? { id, name: id } : null; };
const post = (path: string, body: unknown, key: string = randomUUID(), at = base) => app.request(at + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, 'Idempotency-Key': key }, body: typeof body === 'string' ? body : JSON.stringify(body) });
const workspace = async (at = base): Promise<Workspace> => (await app.request(at + '/workspace')).json();
const quiz = async (lessonId: string) => (await workspace()).lessons.find(l => l.id === lessonId)!.quiz as LessonQuiz;
const right: QuizAnswer[] = [
    { questionId: 'q5_feedback', optionIds: ['a'], text: '' },
    { questionId: 'q5_essentials', optionIds: ['a', 'b'], text: '' },
    { questionId: 'q5_outcome', optionIds: [], text: 'Useful' },
];
const error = async (r: Response) => (await r.json()).error.code as string;

before(async () => {
    db = await openDatabase('pglite:memory'); await migrate(db);
    const repo = new WorkspaceRepository(db); await repo.seed(createSeed()); await repo.seed(createSeed('studio-north'));
    app = createApp({ repository: repo, origin, resolveSession: async () => identity });
});
after(async () => db?.close());

test('signed-out requests cannot read or answer a knowledge check', async () => {
    as(null);
    assert.equal((await app.request(base + '/workspace')).status, 401);
    assert.equal((await post('/commands', { type: 'quiz.attempt.submit', lessonId: 'lesson_5', fingerprint: '00000000', answers: right })).status, 401);
});

test('the workspace API sends members questions without answers and only their own attempts', async () => {
    as(DEMO_USER);
    const w = await workspace();
    const lessons = JSON.stringify(w.lessons);
    assert(lessons.includes('When you share a clickable prototype'));
    assert(!lessons.includes('acceptedAnswers') && !lessons.includes('"correct"') && !lessons.includes('Reviewers help most'), 'no keys or explanations');
    assert.deepEqual(w.quizAttempts, []);
    as('member_sofia');
    assert.deepEqual((await workspace()).quizAttempts.map(a => a.userId), ['member_sofia']);
});

test('a submission is validated, scored on the server and replayed safely', async () => {
    as(DEMO_USER);
    const fingerprint = quizFingerprint(await quiz('lesson_5'));
    let r = await post('/commands', { type: 'quiz.attempt.submit', lessonId: 'lesson_5', answers: right });
    assert.equal(r.status, 400); assert.equal(await error(r), 'VALIDATION');
    r = await post('/commands', { type: 'quiz.attempt.submit', lessonId: 'lesson_5', fingerprint, answers: right, score: 100 });
    assert.equal(r.status, 400, 'clients cannot send a score');
    r = await post('/commands', { type: 'quiz.attempt.submit', lessonId: 'lesson_5', fingerprint: '00000000', answers: right });
    assert.equal(r.status, 409); assert.equal(await error(r), 'STALE_QUIZ');
    const key = randomUUID();
    r = await post('/commands', { type: 'quiz.attempt.submit', lessonId: 'lesson_5', fingerprint, answers: right }, key);
    assert.equal(r.status, 200);
    const body = await r.json();
    assert.match(body.message, /You scored 4 of 4 \(100%\)\. You passed\./);
    r = await post('/commands', { type: 'quiz.attempt.submit', lessonId: 'lesson_5', fingerprint, answers: right }, key);
    assert.equal(r.status, 200, 'the same request key replays the original result');
    assert.equal((await workspace()).quizAttempts.length, 1, 'no second attempt was recorded');
    r = await post('/commands', { type: 'quiz.attempt.submit', lessonId: 'lesson_5', fingerprint, answers: [right[0]] }, key);
    assert.equal(r.status, 409); assert.equal(await error(r), 'KEY_REUSED');
});

test('oversized answers are refused before they reach the database', async () => {
    as(DEMO_USER);
    const fingerprint = quizFingerprint(await quiz('lesson_6'));
    const long = { type: 'quiz.attempt.submit', lessonId: 'lesson_6', fingerprint, answers: [{ questionId: 'q6_watch', optionIds: ['a'], text: '' }, { questionId: 'q6_change', optionIds: [], text: 'x'.repeat(2001) }] };
    const r = await post('/commands', long);
    assert.equal(r.status, 400); assert.equal(await error(r), 'VALIDATION');
    const huge = await post('/commands', JSON.stringify({ ...long, padding: 'x'.repeat(70 * 1024) }));
    assert.equal(huge.status, 413);
});

test('members cannot review, administrators can, and the learner reads the feedback through the API', async () => {
    as(DEMO_USER);
    let r = await post('/commands', { type: 'quiz.attempt.review', attemptId: 'attempt_sofia', expectedVersion: 1, marks: [{ questionId: 'q6_change', points: 3 }], feedback: 'Self-awarded' });
    assert.equal(r.status, 403); assert.equal(await error(r), 'REVIEWER_REQUIRED');
    as(DEMO_ADMIN);
    const queue = (await workspace()).quizAttempts.filter(a => a.status === 'awaiting_review');
    assert.deepEqual(queue.map(a => a.id), ['attempt_sofia']);
    r = await post('/commands', { type: 'quiz.attempt.review', attemptId: 'attempt_sofia', expectedVersion: 1, marks: [{ questionId: 'q6_change', points: 2 }], feedback: 'A clear observation. Next, say how you would know the change worked.' });
    assert.equal(r.status, 200);
    r = await post('/commands', { type: 'quiz.attempt.review', attemptId: 'attempt_sofia', expectedVersion: 1, marks: [{ questionId: 'q6_change', points: 3 }], feedback: 'Second opinion' });
    assert.equal(r.status, 409); assert.equal(await error(r), 'STALE_ATTEMPT');
    as('member_sofia');
    const mine = (await workspace()).quizAttempts[0];
    assert.deepEqual([mine.status, mine.score, mine.feedback], ['reviewed', 3, 'A clear observation. Next, say how you would know the change worked.']);
    assert(!JSON.stringify(mine.quiz).includes('"correct"'), 'this check never reveals its answers');
});

test('another community’s API cannot read or review these attempts', async () => {
    as(DEMO_ADMIN);
    const north = '/api/organisations/studio-north';
    assert.deepEqual((await workspace(north)).quizAttempts, []);
    const r = await post('/commands', { type: 'quiz.attempt.review', attemptId: 'attempt_sofia', expectedVersion: 2, marks: [{ questionId: 'q6_change', points: 1 }], feedback: 'Cross-tenant' }, randomUUID(), north);
    assert.equal(r.status, 404);
    as('member_sofia');
    assert.deepEqual((await workspace(north)).quizAttempts, [], 'the same person sees none of their Code Black attempts in Studio North');
    as(null);
    assert.equal((await app.request(north + '/workspace')).status, 401);
});
