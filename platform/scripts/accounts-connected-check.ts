/**
 * Live build, real HTTP, Better Auth cookies and password checks, and a local PGlite database, with the API under the
 * restricted runtime role and forced row security. A member deletes their own account; the owner sees what is kept, then
 * hands the community to an administrator and deletes their own account too.
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
import { MessagingRepository } from '../packages/db/src/messaging';
import { grantRuntimeTables } from '../packages/db/src/runtime-role';
import { createAuth, passwordCheck } from '../apps/api/src/auth';
import { createApp } from '../apps/api/src/app';
const root = resolve(import.meta.dirname, '..'), dir = root + '/evidence/accounts/connected'; await mkdir(dir, { recursive: true });
process.env.VITE_DATA_MODE = 'live';
await build({ configFile: root + '/apps/web/vite.config.ts', build: { outDir: root + '/.connected-dist', emptyOutDir: true }, logLevel: 'error' });
process.env.NODE_ENV = 'test';
let handler: (r: Request) => Response | Promise<Response> = () => new Response('Starting', { status: 503 });
const server = serve({ fetch: r => handler(r), hostname: '127.0.0.1', port: 0 });
await new Promise<void>(r => server.listening ? r() : server.once('listening', r));
const origin = 'http://127.0.0.1:' + (server.address() as { port: number }).port;

const db = await openDatabase('pglite:memory'); await migrate(db); const setup = new WorkspaceRepository(db);
const secret = 'accounts_connected_test_secret_3c2b1a09f8e7d6c5', registrar = createAuth(db, origin, secret, true);
const PASSWORDS = { owner: 'Owner-account-password-123!', member: 'Member-account-password-456!', steward: 'Steward-account-password-789!' };
const owner = (await registrar.api.signUpEmail({ body: { name: 'Pilot Owner', email: 'owner@example.test', password: PASSWORDS.owner } })).user;
const member = (await registrar.api.signUpEmail({ body: { name: 'Pilot Member', email: 'member@example.test', password: PASSWORDS.member } })).user;
await setup.createCommunity({ id: owner.id, name: owner.name }, 'pilot', 'Code Black Pilot');
await setup.addMembership('pilot', { id: member.id, name: member.name }, 'member');
const steward = (await registrar.api.signUpEmail({ body: { name: 'Pilot Steward', email: 'steward@example.test', password: PASSWORDS.steward } })).user;
await setup.addMembership('pilot', { id: steward.id, name: steward.name }, 'admin');
// Everything the application does below runs as the restricted runtime role with forced row security.
await db.query('CREATE ROLE reunir_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS');
await db.transaction(grantRuntimeTables);
const runtime = Object.create(db) as Database;
runtime.transaction = fn => db.transaction(async tx => { await tx.query('SET LOCAL ROLE reunir_app'); return fn(tx); });
const repo = new WorkspaceRepository(runtime), messaging = new MessagingRepository(repo);
const spaceId = (await repo.snapshot('pilot', member.id)).spaces[0].id;
await repo.execute('pilot', member.id, { type: 'post.create', spaceId, kind: 'question', title: 'Who has tried a first-run test?', body: 'Looking for two people to try a first version this week.' }, randomUUID(), 'accounts-connected');
const thread = (await messaging.start('pilot', member.id, owner.id)).id;
await messaging.send('pilot', member.id, thread, 'Thank you for the invitation. I am glad to be here.', 'member-hello-1');
const auth = createAuth(db, origin, secret);
const app = createApp({ repository: repo, origin, verifyPassword: passwordCheck(auth), authHandler: r => auth.handler(r), resolveSession: async headers => { const s = await auth.api.getSession({ headers }); return s ? { id: s.user.id, name: s.user.name } : null; } });
app.get('/assets/*', serveStatic({ root: '.connected-dist' })); app.get('/', serveStatic({ path: '.connected-dist/index.html' })); handler = app.fetch;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: true, args: ['--no-sandbox'] });
const [ownerPage, memberPage] = await Promise.all([0, 1].map(async () => (await browser.newContext({ viewport: { width: 1440, height: 960 } })).newPage()));
const results: { name: string; passed: boolean }[] = [], errors: string[] = [];
for (const p of [ownerPage, memberPage]) { p.setDefaultTimeout(10000); p.on('pageerror', e => errors.push(e.message)); }
const check = async (name: string, fn: () => Promise<void>) => { await fn(); results.push({ name, passed: true }); console.log('PASS', name); };
const a11y = async (name: string, p: Page) => { const a = await new AxeBuilder({ page: p }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze(); await writeFile(`${dir}/a11y-${name}.json`, JSON.stringify({ violations: a.violations, incomplete: a.incomplete }, null, 2)); expect(a.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([]); };
const signIn = async (p: Page, email: string, password: string) => { await p.goto(origin); await p.getByLabel('Email', { exact: true }).fill(email); await p.getByLabel('Password', { exact: true }).fill(password); await p.getByRole('button', { name: 'Sign in', exact: true }).click(); await expect(p.locator('.topbar')).toBeVisible(); };
const account = async (p: Page) => { await p.getByRole('button', { name: 'Account menu', exact: true }).click(); await p.getByRole('menuitem', { name: 'Your account', exact: true }).click(); await expect(p.getByRole('heading', { name: 'Your account.', level: 1 })).toBeVisible(); };
const dialog = (p: Page) => p.locator('dialog[open]');
const confirmWith = async (p: Page, password: string) => {
    await p.getByRole('button', { name: 'Delete your account…', exact: true }).click();
    await dialog(p).getByLabel('Your password', { exact: true }).fill(password);
    await dialog(p).getByLabel('Type delete my account to confirm').fill('delete my account');
    await dialog(p).getByRole('button', { name: 'Delete my account', exact: true }).click();
};
try {
    await check('a member opens Your account and sees their community and role from the server', async () => {
        await signIn(memberPage, 'member@example.test', PASSWORDS.member); await account(memberPage);
        await expect(memberPage.locator('.account-communities li')).toHaveText([/Code Black Pilot\s*member/i]);
        await a11y('account-live', memberPage);
    });
    await check('a wrong password is refused by Better Auth and the account stays', async () => {
        await confirmWith(memberPage, 'Not-my-password-000!');
        await expect(dialog(memberPage).getByRole('alert')).toHaveText('That password is not right.');
        await a11y('wrong-password', memberPage);
        await dialog(memberPage).getByRole('button', { name: 'Keep my account', exact: true }).click();
        expect((await db.query('SELECT count(*)::int AS n FROM auth_user WHERE id=$1', [member.id])).rows[0].n).toBe(1);
    });
    await check('the owner is told why deletion is unavailable while they own the community', async () => {
        await signIn(ownerPage, 'owner@example.test', PASSWORDS.owner); await account(ownerPage);
        await expect(ownerPage.locator('.account-owner-note')).toContainText('You own Code Black Pilot. A community needs its owner');
        await expect(ownerPage.getByRole('button', { name: 'Delete your account…' })).toHaveCount(0);
    });
    await check('the member deletes their account: back to sign-in with a notice, and the old password no longer works', async () => {
        await confirmWith(memberPage, PASSWORDS.member);
        await expect(memberPage.getByRole('status').filter({ hasText: 'Your account has been deleted.' })).toBeVisible();
        await expect(memberPage.getByRole('heading', { name: 'Good to see you.' })).toBeVisible();
        await a11y('signed-out-notice', memberPage);
        expect((await memberPage.context().cookies()).filter(c => c.name.includes('session_token') && c.value)).toEqual([]);
        await memberPage.getByLabel('Email', { exact: true }).fill('member@example.test'); await memberPage.getByLabel('Password', { exact: true }).fill(PASSWORDS.member);
        await memberPage.getByRole('button', { name: 'Sign in', exact: true }).click();
        await expect(memberPage.getByRole('alert')).toBeVisible();
        await memberPage.reload();
        await expect(memberPage.getByText('Your account has been deleted.')).toHaveCount(0);
        for (const table of ['auth_user', 'auth_session', 'auth_account']) expect((await db.query(`SELECT count(*)::int AS n FROM ${table} WHERE ${table === 'auth_user' ? 'id' : 'user_id'}=$1`, [member.id])).rows[0].n).toBe(0);
    });
    await check('the owner sees the kept post and conversation as Former member, with no profile link or reply box', async () => {
        await ownerPage.goto(`${origin}/#/discussions`); await ownerPage.reload();
        const post = ownerPage.locator('.post-card').filter({ hasText: 'Who has tried a first-run test?' });
        await expect(post.locator('.post-byline .former-member')).toHaveText('Former member');
        await expect(post.locator(`a[href="#/members/${member.id}"]`)).toHaveCount(0);
        await expect(ownerPage.getByText('Pilot Member')).toHaveCount(0);
        await a11y('former-post-live', ownerPage);
        await ownerPage.goto(`${origin}/#/messages/${thread}`); await ownerPage.reload();
        await expect(ownerPage.locator('.thread-heading strong')).toHaveText('Former member');
        await expect(ownerPage.locator('.message-bubble')).toContainText('Thank you for the invitation.');
        await expect(ownerPage.locator('textarea#message-body')).toHaveCount(0);
        await expect(ownerPage.getByRole('note')).toHaveText('You can read this conversation, but you cannot reply to a former member.');
        await a11y('former-thread-live', ownerPage);
    });
    await check('the owner hands the community to an administrator with their password, then deletes their own account', async () => {
        await ownerPage.goto(`${origin}/#/access`); await ownerPage.reload();
        await ownerPage.getByRole('button', { name: 'Manage Pilot Steward', exact: true }).click();
        await dialog(ownerPage).getByRole('button', { name: 'Hand over ownership…', exact: true }).click();
        const handOver = async (password: string) => {
            await dialog(ownerPage).getByLabel('Your password', { exact: true }).fill(password);
            await dialog(ownerPage).getByLabel('Type Code Black Pilot to confirm').fill('Code Black Pilot');
            await dialog(ownerPage).getByRole('button', { name: 'Hand over ownership', exact: true }).click();
        };
        await handOver('Not-my-password-000!');
        await expect(dialog(ownerPage).getByRole('alert')).toHaveText('That password is not right.');
        await a11y('handover-wrong-password', ownerPage);
        expect((await db.query("SELECT user_id FROM members WHERE role='owner'")).rows.map(r => r.user_id)).toEqual([owner.id]);
        await handOver(PASSWORDS.owner);
        await expect(dialog(ownerPage)).toHaveCount(0);
        await expect(ownerPage.locator('.toast')).toContainText('Pilot Steward now owns Code Black Pilot. You are an administrator.');
        expect((await db.query("SELECT user_id,role FROM members WHERE role IN ('owner','admin') ORDER BY role DESC")).rows.map(r => [r.user_id, r.role])).toEqual([[steward.id, 'owner'], [owner.id, 'admin']]);
        await account(ownerPage);
        await expect(ownerPage.locator('.account-communities li')).toHaveText([/Code Black Pilot\s*admin/i]);
        await expect(ownerPage.locator('.account-owner-note')).toHaveCount(0);
        await a11y('account-after-handover-live', ownerPage);
        await confirmWith(ownerPage, PASSWORDS.owner);
        await expect(ownerPage.getByRole('heading', { name: 'Good to see you.' })).toBeVisible();
        expect((await db.query('SELECT count(*)::int AS n FROM auth_user WHERE id=$1', [owner.id])).rows[0].n).toBe(0);
        expect((await db.query("SELECT user_id FROM members WHERE role='owner'")).rows.map(r => r.user_id)).toEqual([steward.id]);
    });
    await check('connected account journeys produced no uncaught browser errors', async () => { expect(errors).toEqual([]); });
    await writeFile(dir + '/results.json', JSON.stringify({ generatedAt: new Date().toISOString(), method: 'Live Vite build + Hono HTTP + Better Auth cookies and password checks + local PGlite database; application under the restricted runtime role with forced row security. No external service.', results, errors }, null, 2));
    console.log(`${results.length} connected account checks passed`);
} catch (e) {
    for (const [name, p] of [['owner', ownerPage], ['member', memberPage]] as const) await p.screenshot({ path: `${dir}/failure-${name}.png`, fullPage: true }).catch(() => {});
    await writeFile(dir + '/results.json', JSON.stringify({ results, errors, failure: String(e) }, null, 2));
    throw e;
} finally { await browser.close(); await new Promise<void>(r => server.close(() => r())); await db.close(); }
