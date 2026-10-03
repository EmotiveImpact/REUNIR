/**
 * Live build, real HTTP and Better Auth cookies on a local PGlite database. Unlike the earlier connected checks, the API's
 * repository runs as the restricted `reunir_app` role with forced row security, so every screen here passes the same
 * database policies as production would. No hosted service, bucket or deployment is involved.
 */
import { chromium, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { build } from 'vite';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { openDatabase, type Database } from '../packages/db/src/connection';
import { migrate } from '../packages/db/src/migrate';
import { WorkspaceRepository } from '../packages/db/src/repository';
import { grantRuntimeTables } from '../packages/db/src/runtime-role';
import { createAuth } from '../apps/api/src/auth';
import { createApp } from '../apps/api/src/app';
import { quizFingerprint, type AuthoredQuiz } from '../packages/contracts/src/assessments';
const root = resolve(import.meta.dirname, '..'), dir = root + '/evidence/instructors/connected'; await mkdir(dir, { recursive: true });
process.env.VITE_DATA_MODE = 'live';
await build({ configFile: root + '/apps/web/vite.config.ts', build: { outDir: root + '/.connected-dist', emptyOutDir: true }, logLevel: 'error' });
process.env.NODE_ENV = 'test';
let handler: (r: Request) => Response | Promise<Response> = () => new Response('Starting', { status: 503 });
const server = serve({ fetch: r => handler(r), hostname: '127.0.0.1', port: 0 });
await new Promise<void>(r => server.listening ? r() : server.once('listening', r));
const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;

const db = await openDatabase('pglite:memory'); await migrate(db);
const setup = new WorkspaceRepository(db);
const secret = 'instructors_connected_test_secret_4b8e2d6f1a9c3e7d', registrar = createAuth(db, origin, secret, true);
const PASSWORD = 'Instructor-check-password-123!';
const person = async (name: string, email: string) => (await registrar.api.signUpEmail({ body: { name, email, password: PASSWORD } })).user;
const owner = await person('Pilot Owner', 'owner@example.test'), instructor = await person('Pilot Instructor', 'instructor@example.test'), learner = await person('Pilot Learner', 'learner@example.test');
await setup.createCommunity({ id: owner.id, name: owner.name }, 'pilot', 'Code Black Pilot');
await setup.addMembership('pilot', { id: instructor.id, name: instructor.name }, 'member');
await setup.addMembership('pilot', { id: learner.id, name: learner.name }, 'member');
// The API and these fixtures use the restricted runtime role; only migrations and accounts above ran as the owner.
await db.query('CREATE ROLE reunir_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS');
await db.transaction(grantRuntimeTables);
const runtime = Object.create(db) as Database;
runtime.transaction = fn => db.transaction(async tx => { await tx.query('SET LOCAL ROLE reunir_app'); return fn(tx); });
const repo = new WorkspaceRepository(runtime);
const run = (user: string, cmd: unknown) => repo.execute('pilot', user, cmd, randomUUID(), 'instructors-connected');
const quiz: AuthoredQuiz = { passPercentage: null, maxAttempts: null, revealAnswers: false, questions: [
    { id: 'q_change', kind: 'written', prompt: 'Which change would you make first, and why?', points: 3, options: [], acceptedAnswers: [], explanation: '' },
] };
const track = async (title: string) => (await run(owner.id, { type: 'track.create', title, summary: 'A short pilot track for the instructor check.', description: 'Fictional pilot content.', category: 'Product building', spaceId: null })).objectId!;
const taught = await track('Testing a first version'), other = await track('Brand basics');
const draftId = (await run(owner.id, { type: 'lesson.draft.create', trackId: taught })).objectId!;
await run(owner.id, { type: 'lesson.draft.save', draftId, expectedVersion: 1, title: 'Watch before you change', summary: 'Observe first, then choose one improvement.', body: 'Put the prototype in front of one person.\n\nWatch quietly and note where they pause.', minutes: 6, resourceUrl: '', quiz });
const lessonId = (await run(owner.id, { type: 'lesson.draft.publish', draftId, expectedVersion: 2 })).workspace.lessonDrafts[0].lessonId!;
await run(learner.id, { type: 'track.enrol', trackId: taught });
const seen = (await repo.snapshot('pilot', learner.id)).lessons.find(l => l.id === lessonId)!.quiz!;
await run(learner.id, { type: 'quiz.attempt.submit', lessonId, fingerprint: quizFingerprint(seen), answers: [{ questionId: 'q_change', optionIds: [], text: 'Autosave, because three of five people lost their work.' }] });
const auth = createAuth(db, origin, secret);
const app = createApp({ repository: repo, origin, authHandler: r => auth.handler(r), resolveSession: async headers => { const s = await auth.api.getSession({ headers }); return s ? { id: s.user.id, name: s.user.name } : null; } });
app.get('/assets/*', serveStatic({ root: '.connected-dist' })); app.get('/', serveStatic({ path: '.connected-dist/index.html' })); handler = app.fetch;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: true, args: ['--no-sandbox'] });
const contexts = await Promise.all([0, 1, 2].map(() => browser.newContext({ viewport: { width: 1440, height: 960 } })));
const [ownerPage, instructorPage, learnerPage] = await Promise.all(contexts.map(c => c.newPage()));
const results: { name: string; passed: boolean }[] = [], errors: string[] = [];
for (const p of [ownerPage, instructorPage, learnerPage]) { p.setDefaultTimeout(10000); p.on('pageerror', e => errors.push(e.message)); p.on('dialog', d => d.accept()); }
const check = async (name: string, fn: () => Promise<void>) => { await fn(); results.push({ name, passed: true }); console.log('PASS', name); };
const signIn = async (p: Page, email: string) => { await p.goto(origin); await p.getByLabel('Email', { exact: true }).fill(email); await p.getByLabel('Password', { exact: true }).fill(PASSWORD); await p.getByRole('button', { name: 'Sign in', exact: true }).click(); await expect(p.locator('.topbar')).toBeVisible(); };
const open = async (p: Page, path: string) => { await p.goto(`${origin}/#${path}`); await p.reload(); };
const command = (p: Page, body: unknown) => p.request.post(`${origin}/api/organisations/pilot/commands`, { headers: { 'Content-Type': 'application/json', Origin: origin, 'Idempotency-Key': randomUUID() }, data: body });
const grants = async () => (await db.query<{ track_id: string; user_id: string; granted_by: string }>('SELECT track_id,user_id,granted_by FROM track_instructors')).rows;
try {
    await check('the owner grants an instructor for one track from the live track page', async () => {
        await signIn(ownerPage, 'owner@example.test'); await open(ownerPage, `/learn/${taught}`);
        await ownerPage.getByRole('button', { name: 'Instructors', exact: true }).click();
        const dialog = ownerPage.locator('dialog[open]');
        await dialog.getByLabel('Add someone to teach').selectOption({ label: 'Pilot Instructor' });
        await dialog.getByRole('button', { name: 'Add', exact: true }).click();
        await expect(dialog.locator('.instructor-list li')).toContainText('Pilot Instructor');
        expect(await grants()).toEqual([{ track_id: taught, user_id: instructor.id, granted_by: owner.id }]);
    });
    await check('the instructor sees only their track on the teaching page, through forced row security', async () => {
        await signIn(instructorPage, 'instructor@example.test');
        await expect(instructorPage.locator('.sidebar a[href="#/teaching"]')).toBeVisible();
        await open(instructorPage, '/teaching');
        await expect(instructorPage.locator('.teaching-track')).toHaveCount(1);
        await expect(instructorPage.locator('.teaching-track')).toContainText('Testing a first version');
        await expect(instructorPage.locator('.teaching-track')).toContainText('1 waiting for feedback');
        const a = await new AxeBuilder({ page: instructorPage }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
        await writeFile(dir + '/a11y-teaching.json', JSON.stringify({ violations: a.violations }, null, 2)); expect(a.violations.map(v => v.id)).toEqual([]);
    });
    await check('the instructor marks the learner’s written answer, recorded in their own name', async () => {
        const card = instructorPage.locator('.quiz-review > .review-grid .quiz-review-card');
        await card.getByRole('spinbutton').fill('2');
        await card.getByRole('textbox').fill('A clear, observed change. Say who benefits first next time.');
        await card.getByRole('button', { name: 'Send marks and feedback' }).click();
        await expect(card).toHaveCount(0);
        expect((await db.query('SELECT status,score,reviewer_id FROM quiz_attempts')).rows).toEqual([{ status: 'reviewed', score: 2, reviewer_id: instructor.id }]);
    });
    await check('the instructor publishes a new lesson on their track and is refused the other track', async () => {
        await instructorPage.getByRole('link', { name: 'Open Creator studio for Testing a first version', exact: true }).click();
        await instructorPage.getByRole('button', { name: 'New lesson draft', exact: true }).click();
        const editor = instructorPage.locator('.creator-editor');
        await editor.getByLabel('Lesson title', { exact: true }).fill('Change one thing');
        await editor.getByLabel('Lesson summary', { exact: true }).fill('Make the single change your test pointed to.');
        await editor.getByLabel('Lesson body', { exact: true }).fill('Pick the strongest observation.\n\nChange one thing and test again.');
        await editor.getByRole('button', { name: 'Save draft', exact: true }).click(); await expect(editor).toContainText('Saved privately');
        await editor.getByRole('button', { name: 'Publish saved lesson', exact: true }).click(); await expect(editor).toContainText('matches the published lesson');
        expect((await db.query('SELECT count(*)::int AS n FROM lessons WHERE track_id=$1 AND published', [taught])).rows[0].n).toBe(2);
        expect((await command(instructorPage, { type: 'lesson.draft.create', trackId: other })).status()).toBe(404);
        expect((await command(learnerPage, { type: 'lesson.draft.create', trackId: taught })).status()).toBe(401);
        await signIn(learnerPage, 'learner@example.test');
        expect((await command(learnerPage, { type: 'lesson.draft.create', trackId: taught })).status()).toBe(403);
    });
    await check('revoking the grant closes the studio and teaching page at once', async () => {
        await open(ownerPage, `/learn/${taught}`);
        await ownerPage.getByRole('button', { name: 'Instructors', exact: true }).click();
        await ownerPage.locator('dialog[open]').getByRole('button', { name: 'Remove Pilot Instructor from this track', exact: true }).click();
        await expect(ownerPage.locator('dialog[open]')).toContainText('No instructors yet.');
        expect(await grants()).toEqual([]);
        await open(instructorPage, '/teaching');
        await expect(instructorPage.locator('.empty-state')).toContainText('Teaching opens when you are an instructor or contributor.');
        expect((await command(instructorPage, { type: 'lesson.draft.create', trackId: taught })).status()).toBe(403);
        expect((await (await instructorPage.request.get(`${origin}/api/organisations/pilot/workspace`)).json()).lessonDrafts).toEqual([]);
    });
    await check('the connected instructor journey produced no uncaught browser errors', async () => { expect(errors).toEqual([]); });
    await writeFile(dir + '/results.json', JSON.stringify({ generatedAt: new Date().toISOString(), method: 'Live Vite build + Hono HTTP + Better Auth cookies + local PGlite, API repository under the restricted reunir_app role with forced RLS. No hosted service.', results, errors }, null, 2));
    console.log(`${results.length} connected instructor checks passed`);
} catch (e) {
    for (const [name, p] of [['owner', ownerPage], ['instructor', instructorPage]] as const) await p.screenshot({ path: `${dir}/failure-${name}.png`, fullPage: true }).catch(() => {});
    await writeFile(dir + '/results.json', JSON.stringify({ results, errors, failure: String(e) }, null, 2)); throw e;
} finally { await browser.close(); await new Promise<void>(r => server.close(() => r())); await db.close(); }
