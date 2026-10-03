/**
 * Live build, real HTTP, Better Auth cookies and a local PGlite database, with the API under the restricted runtime role
 * and forced row security. The bucket is an in-process stand-in on a
 * separate origin with CORS: it enforces the policy-bound key, type and exact size, refuses cookies and returns bytes
 * only for the verified generation. Real Google Cloud Storage signing, IAM and bucket CORS are not exercised here.
 */
import { chromium, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { build } from 'vite';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { openDatabase, type Database } from '../packages/db/src/connection';
import { migrate } from '../packages/db/src/migrate';
import { WorkspaceRepository } from '../packages/db/src/repository';
import { grantRuntimeTables } from '../packages/db/src/runtime-role';
import { createAuth } from '../apps/api/src/auth';
import { createApp } from '../apps/api/src/app';
import type { PrivateStorage } from '../apps/api/src/storage';
import { imageDimensions } from '../packages/contracts/src/covers';
import { picture, withExif } from './cover-test-helpers';
const root = resolve(import.meta.dirname, '..'), dir = root + '/evidence/covers/connected'; await mkdir(dir, { recursive: true });
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
const bucketServer = await listen(bucket.fetch), bucketOrigin = bucketServer.origin;
const storage: PrivateStorage = {
    upload: async (key, contentType, sizeBytes) => { policies.set(key, { type: contentType, size: sizeBytes, expires: Date.now() + 5 * 60 * 1000 }); return { url: bucketOrigin + '/upload', fields: { key, 'Content-Type': contentType } }; },
    download: async () => { throw new Error('Covers are served by the application, never by a signed link.'); },
    metadata: async key => { const o = objects.get(key); return o ? { size: o.bytes.length, contentType: o.type, generation: o.generation } : null; },
    head: async (key, bytes, generation) => { const o = objects.get(key); if (!o || o.generation !== generation) throw Object.assign(new Error('No such object generation'), { code: 404 }); return o.bytes.slice(0, bytes); },
    remove: async key => { objects.delete(key); },
};

const db = await openDatabase('pglite:memory'); await migrate(db); const setup = new WorkspaceRepository(db);
const secret = 'covers_connected_test_secret_7f6e5d4c3b2a1908', registrar = createAuth(db, origin, secret, true);
const person = async (name: string, email: string) => (await registrar.api.signUpEmail({ body: { name, email, password: 'Cover-test-password-123!' } })).user;
const owner = await person('Pilot Owner', 'owner@example.test'), learner = await person('Pilot Learner', 'learner@example.test'), outsider = await person('Other Owner', 'other@example.test');
await setup.createCommunity({ id: owner.id, name: owner.name }, 'pilot', 'Code Black Pilot');
await setup.addMembership('pilot', { id: learner.id, name: learner.name }, 'member');
await setup.createCommunity({ id: outsider.id, name: outsider.name }, 'elsewhere', 'Another Community');
// The API and the fixtures below use the restricted runtime role with forced row security; only migrations and accounts ran as the owner.
await db.query('CREATE ROLE reunir_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS');
await db.transaction(grantRuntimeTables);
const runtime = Object.create(db) as Database;
runtime.transaction = fn => db.transaction(async tx => { await tx.query('SET LOCAL ROLE reunir_app'); return fn(tx); });
const repo = new WorkspaceRepository(runtime);
const run = (user: string, cmd: unknown) => repo.execute('pilot', user, cmd, randomUUID(), 'covers-connected');
const trackId = (await run(owner.id, { type: 'track.create', title: 'Interviewing for real problems', summary: 'Plan and run a useful first conversation.', description: 'A short pilot track used by the connected cover test.', category: 'Product building', spaceId: null })).objectId!;
const projectId = (await run(learner.id, { type: 'project.create', title: 'Night market zine', tagline: 'A small printed guide to the market.', summary: 'A fictional project used by the connected cover test.', category: 'Editorial', skills: ['Writing'], spaceId: null })).objectId!;
const auth = createAuth(db, origin, secret);
const app = createApp({ repository: repo, origin, storage, authHandler: r => auth.handler(r), resolveSession: async headers => { const s = await auth.api.getSession({ headers }); return s ? { id: s.user.id, name: s.user.name } : null; } });
app.get('/assets/*', serveStatic({ root: '.connected-dist' })); app.get('/', serveStatic({ path: '.connected-dist/index.html' })); handler = app.fetch;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: true, args: ['--no-sandbox'] });
const contexts = await Promise.all([0, 1, 2, 3].map(() => browser.newContext({ viewport: { width: 1440, height: 960 } })));
const [ownerPage, learnerPage, outsiderPage, anonymousPage] = await Promise.all(contexts.map(c => c.newPage()));
const results: { name: string; passed: boolean }[] = [], errors: string[] = [];
for (const p of [ownerPage, learnerPage, outsiderPage, anonymousPage]) { p.setDefaultTimeout(10000); p.on('pageerror', e => errors.push(e.message)); }
const check = async (name: string, fn: () => Promise<void>) => { await fn(); results.push({ name, passed: true }); console.log('PASS', name); };
const signIn = async (p: Page, email: string) => { await p.goto(origin); await p.getByLabel('Email', { exact: true }).fill(email); await p.getByLabel('Password', { exact: true }).fill('Cover-test-password-123!'); await p.getByRole('button', { name: 'Sign in', exact: true }).click(); await expect(p.locator('.topbar')).toBeVisible(); };
const open = async (p: Page, path: string) => { await p.goto(`${origin}/#${path}`); await p.reload(); };
const dialog = (p: Page) => p.locator('dialog[open]');
async function upload(p: Page, file: { name: string; mimeType: string; buffer: Buffer }, focus?: [number, number]) {
    await p.getByRole('button', { name: /^(Add a|Change) cover$/ }).click();
    const [chooser] = await Promise.all([p.waitForEvent('filechooser'), dialog(p).getByRole('button', { name: /^Choose (an|another) image$/ }).click()]);
    await chooser.setFiles(file);
    await expect(dialog(p).locator('.cover-editor-status')).toContainText('Ready');
    if (focus) { await dialog(p).getByLabel('Left to right', { exact: true }).fill(String(focus[0])); await dialog(p).getByLabel('Top to bottom', { exact: true }).fill(String(focus[1])); }
    await dialog(p).getByRole('button', { name: 'Save cover', exact: true }).click(); await expect(dialog(p)).toHaveCount(0);
}
const coverRoute = (kind: 'track' | 'project', id: string, fileId: string) => `/api/organisations/pilot/covers/${kind}/${id}/${fileId}`;
const loaded = (p: Page, selector: string) => p.locator(selector).evaluate(async (img: HTMLImageElement) => { await img.decode(); return { width: img.naturalWidth, src: img.getAttribute('src'), position: getComputedStyle(img).objectPosition }; });
const coverOf = async (table: 'tracks' | 'projects', id: string) => (await db.query<{ cover_image: { fileId: string; contentType: string; sizeBytes: number; focusX: number; focusY: number } | null }>(`SELECT cover_image FROM ${table} WHERE id=$1`, [id])).rows[0].cover_image;
const MOUNTAIN = await readFile(root + '/apps/web/src/assets/community-mountain.jpg');
let trackCover = '';
try {
    await check('the owner signs in to the live build, which reports cover uploads as available', async () => {
        await signIn(ownerPage, 'owner@example.test'); await expect(ownerPage.locator('.app-footer')).toContainText('CONNECTED ALPHA');
        expect((await (await ownerPage.request.get(origin + '/api/account/capabilities')).json()).coverUploads).toBe(true);
    });
    await check('a track cover goes straight to the bucket under a server-chosen key, resized, without cookies or photo metadata', async () => {
        await open(ownerPage, `/learn/${trackId}`);
        await expect(ownerPage.locator('.track-detail-cover .cover-media')).toHaveClass(/cover-plain/);
        await upload(ownerPage, { name: 'trip.jpg', mimeType: 'image/jpeg', buffer: withExif(MOUNTAIN, 'REUNIR-PRIVATE-LOCATION') }, [35, 60]);
        await expect(ownerPage.locator('.toast')).toContainText('Cover saved.');
        expect(objects.size).toBe(1); expect(cookiesSeen).toBe(0);
        const [key, object] = [...objects.entries()][0];
        expect(key).toMatch(new RegExp(`^organisations/[0-9a-f-]{36}/covers/tracks/${trackId}/[0-9a-f-]{36}\\.jpg$`));
        expect(object.type).toBe('image/jpeg'); expect(imageDimensions('image/jpeg', object.bytes)).toEqual({ width: 440, height: 310 });
        expect(Buffer.from(object.bytes).includes('REUNIR-PRIVATE-LOCATION')).toBe(false);
        const cover = (await coverOf('tracks', trackId))!; trackCover = cover.fileId;
        expect(cover).toEqual({ fileId: cover.fileId, contentType: 'image/jpeg', sizeBytes: object.bytes.length, focusX: 35, focusY: 60 });
        expect((await db.query("SELECT status,generation FROM upload_intents WHERE purpose='cover_image'")).rows).toEqual([{ status: 'ready', generation: object.generation }]);
        expect(await loaded(ownerPage, '.track-detail-cover img')).toEqual({ width: 440, src: coverRoute('track', trackId, cover.fileId), position: '35% 60%' });
    });
    await check('a member sees the cover through the access-checked route, privately cached, with no edit control', async () => {
        await signIn(learnerPage, 'learner@example.test'); await open(learnerPage, '/learn');
        // A picture no wider than a card has no small copy: the card asks for one and is served the picture itself.
        expect(await loaded(learnerPage, `.track-card[href="#/learn/${trackId}"] .cover-media img`)).toEqual({ width: 440, src: coverRoute('track', trackId, trackCover) + '/thumbnail', position: '35% 60%' });
        const r = await learnerPage.request.get(origin + coverRoute('track', trackId, trackCover));
        expect(r.status()).toBe(200);
        expect([r.headers()['content-type'], r.headers()['cache-control'], r.headers()['x-content-type-options'], r.headers()['content-disposition']]).toEqual(['image/jpeg', 'private, max-age=3600', 'nosniff', 'inline']);
        expect(r.headers()['content-security-policy']).toContain('sandbox');
        expect(Buffer.compare(await r.body(), Buffer.from([...objects.values()][0].bytes))).toBe(0);
        await open(learnerPage, `/learn/${trackId}`); await expect(learnerPage.locator('.track-detail-head h1')).toBeVisible();
        await expect(learnerPage.getByRole('button', { name: /cover/i })).toHaveCount(0);
    });
    await check('the learner pages with a cover pass automated accessibility checks', async () => {
        const a = await new AxeBuilder({ page: learnerPage }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
        await writeFile(dir + '/a11y-learner.json', JSON.stringify({ violations: a.violations }, null, 2)); expect(a.violations.map(v => v.id)).toEqual([]);
        await learnerPage.screenshot({ path: dir + '/connected-learner-track.png' });
    });
    await check('a member who owns a project sets its cover; the owner sees it, and the member cannot change a track', async () => {
        await open(learnerPage, `/projects/${projectId}`);
        await upload(learnerPage, { name: 'mountain.jpg', mimeType: 'image/jpeg', buffer: MOUNTAIN });
        const cover = (await coverOf('projects', projectId))!;
        expect([...objects.keys()].filter(k => k.includes(`/covers/projects/${projectId}/${cover.fileId}.jpg`))).toHaveLength(1);
        await open(ownerPage, `/projects/${projectId}`);
        expect((await loaded(ownerPage, '.project-detail-cover img')).src).toBe(coverRoute('project', projectId, cover.fileId));
        const denied = await learnerPage.request.post(origin + '/api/organisations/pilot/commands', { headers: { 'Content-Type': 'application/json', Origin: origin, 'Idempotency-Key': randomUUID() }, data: { type: 'track.cover.set', trackId, fileId: null } });
        expect(denied.status()).toBe(403); expect((await denied.json()).error.code).toBe('COVER_EDITOR_REQUIRED');
    });
    await check('an unreadable file is refused in the browser and nothing reaches the bucket', async () => {
        const before = objects.size;
        await open(ownerPage, `/learn/${trackId}`); await ownerPage.getByRole('button', { name: 'Change cover', exact: true }).click();
        const [chooser] = await Promise.all([ownerPage.waitForEvent('filechooser'), dialog(ownerPage).getByRole('button', { name: 'Choose another image', exact: true }).click()]);
        await chooser.setFiles({ name: 'notes.png', mimeType: 'image/png', buffer: Buffer.from('<html><script>alert(1)</script></html>') });
        await expect(dialog(ownerPage).getByRole('alert')).toContainText('could not be read as an image');
        await dialog(ownerPage).getByRole('button', { name: 'Cancel', exact: true }).click();
        expect(objects.size).toBe(before); expect((await db.query("SELECT count(*)::int AS n FROM upload_intents WHERE purpose='cover_image'")).rows[0].n).toBe(2);
    });
    await check('other communities and anonymous visitors cannot read a cover; an unpublished track hides it from members', async () => {
        await signIn(outsiderPage, 'other@example.test');
        expect((await outsiderPage.request.get(origin + coverRoute('track', trackId, trackCover))).status()).toBe(404);
        expect((await outsiderPage.request.get(origin + coverRoute('track', trackId, trackCover).replace('/pilot/', '/elsewhere/'))).status()).toBe(404);
        expect((await anonymousPage.request.get(origin + coverRoute('track', trackId, trackCover))).status()).toBe(401);
        await db.query('UPDATE tracks SET published=false WHERE id=$1', [trackId]);
        try {
            expect((await learnerPage.request.get(origin + coverRoute('track', trackId, trackCover))).status()).toBe(404);
            expect((await ownerPage.request.get(origin + coverRoute('track', trackId, trackCover))).status()).toBe(200);
        } finally { await db.query('UPDATE tracks SET published=true WHERE id=$1', [trackId]); }
    });
    await check('removing the cover ends access to its bytes and brings back the plain panel', async () => {
        await open(ownerPage, `/learn/${trackId}`); await ownerPage.getByRole('button', { name: 'Change cover', exact: true }).click();
        await dialog(ownerPage).getByRole('button', { name: 'Remove cover', exact: true }).click(); await expect(dialog(ownerPage)).toHaveCount(0);
        await expect(ownerPage.locator('.track-detail-cover .cover-media')).toHaveClass(/cover-plain/);
        expect(await coverOf('tracks', trackId)).toBeNull();
        expect((await learnerPage.request.get(origin + coverRoute('track', trackId, trackCover))).status()).toBe(404);
        await open(learnerPage, '/learn'); await expect(learnerPage.locator(`.track-card[href="#/learn/${trackId}"] .cover-media`)).toHaveClass(/cover-plain/);
    });
    await check('a large cover uploads a verified small copy beside it; cards load the copy and the track page the picture', async () => {
        await open(ownerPage, `/learn/${trackId}`);
        const before = new Set(objects.keys());
        await upload(ownerPage, { name: 'wide.jpg', mimeType: 'image/jpeg', buffer: await picture(ownerPage, 'image/jpeg', 2400, 1200) });
        const added = [...objects.keys()].filter(k => !before.has(k)), cover = (await coverOf('tracks', trackId))!;
        expect(added).toHaveLength(2);
        const thumbKey = added.find(k => k.endsWith(`/covers/tracks/${trackId}/${cover.fileId}-thumb.webp`))!, fullKey = added.find(k => k.endsWith(`/covers/tracks/${trackId}/${cover.fileId}.jpg`))!;
        expect([thumbKey, fullKey].every(Boolean)).toBe(true);
        expect(imageDimensions('image/webp', objects.get(thumbKey)!.bytes)).toEqual({ width: 480, height: 240 });
        expect(imageDimensions('image/jpeg', objects.get(fullKey)!.bytes)).toEqual({ width: 1600, height: 800 });
        expect(cookiesSeen).toBe(0);
        expect((await db.query('SELECT thumbnail_content_type,thumbnail_size_bytes,thumbnail_generation FROM upload_intents WHERE id=$1', [cover.fileId])).rows).toEqual([{ thumbnail_content_type: 'image/webp', thumbnail_size_bytes: objects.get(thumbKey)!.bytes.length, thumbnail_generation: objects.get(thumbKey)!.generation }]);
        expect(await loaded(ownerPage, '.track-detail-cover img')).toMatchObject({ width: 1600, src: coverRoute('track', trackId, cover.fileId) });
        await open(learnerPage, '/learn');
        expect(await loaded(learnerPage, `.track-card[href="#/learn/${trackId}"] .cover-media img`)).toMatchObject({ width: 480, src: coverRoute('track', trackId, cover.fileId) + '/thumbnail' });
        const small = await learnerPage.request.get(origin + coverRoute('track', trackId, cover.fileId) + '/thumbnail');
        expect([small.status(), small.headers()['content-type'], small.headers()['cache-control'], small.headers()['x-content-type-options']]).toEqual([200, 'image/webp', 'private, max-age=3600', 'nosniff']);
        expect(Buffer.compare(await small.body(), Buffer.from(objects.get(thumbKey)!.bytes))).toBe(0);
        expect((await outsiderPage.request.get(origin + coverRoute('track', trackId, cover.fileId) + '/thumbnail')).status()).toBe(404);
        expect((await anonymousPage.request.get(origin + coverRoute('track', trackId, cover.fileId) + '/thumbnail')).status()).toBe(401);
        await ownerPage.getByRole('button', { name: 'Change cover', exact: true }).click();
        await dialog(ownerPage).getByRole('button', { name: 'Remove cover', exact: true }).click(); await expect(dialog(ownerPage)).toHaveCount(0);
        expect(objects.has(thumbKey) || objects.has(fullKey)).toBe(false);
        expect((await learnerPage.request.get(origin + coverRoute('track', trackId, cover.fileId) + '/thumbnail')).status()).toBe(404);
    });
    const libraryRoute = (itemId: string) => `/api/organisations/pilot/cover-library/${itemId}`;
    const send = (p: Page, path: string, data: unknown) => p.request.post(origin + path, { headers: { 'Content-Type': 'application/json', Origin: origin, 'Idempotency-Key': randomUUID() }, data });
    let libraryItem = '', libraryFile = '', libraryKey = '', libraryThumbKey = '';
    await check('the owner adds a picture to the cover library in Community settings; it reaches the bucket under the community key', async () => {
        await open(ownerPage, '/settings');
        const section = ownerPage.locator('.cover-library-settings');
        await expect(section.locator('.cover-library-empty')).toBeVisible();
        await section.getByRole('button', { name: 'Add a picture', exact: true }).click();
        const [chooser] = await Promise.all([ownerPage.waitForEvent('filechooser'), dialog(ownerPage).getByRole('button', { name: 'Choose an image', exact: true }).click()]);
        await chooser.setFiles({ name: 'harbour.jpg', mimeType: 'image/jpeg', buffer: withExif(await picture(ownerPage, 'image/jpeg', 1200, 800), 'REUNIR-PRIVATE-LOCATION') });
        await expect(dialog(ownerPage).locator('.cover-editor-status')).toContainText('Ready');
        await dialog(ownerPage).getByLabel('Name', { exact: true }).fill('Quiet harbour');
        await dialog(ownerPage).getByLabel('Tags', { exact: true }).fill('Harbour, sea');
        await dialog(ownerPage).getByRole('button', { name: 'Add to library', exact: true }).click(); await expect(dialog(ownerPage)).toHaveCount(0);
        await expect(ownerPage.locator('.toast')).toContainText('Quiet harbour is in the cover library.');
        const row = (await db.query<{ id: string; file_id: string; label: string; added_by: string; tags: string[] }>('SELECT id,file_id,label,added_by,tags FROM cover_library')).rows;
        expect(row.map(r => [r.label, r.added_by, r.tags])).toEqual([['Quiet harbour', owner.id, ['harbour', 'sea']]]);
        [libraryItem, libraryFile] = [row[0].id, row[0].file_id];
        libraryKey = [...objects.keys()].find(k => k.includes('/covers/library/') && k.endsWith(`${libraryFile}.jpg`))!;
        libraryThumbKey = [...objects.keys()].find(k => k.includes('/covers/library/') && k.endsWith(`${libraryFile}-thumb.webp`))!;
        expect(libraryKey).toMatch(new RegExp(`^organisations/[0-9a-f-]{36}/covers/library/${libraryFile}\\.jpg$`));
        expect(imageDimensions('image/webp', objects.get(libraryThumbKey)!.bytes)).toEqual({ width: 480, height: 320 });
        expect(Buffer.from(objects.get(libraryKey)!.bytes).includes('REUNIR-PRIVATE-LOCATION')).toBe(false); expect(cookiesSeen).toBe(0);
        expect(await loaded(ownerPage, '.cover-library-list img')).toMatchObject({ width: 480, src: libraryRoute(libraryItem) + '/thumbnail' });
        const a = await new AxeBuilder({ page: ownerPage }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
        expect(a.violations.map(v => v.id)).toEqual([]);
        await section.screenshot({ path: dir + '/connected-library-settings.png' });
    });
    await check('a member who owns a project chooses the library picture; it is served through the project and the library', async () => {
        await open(learnerPage, `/projects/${projectId}`);
        await learnerPage.getByRole('button', { name: 'Change cover', exact: true }).click();
        await dialog(learnerPage).getByLabel('Community library', { exact: true }).check();
        await dialog(learnerPage).getByLabel('Quiet harbour', { exact: true }).check();
        await dialog(learnerPage).getByLabel('Top to bottom', { exact: true }).fill('30');
        const a = await new AxeBuilder({ page: learnerPage }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
        expect(a.violations.map(v => v.id)).toEqual([]);
        await dialog(learnerPage).getByRole('button', { name: 'Save cover', exact: true }).click(); await expect(dialog(learnerPage)).toHaveCount(0);
        expect(await coverOf('projects', projectId)).toEqual({ fileId: libraryFile, contentType: 'image/jpeg', sizeBytes: objects.get(libraryKey)!.bytes.length, focusX: 50, focusY: 30 });
        await open(ownerPage, `/projects/${projectId}`);
        expect(await loaded(ownerPage, '.project-detail-cover img')).toEqual({ width: 1200, src: coverRoute('project', projectId, libraryFile), position: '50% 30%' });
        const r = await learnerPage.request.get(origin + libraryRoute(libraryItem));
        expect([r.status(), r.headers()['content-type'], r.headers()['cache-control'], r.headers()['x-content-type-options']]).toEqual([200, 'image/jpeg', 'private, max-age=3600', 'nosniff']);
        expect(Buffer.compare(await r.body(), Buffer.from(objects.get(libraryKey)!.bytes))).toBe(0);
    });
    await check('the owner renames and retags the picture; members cannot, and the picker filters by tag', async () => {
        await open(ownerPage, '/settings');
        await ownerPage.getByRole('button', { name: 'Edit the name and tags of Quiet harbour', exact: true }).click();
        await dialog(ownerPage).getByLabel('Name', { exact: true }).fill('Still harbour');
        await dialog(ownerPage).getByLabel('Tags', { exact: true }).fill('Water, harbour');
        await dialog(ownerPage).getByRole('button', { name: 'Save changes', exact: true }).click(); await expect(dialog(ownerPage)).toHaveCount(0);
        await expect(ownerPage.locator('.toast')).toContainText('Still harbour is saved.');
        expect((await db.query('SELECT label,tags,file_id FROM cover_library WHERE id=$1', [libraryItem])).rows).toEqual([{ label: 'Still harbour', tags: ['water', 'harbour'], file_id: libraryFile }]);
        expect((await db.query<{ action: string }>('SELECT action FROM audit WHERE object_id=$1', [libraryItem])).rows.map(r => r.action)).toContain('cover.library.updated');
        const member = await send(learnerPage, `${libraryRoute(libraryItem)}/details`, { label: 'Mine', tags: [] });
        expect(member.status()).toBe(403); expect((await member.json()).error.code).toBe('ADMIN_REQUIRED');
        const outsider = await send(outsiderPage, `${libraryRoute(libraryItem)}/details`.replace('/pilot/', '/elsewhere/'), { label: 'Taken', tags: [] });
        expect(outsider.status()).toBe(404);
        await open(learnerPage, `/projects/${projectId}`);
        await learnerPage.getByRole('button', { name: 'Change cover', exact: true }).click();
        const picker = dialog(learnerPage).locator('.cover-library-picker');
        await expect(picker.getByLabel('Still harbour', { exact: true })).toBeChecked();
        await picker.getByRole('button', { name: 'water', exact: true }).click();
        await expect(picker.locator('.cover-library-option')).toHaveCount(1);
        await picker.getByLabel('Find a picture', { exact: true }).fill('forest');
        await expect(picker).toContainText('No pictures match.');
        const a = await new AxeBuilder({ page: learnerPage }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
        expect(a.violations.map(v => v.id)).toEqual([]);
        await dialog(learnerPage).getByRole('button', { name: 'Cancel', exact: true }).click();
        expect((await coverOf('projects', projectId))!.fileId).toBe(libraryFile);
    });
    await check('members cannot add library pictures; other communities and anonymous visitors cannot read them', async () => {
        const denied = await send(learnerPage, '/api/organisations/pilot/uploads', { purpose: 'cover_library', contentType: 'image/jpeg', sizeBytes: 9000 });
        expect(denied.status()).toBe(403); expect((await denied.json()).error.code).toBe('ADMIN_REQUIRED');
        await open(learnerPage, '/settings'); await expect(learnerPage.locator('.cover-library-settings')).toHaveCount(0);
        expect((await outsiderPage.request.get(origin + libraryRoute(libraryItem))).status()).toBe(404);
        expect((await outsiderPage.request.get(origin + libraryRoute(libraryItem).replace('/pilot/', '/elsewhere/'))).status()).toBe(404);
        expect((await anonymousPage.request.get(origin + libraryRoute(libraryItem))).status()).toBe(401);
    });
    await check('a picture in use cannot be removed; once free, removing it deletes the stored file', async () => {
        await open(ownerPage, '/settings');
        await expect(ownerPage.getByRole('button', { name: 'Remove Still harbour', exact: true })).toBeDisabled();
        const busy = await send(ownerPage, `${libraryRoute(libraryItem)}/remove`, {});
        expect(busy.status()).toBe(409); expect((await busy.json()).error.code).toBe('COVER_IN_USE'); expect(objects.has(libraryKey)).toBe(true);
        await open(learnerPage, `/projects/${projectId}`); await learnerPage.getByRole('button', { name: 'Change cover', exact: true }).click();
        await dialog(learnerPage).getByRole('button', { name: 'Remove cover', exact: true }).click(); await expect(dialog(learnerPage)).toHaveCount(0);
        await open(ownerPage, '/settings');
        ownerPage.once('dialog', d => d.accept());
        await ownerPage.getByRole('button', { name: 'Remove Still harbour', exact: true }).click();
        await expect(ownerPage.locator('.toast')).toContainText('Still harbour was removed from the cover library.');
        await expect(ownerPage.locator('.cover-library-empty')).toBeVisible();
        expect(objects.has(libraryKey)).toBe(false); expect(objects.has(libraryThumbKey)).toBe(false);
        expect((await db.query('SELECT count(*)::int AS n FROM cover_library')).rows[0].n).toBe(0);
        expect((await db.query('SELECT count(*)::int AS n FROM upload_intents WHERE id=$1', [libraryFile])).rows[0].n).toBe(0);
        expect((await learnerPage.request.get(origin + libraryRoute(libraryItem))).status()).toBe(404);
    });
    await check('the connected cover journey produced no uncaught browser errors', async () => { expect(errors).toEqual([]); });
    await writeFile(dir + '/results.json', JSON.stringify({ generatedAt: new Date().toISOString(), method: 'Live Vite build + Hono HTTP + Better Auth cookies + local PGlite, API repository under the restricted reunir_app role with forced RLS. In-process stand-in bucket on a second origin; no Google Cloud Storage, IAM or deployment.', results, errors }, null, 2));
    console.log(`${results.length} connected cover checks passed`);
} catch (e) {
    await ownerPage.screenshot({ path: dir + '/failure-owner.png', fullPage: true }).catch(() => {}); await learnerPage.screenshot({ path: dir + '/failure-learner.png', fullPage: true }).catch(() => {});
    await writeFile(dir + '/results.json', JSON.stringify({ results, errors, failure: String(e) }, null, 2)); throw e;
} finally { await browser.close(); await new Promise<void>(r => appServer.server.close(() => r())); await new Promise<void>(r => bucketServer.server.close(() => r())); await db.close(); }
