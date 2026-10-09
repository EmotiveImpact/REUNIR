/**
 * Live build, real HTTP, Better Auth cookies and a local PGlite database: a knowledge check answered, scored on the
 * server, reviewed by the owner and re-answered after a concurrent edit. No hosted database or deployment is involved.
 */
import { chromium, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { build } from 'vite';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { openDatabase } from '../packages/db/src/connection';
import { migrate } from '../packages/db/src/migrate';
import { WorkspaceRepository } from '../packages/db/src/repository';
import { createAuth } from '../apps/api/src/auth';
import { createApp } from '../apps/api/src/app';
import { lessonContent } from '../packages/domain/src/authoring';
import type { AuthoredQuiz } from '../packages/contracts/src/assessments';
import { answerConfirmations } from './ui-test-helpers';
const root = resolve(import.meta.dirname, '..'), dir = root + '/evidence/knowledge-checks/connected'; await mkdir(dir, { recursive: true });
process.env.VITE_DATA_MODE = 'live';
await build({ configFile: root + '/apps/web/vite.config.ts', build: { outDir: root + '/.connected-dist', emptyOutDir: true }, logLevel: 'error' });
process.env.NODE_ENV = 'test';
let handler: (r: Request) => Response | Promise<Response> = () => new Response('Starting', { status: 503 });
const server = serve({ fetch: r => handler(r), hostname: '127.0.0.1', port: 0 });
await new Promise<void>(r => server.listening ? r() : server.once('listening', r));
const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;

const db = await openDatabase('pglite:memory'); await migrate(db); const repo = new WorkspaceRepository(db);
const secret = 'assessments_connected_test_secret_7c2e9f4a1b8d3e6f', registrar = createAuth(db, origin, secret, true);
const PASSWORD = 'Knowledge-check-password-123!';
const person = async (name: string, email: string) => (await registrar.api.signUpEmail({ body: { name, email, password: PASSWORD } })).user;
const owner = await person('Pilot Owner', 'owner@example.test'), learner = await person('Pilot Learner', 'learner@example.test'), outsider = await person('Other Owner', 'other@example.test');
await repo.createCommunity({ id: owner.id, name: owner.name }, 'pilot', 'Code Black Pilot');
await repo.addMembership('pilot', { id: learner.id, name: learner.name }, 'member');
await repo.createCommunity({ id: outsider.id, name: outsider.name }, 'elsewhere', 'Another Community');
const run = (cmd: unknown) => repo.execute('pilot', owner.id, cmd, randomUUID(), 'assessments-connected');
const quiz: AuthoredQuiz = { passPercentage: null, maxAttempts: null, revealAnswers: false, questions: [
    { id: 'q_watch', kind: 'single', prompt: 'What should you do while someone tries your prototype?', points: 1, options: [{ id: 'a', text: 'Watch quietly', correct: true }, { id: 'b', text: 'Explain every screen', correct: false }], acceptedAnswers: [], explanation: 'Silence shows you what they expect.' },
    { id: 'q_change', kind: 'written', prompt: 'Which change would you make first, and why?', points: 3, options: [], acceptedAnswers: [], explanation: '' },
] };
const trackId = (await run({ type: 'track.create', title: 'Testing a first version', summary: 'Watch someone use it, then improve one thing.', description: 'A short pilot track used by the connected knowledge-check test.', category: 'Product building', spaceId: null })).objectId!;
let draftId = (await run({ type: 'lesson.draft.create', trackId })).objectId!;
await run({ type: 'lesson.draft.save', draftId, expectedVersion: 1, title: 'Watch before you change', summary: 'Observe first, then choose one improvement.', body: 'Put the prototype in front of one person.\n\nWatch quietly and note where they pause.', minutes: 6, resourceUrl: '', quiz });
const lessonId = (await run({ type: 'lesson.draft.publish', draftId, expectedVersion: 2 })).workspace.lessonDrafts[0].lessonId!;
const auth = createAuth(db, origin, secret);
const app = createApp({ repository: repo, origin, authHandler: r => auth.handler(r), resolveSession: async headers => { const s = await auth.api.getSession({ headers }); return s ? { id: s.user.id, name: s.user.name } : null; } });
app.get('/assets/*', serveStatic({ root: '.connected-dist' })); app.get('/', serveStatic({ path: '.connected-dist/index.html' })); handler = app.fetch;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: true, args: ['--no-sandbox'] });
const contexts = await Promise.all([0, 1, 2, 3].map(() => browser.newContext({ viewport: { width: 1440, height: 960 } })));
const [ownerPage, learnerPage, outsiderPage, anonymousPage] = await Promise.all(contexts.map(c => c.newPage()));
const results: { name: string; passed: boolean }[] = [], errors: string[] = [];
for (const p of [ownerPage, learnerPage, outsiderPage, anonymousPage]) { p.setDefaultTimeout(10000); p.on('pageerror', e => errors.push(e.message)); await answerConfirmations(p); }
const check = async (name: string, fn: () => Promise<void>) => { await fn(); results.push({ name, passed: true }); console.log('PASS', name); };
const signIn = async (p: Page, email: string) => { await p.goto(origin); await p.getByLabel('Email', { exact: true }).fill(email); await p.getByLabel('Password', { exact: true }).fill(PASSWORD); await p.getByRole('button', { name: 'Sign in', exact: true }).click(); await expect(p.locator('.topbar')).toBeVisible(); };
const lessonView = async (p: Page) => { await p.goto(`${origin}/#/learn/${trackId}/${lessonId}`); await p.reload(); await expect(p.locator('.lesson-content h2')).toHaveText('Watch before you change'); };
const kc = () => learnerPage.locator('.lesson-content .knowledge-check');
const api = (p: Page, path: string) => p.request.get(`${origin}/api/organisations/pilot${path}`);
const attempts = async () => (await db.query<{ status: string; score: number; feedback: string }>('SELECT status,score,feedback FROM quiz_attempts ORDER BY attempt_number')).rows;
const WRITTEN = 'Fictional answer: autosave the form, because the tester lost their place twice.';
try {
    await check('owner and learner sign in to the live build with real sessions', async () => {
        await signIn(ownerPage, 'owner@example.test'); await signIn(learnerPage, 'learner@example.test');
        await expect(learnerPage.locator('.app-footer')).toContainText('CONNECTED ALPHA');
    });
    await check('the API gives the learner the questions without answers or explanations', async () => {
        const w = await (await api(learnerPage, '/workspace')).json();
        const lesson = JSON.stringify(w.lessons.find((l: { id: string }) => l.id === lessonId));
        expect(lesson).toContain('What should you do while someone tries your prototype?');
        for (const secret of ['"correct"', 'acceptedAnswers', 'Silence shows you']) expect(lesson).not.toContain(secret);
    });
    await check('the learner joins, answers and the server records an attempt awaiting review', async () => {
        await lessonView(learnerPage);
        await expect(kc()).toContainText('Join this track to answer the knowledge check.');
        await learnerPage.getByRole('button', { name: /Join this track/ }).click();
        await kc().getByRole('radio', { name: 'Watch quietly' }).check(); await kc().getByRole('textbox').fill(WRITTEN);
        await kc().getByRole('button', { name: 'Submit answers' }).click();
        await expect(learnerPage.locator('.toast')).toContainText('Submitted. A reviewer will mark your written answers');
        await expect(kc()).toContainText('Waiting for feedback');
        expect(await attempts()).toEqual([{ status: 'awaiting_review', score: 1, feedback: '' }]);
    });
    await check('members cannot review over HTTP; another community and anonymous visitors see nothing', async () => {
        const id = (await db.query<{ id: string }>('SELECT id FROM quiz_attempts')).rows[0].id;
        const review = { type: 'quiz.attempt.review', attemptId: id, expectedVersion: 1, marks: [{ questionId: 'q_change', points: 3 }], feedback: 'Self-awarded' };
        const forged = await learnerPage.request.post(`${origin}/api/organisations/pilot/commands`, { headers: { Origin: origin, 'Idempotency-Key': randomUUID() }, data: review });
        expect(forged.status()).toBe(403);
        await signIn(outsiderPage, 'other@example.test');
        expect((await api(outsiderPage, '/workspace')).status()).toBe(404); // The community is not revealed to non-members.
        expect((await api(anonymousPage, '/workspace')).status()).toBe(401);
        expect(await attempts()).toEqual([{ status: 'awaiting_review', score: 1, feedback: '' }]);
    });
    await check('the owner marks the answer in the review queue and the learner reads it', async () => {
        await ownerPage.goto(`${origin}/#/admin/knowledge-checks`); await ownerPage.reload();
        const card = ownerPage.locator('.quiz-review > .review-grid .quiz-review-card');
        await expect(card).toHaveCount(1); await expect(card).toContainText(WRITTEN);
        await card.getByRole('spinbutton').fill('2'); await card.getByRole('textbox').fill('Clear and observed. Next, say how you would test the change.');
        await card.getByRole('button', { name: 'Send marks and feedback' }).click();
        await expect(ownerPage.locator('.toast')).toContainText('Feedback sent.');
        expect(await attempts()).toEqual([{ status: 'reviewed', score: 3, feedback: 'Clear and observed. Next, say how you would test the change.' }]);
        await lessonView(learnerPage);
        await expect(kc()).toContainText('Feedback from Pilot Owner'); await expect(kc()).toContainText('Marked · 2 of 3 points');
        await expect(kc().locator('.quiz-correct')).toHaveCount(0);
    });
    await check('an edit published while the learner answers is detected, then the latest version is scored', async () => {
        await kc().getByRole('button', { name: 'Try again' }).click();
        await kc().getByRole('radio', { name: 'Watch quietly' }).check(); await kc().getByRole('textbox').fill(WRITTEN);
        // Another session publishes a reworded question meanwhile.
        draftId = (await run({ type: 'lesson.draft.create', trackId, lessonId })).objectId!;
        const draft = (await repo.snapshot('pilot', owner.id)).lessonDrafts.find(d => d.id === draftId)!;
        const edited = structuredClone(quiz); edited.questions[1].prompt = 'Which single change would you make first, and how would you test it?';
        await run({ type: 'lesson.draft.save', draftId, expectedVersion: draft.version, ...lessonContent(draft), quiz: edited });
        await run({ type: 'lesson.draft.publish', draftId, expectedVersion: draft.version + 1 });
        await kc().getByRole('button', { name: 'Submit answers' }).click();
        await expect(learnerPage.locator('.toast')).toContainText('This knowledge check changed after you opened it.');
        expect((await attempts()).length).toBe(1);
        await expect(kc()).toContainText('how would you test it?');
        await expect(kc().getByRole('textbox')).toHaveValue(WRITTEN);
        await kc().getByRole('button', { name: 'Submit answers' }).click();
        await expect(learnerPage.locator('.toast')).toContainText('Submitted.');
        const rows = await attempts(); expect(rows.length).toBe(2); expect(rows[1].status).toBe('awaiting_review');
        const stored = (await db.query<{ prompt: string }>("SELECT quiz->'questions'->1->>'prompt' AS prompt FROM quiz_attempts WHERE attempt_number=2")).rows[0].prompt;
        expect(stored).toBe('Which single change would you make first, and how would you test it?');
    });
    await check('the learner downloads their own learning record through the live API; nobody else can', async () => {
        await learnerPage.goto(`${origin}/#/profile`); await learnerPage.reload();
        await expect(learnerPage.getByRole('heading', { name: 'Your learning record' })).toBeVisible();
        const [download] = await Promise.all([learnerPage.waitForEvent('download'), learnerPage.getByRole('button', { name: 'Download your learning record', exact: true }).click()]);
        expect(download.suggestedFilename()).toMatch(/^reunir-learning-record-pilot-\d{4}-\d{2}-\d{2}\.json$/);
        const record = JSON.parse(await readFile((await download.path())!, 'utf8'));
        expect([record.format, record.member.name, record.community.slug]).toEqual(['reunir.learning-record', 'Pilot Learner', 'pilot']);
        expect(record.knowledgeChecks.map((a: { attempt: number; status: string }) => [a.attempt, a.status])).toEqual([[1, 'reviewed'], [2, 'awaiting_review']]);
        expect(record.knowledgeChecks[0]).toMatchObject({ lesson: 'Watch before you change', reviewedBy: 'Pilot Owner', feedback: 'Clear and observed. Next, say how you would test the change.' });
        expect(JSON.stringify(record)).not.toContain('acceptedAnswers');
        await expect(learnerPage.locator('.toast')).toContainText('Your learning record is downloading.');
        expect((await outsiderPage.request.get(`${origin}/api/organisations/pilot/me/learning-record`)).status()).toBe(404);
        expect((await anonymousPage.request.get(`${origin}/api/organisations/pilot/me/learning-record`)).status()).toBe(401);
    });
    await check('the connected learner page with a knowledge check passes automated accessibility checks', async () => {
        const a = await new AxeBuilder({ page: learnerPage }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
        await writeFile(dir + '/a11y-learner.json', JSON.stringify({ violations: a.violations }, null, 2)); expect(a.violations.map(v => v.id)).toEqual([]);
        await learnerPage.screenshot({ path: dir + '/connected-learner.png', fullPage: true });
    });
    await check('the connected knowledge-check journey produced no uncaught browser errors', async () => { expect(errors).toEqual([]); });
    await writeFile(dir + '/results.json', JSON.stringify({ generatedAt: new Date().toISOString(), method: 'Live Vite build + Hono HTTP + Better Auth cookies + local PGlite; no hosted database or deployment.', results, errors }, null, 2));
    console.log(`${results.length} connected knowledge-check checks passed`);
} catch (e) {
    await ownerPage.screenshot({ path: dir + '/failure-owner.png', fullPage: true }).catch(() => {}); await learnerPage.screenshot({ path: dir + '/failure-learner.png', fullPage: true }).catch(() => {});
    await writeFile(dir + '/results.json', JSON.stringify({ results, errors, failure: String(e) }, null, 2)); throw e;
} finally { await browser.close(); await new Promise<void>(r => server.close(() => r())); await db.close(); }
