/**
 * Live build, real HTTP, Better Auth cookies and a local PGlite database. The bucket is an in-process stand-in on a
 * separate origin with CORS: it enforces the policy-bound key, type and exact size, refuses cookies and serves bytes
 * only for the verified generation. Real Google Cloud Storage signing, IAM and bucket CORS are not exercised here.
 */
import { chromium, expect, type Download, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { build } from 'vite';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { openDatabase } from '../packages/db/src/connection';
import { migrate } from '../packages/db/src/migrate';
import { WorkspaceRepository } from '../packages/db/src/repository';
import { createAuth } from '../apps/api/src/auth';
import { createApp } from '../apps/api/src/app';
import type { PrivateStorage } from '../apps/api/src/storage';
import type { FileScanner } from '../apps/api/src/scanner';
import { ScanQueue } from '../packages/db/src/scans';
import { scanWaitingUploads } from '../apps/api/src/scan-worker';
import { uploadCompletion } from '../apps/api/src/uploads';
import { attachmentDisposition } from '../packages/contracts/src/lesson-resources';
import { answerConfirmations } from './ui-test-helpers';
const root = resolve(import.meta.dirname, '..'), dir = root + '/evidence/lesson-resources/connected'; await mkdir(dir, { recursive: true });
process.env.VITE_DATA_MODE = 'live';
await build({ configFile: root + '/apps/web/vite.config.ts', build: { outDir: root + '/.connected-dist', emptyOutDir: true }, logLevel: 'error' });
process.env.NODE_ENV = 'test';
const listen = async (fetch: (r: Request) => Response | Promise<Response>) => { const s = serve({ fetch, hostname: '127.0.0.1', port: 0 }); await new Promise<void>(r => s.listening ? r() : s.once('listening', r)); return { server: s, origin: 'http://127.0.0.1:' + (s.address() as { port: number }).port }; };
let handler: (r: Request) => Response | Promise<Response> = () => new Response('Starting', { status: 503 });
const appServer = await listen(r => handler(r)), origin = appServer.origin;

const objects = new Map<string, { bytes: Uint8Array<ArrayBuffer>; type: string; generation: string }>(), policies = new Map<string, { type: string; size: number; expires: number }>();
let nextGeneration = 1712345678900000, cookiesSeen = 0;
const cors = { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' };
const bucket = new Hono();
bucket.options('/upload', c => c.body(null, 204, { ...cors, 'Access-Control-Allow-Methods': 'POST' }));
bucket.post('/upload', async c => {
    if (c.req.header('cookie')) cookiesSeen++;
    const form = await c.req.parseBody(), key = String(form.key), policy = policies.get(key), file = form.file;
    if (!policy || !(file instanceof File) || form['Content-Type'] !== policy.type || file.size !== policy.size || Date.now() > policy.expires) return c.text('Policy rejected', 403, cors);
    objects.set(key, { bytes: new Uint8Array(await file.arrayBuffer()), type: policy.type, generation: String(++nextGeneration) });
    return c.body(null, 204, cors);
});
bucket.get('/download', c => {
    const o = objects.get(c.req.query('key') ?? '');
    if (!o || o.generation !== c.req.query('generation')) return c.text('No such object generation', 404);
    return new Response(o.bytes, { headers: { 'Content-Type': c.req.query('type') ?? 'application/octet-stream', 'Content-Disposition': c.req.query('disposition') ?? 'attachment', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
});
const bucketServer = await listen(bucket.fetch), bucketOrigin = bucketServer.origin;
const storage: PrivateStorage = {
    upload: async (key, contentType, sizeBytes) => { policies.set(key, { type: contentType, size: sizeBytes, expires: Date.now() + 5 * 60 * 1000 }); return { url: bucketOrigin + '/upload', fields: { key, 'Content-Type': contentType } }; },
    download: async (key, o = {}) => `${bucketOrigin}/download?${new URLSearchParams({ key, generation: o.generation ?? '', type: o.contentType ?? 'application/octet-stream', disposition: attachmentDisposition(o.filename ?? 'download') })}`,
    metadata: async key => { const o = objects.get(key); return o ? { size: o.bytes.length, contentType: o.type, generation: o.generation } : null; },
    head: async (key, bytes, generation) => { const o = objects.get(key); if (!o || o.generation !== generation) throw Object.assign(new Error('No such object generation'), { code: 404 }); return o.bytes.slice(0, bytes); },
    remove: async key => { objects.delete(key); },
};

const db = await openDatabase('pglite:memory'); await migrate(db); const repo = new WorkspaceRepository(db);
const secret = 'resources_connected_test_secret_5e1d0c9b8a7f6e5d4c', registrar = createAuth(db, origin, secret, true);
const person = async (name: string, email: string) => (await registrar.api.signUpEmail({ body: { name, email, password: 'Resource-test-password-123!' } })).user;
const owner = await person('Pilot Owner', 'owner@example.test'), learner = await person('Pilot Learner', 'learner@example.test'), outsider = await person('Other Owner', 'other@example.test');
await repo.createCommunity({ id: owner.id, name: owner.name }, 'pilot', 'Code Black Pilot');
await repo.addMembership('pilot', { id: learner.id, name: learner.name }, 'member');
await repo.createCommunity({ id: outsider.id, name: outsider.name }, 'elsewhere', 'Another Community');
const run = (cmd: unknown) => repo.execute('pilot', owner.id, cmd, randomUUID(), 'resources-connected');
const trackId = (await run({ type: 'track.create', title: 'Interviewing for real problems', summary: 'Plan and run a useful first conversation.', description: 'A short pilot track used by the connected file test.', category: 'Product building', spaceId: null })).objectId!;
const draftId = (await run({ type: 'lesson.draft.create', trackId })).objectId!;
await run({ type: 'lesson.draft.save', draftId, expectedVersion: 1, title: 'Plan your first interview', summary: 'Decide who to speak to and what to ask.', body: 'Choose one person with the problem.\n\nWrite three open questions.', minutes: 8, resourceUrl: '' });
const lessonId = (await run({ type: 'lesson.draft.publish', draftId, expectedVersion: 2 })).workspace.lessonDrafts[0].lessonId!;
const auth = createAuth(db, origin, secret);
const app = createApp({ repository: repo, origin, storage, authHandler: r => auth.handler(r), resolveSession: async headers => { const s = await auth.api.getSession({ headers }); return s ? { id: s.user.id, name: s.user.name } : null; } });
app.get('/assets/*', serveStatic({ root: '.connected-dist' })); app.get('/', serveStatic({ path: '.connected-dist/index.html' })); handler = app.fetch;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: true, args: ['--no-sandbox'] });
const contexts = await Promise.all([0, 1, 2, 3].map(() => browser.newContext({ viewport: { width: 1440, height: 960 }, acceptDownloads: true })));
const [ownerPage, learnerPage, outsiderPage, anonymousPage] = await Promise.all(contexts.map(c => c.newPage()));
const results: { name: string; passed: boolean }[] = [], errors: string[] = [];
for (const p of [ownerPage, learnerPage, outsiderPage, anonymousPage]) { p.setDefaultTimeout(10000); p.on('pageerror', e => errors.push(e.message)); await answerConfirmations(p); }
const check = async (name: string, fn: () => Promise<void>) => { await fn(); results.push({ name, passed: true }); console.log('PASS', name); };
const signIn = async (p: Page, email: string) => { await p.goto(origin); await p.getByLabel('Email', { exact: true }).fill(email); await p.getByLabel('Password', { exact: true }).fill('Resource-test-password-123!'); await p.getByRole('button', { name: 'Sign in', exact: true }).click(); await expect(p.locator('.topbar')).toBeVisible(); };
const editor = () => ownerPage.locator('.creator-editor');
const studio = async () => { await ownerPage.goto(`${origin}/#/learn/${trackId}/studio`); await ownerPage.locator('.creator-title').filter({ hasText: 'Plan your first interview' }).click(); await expect(editor()).toBeVisible(); };
const lessonView = async (p: Page) => { await p.goto(`${origin}/#/learn/${trackId}/${lessonId}`); await p.reload(); await expect(p.locator('.lesson-content h2')).toHaveText('Plan your first interview'); };
const add = async (name: string, buffer: Buffer) => { const [chooser] = await Promise.all([ownerPage.waitForEvent('filechooser'), editor().getByRole('button', { name: 'Add file', exact: true }).click()]); await chooser.setFiles({ name, mimeType: 'application/pdf', buffer }); };
const api = (p: Page, path: string) => p.request.get(`${origin}/api/organisations/pilot${path}`);
const PLAN = Buffer.from('%PDF-1.4\n% fictional connected interview plan\n');
let resourceId = '';
try {
    await check('the owner signs in to the live build with a real session', async () => { await signIn(ownerPage, 'owner@example.test'); await expect(ownerPage.locator('.app-footer')).toContainText('CONNECTED ALPHA'); });
    await check('a creator upload goes straight to the bucket under a server-chosen key, without cookies', async () => {
        await studio(); await add('Interview plan.pdf', PLAN);
        await expect(editor().locator('.resource-status')).toContainText('is ready');
        expect(objects.size).toBe(1); expect([...objects.keys()][0]).toMatch(new RegExp(`^organisations/[0-9a-f-]{36}/lesson-resources/${trackId}/[0-9a-f-]{36}\\.pdf$`));
        expect(cookiesSeen).toBe(0);
        const row = (await db.query<{ status: string; generation: string }>("SELECT status,generation FROM upload_intents WHERE purpose='lesson_resource'")).rows;
        expect(row).toEqual([{ status: 'ready', generation: [...objects.values()][0].generation }]);
    });
    await check('the saved draft file stays private from the learner', async () => {
        await editor().locator('.resource-row').first().getByLabel('File name shown to learners', { exact: true }).fill('Interview plan');
        await editor().getByRole('button', { name: 'Save draft', exact: true }).click(); await expect(editor()).toContainText('Saved privately');
        resourceId = (await db.query<{ resources: { id: string }[] }>('SELECT resources FROM lesson_drafts')).rows[0].resources[0].id;
        await signIn(learnerPage, 'learner@example.test'); await lessonView(learnerPage);
        await expect(learnerPage.locator('.lesson-resources')).toHaveCount(0);
        expect((await api(learnerPage, `/lesson-drafts/${draftId}/resources/${resourceId}/download`)).status()).toBe(404);
        expect((await api(learnerPage, `/lessons/${lessonId}/resources/${resourceId}/download`)).status()).toBe(404);
    });
    await check('after publication the learner downloads the exact bytes as an attachment', async () => {
        await editor().getByRole('button', { name: 'Publish saved lesson', exact: true }).click(); await expect(editor()).toContainText('matches the published lesson');
        await lessonView(learnerPage); await expect(learnerPage.locator('.lesson-resources')).toContainText('Interview plan');
        const [download] = await Promise.all([learnerPage.waitForEvent('download'), learnerPage.getByRole('button', { name: 'Download Interview plan', exact: true }).click()]) as [Download, unknown];
        expect(download.suggestedFilename()).toBe('Interview plan.pdf');
        expect(Buffer.compare(await readFile((await download.path())!), PLAN)).toBe(0);
        await expect(learnerPage.locator('.lesson-content h2')).toHaveText('Plan your first interview');
    });
    await check('the connected learner page with files passes automated accessibility checks', async () => {
        const a = await new AxeBuilder({ page: learnerPage }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
        await writeFile(dir + '/a11y-learner.json', JSON.stringify({ violations: a.violations }, null, 2)); expect(a.violations.map(v => v.id)).toEqual([]);
        await learnerPage.screenshot({ path: dir + '/connected-learner-files.png', fullPage: true });
    });
    await check('a disguised upload is rejected by the server and removed from the bucket', async () => {
        await studio(); await add('disguised.pdf', Buffer.from('<html><script>alert(1)</script></html>'));
        await expect(ownerPage.locator('.toast')).toContainText('does not match its declared type');
        expect(objects.size).toBe(1);
        expect((await db.query("SELECT status FROM upload_intents WHERE original_name='disguised.pdf'")).rows).toEqual([{ status: 'rejected' }]);
        await expect(editor().locator('.resource-row')).toHaveCount(1);
    });
    await check('other communities and anonymous visitors cannot obtain a download link', async () => {
        await signIn(outsiderPage, 'other@example.test');
        expect((await api(outsiderPage, `/lessons/${lessonId}/resources/${resourceId}/download`)).status()).toBe(404);
        expect((await api(anonymousPage, `/lessons/${lessonId}/resources/${resourceId}/download`)).status()).toBe(401);
        const link = await (await api(learnerPage, `/lessons/${lessonId}/resources/${resourceId}/download`)).json();
        expect(link.expiresIn).toBe(120); expect(new URL(link.url).origin).toBe(bucketOrigin);
    });
    await check('removing the file and republishing ends learner access while history keeps it', async () => {
        await editor().getByRole('button', { name: 'Remove Interview plan from the draft', exact: true }).click();
        await editor().getByRole('button', { name: 'Save draft', exact: true }).click(); await expect(editor()).toContainText('Saved privately');
        await editor().getByRole('button', { name: 'Publish saved lesson', exact: true }).click(); await expect(editor()).toContainText('matches the published lesson');
        expect((await api(learnerPage, `/lessons/${lessonId}/resources/${resourceId}/download`)).status()).toBe(404);
        const revision = (await db.query<{ id: string }>("SELECT id FROM lesson_revisions WHERE resources @> '[{\"name\":\"Interview plan\"}]'::jsonb")).rows[0].id;
        expect((await api(ownerPage, `/lesson-revisions/${revision}/resources/${resourceId}/download`)).status()).toBe(200);
        expect((await api(learnerPage, `/lesson-revisions/${revision}/resources/${resourceId}/download`)).status()).toBe(404);
        expect(objects.size).toBe(1);
    });
    await check('with scanning on, the editor waits while the scan worker checks a file, then attaches it; a flagged file is refused and deleted', async () => {
        // The scan worker runs beside the app, as `npm run scan:worker` would beside clamd, with a stand-in scanner.
        const queue = new ScanQueue(repo), MARK = 'REUNIR-TEST-FLAG';
        const scanner: FileScanner = { async scan(source) { const parts: Uint8Array[] = []; if (source instanceof Uint8Array) parts.push(source); else for await (const p of source.chunks) parts.push(p); return Buffer.concat(parts).includes(MARK) ? { clean: false, signature: 'Reunir.Test.Flag' } : { clean: true }; }, async ping() { return true; } };
        const scanning = createApp({ repository: repo, origin, storage, scans: queue, authHandler: r => auth.handler(r), resolveSession: async headers => { const s = await auth.api.getSession({ headers }); return s ? { id: s.user.id, name: s.user.name } : null; } });
        scanning.get('/assets/*', serveStatic({ root: '.connected-dist' })); scanning.get('/', serveStatic({ path: '.connected-dist/index.html' })); handler = scanning.fetch;
        const complete = uploadCompletion({ repository: repo, storage, scans: queue, remove: async (_, keys) => { for (const k of keys) objects.delete(k); } });
        let busy = false;
        const worker = setInterval(() => { if (busy) return; busy = true; void scanWaitingUploads({ queue, storage, scanner, complete, log: () => {} }).catch(() => {}).finally(() => { busy = false; }); }, 1500);
        try {
            await studio(); await add('Checked plan.pdf', Buffer.from('%PDF-1.4\n% fictional plan checked by the scan worker\n'));
            await expect(editor().locator('.resource-status')).toContainText('is ready', { timeout: 20000 });
            expect((await db.query("SELECT u.status,s.status AS scan FROM upload_intents u JOIN upload_scans s ON s.upload_id=u.id WHERE u.original_name='Checked plan.pdf'")).rows).toEqual([{ status: 'ready', scan: 'clean' }]);
            const before = objects.size;
            await add('Flagged plan.pdf', Buffer.from(`%PDF-1.4\n% ${MARK}\n`));
            await expect(ownerPage.locator('.toast')).toContainText('flagged by the virus scanner', { timeout: 20000 });
            expect((await db.query("SELECT status FROM upload_intents WHERE original_name='Flagged plan.pdf'")).rows).toEqual([{ status: 'rejected' }]);
            expect(objects.size).toBe(before);
        } finally { clearInterval(worker); handler = app.fetch; }
    });
    await check('the connected file journey produced no uncaught browser errors', async () => { expect(errors).toEqual([]); });
    await writeFile(dir + '/results.json', JSON.stringify({ generatedAt: new Date().toISOString(), method: 'Live Vite build + Hono HTTP + Better Auth cookies + local PGlite. In-process stand-in bucket on a second origin; no Google Cloud Storage, IAM or deployment.', results, errors }, null, 2));
    console.log(`${results.length} connected lesson resource checks passed`);
} catch (e) {
    await ownerPage.screenshot({ path: dir + '/failure-owner.png', fullPage: true }).catch(() => {}); await learnerPage.screenshot({ path: dir + '/failure-learner.png', fullPage: true }).catch(() => {});
    await writeFile(dir + '/results.json', JSON.stringify({ results, errors, failure: String(e) }, null, 2)); throw e;
} finally { await browser.close(); await new Promise<void>(r => appServer.server.close(() => r())); await new Promise<void>(r => bucketServer.server.close(() => r())); await db.close(); }
