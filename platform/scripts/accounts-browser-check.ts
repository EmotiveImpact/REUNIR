/** Actual bundled React in Chromium with fictional browser-local data. Deleting a demo account changes only this page. */
import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { switchPreviewRole } from './ui-test-helpers';
const root = resolve(import.meta.dirname, '..'), dir = root + '/evidence/accounts'; await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: true, args: ['--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 1512, height: 1100 } })).newPage(); page.setDefaultTimeout(10000);
const results: { name: string; passed: boolean }[] = [], errors: string[] = [];
page.on('pageerror', e => errors.push(e.message));
page.on('dialog', d => d.accept());
const check = async (name: string, fn: () => Promise<void>) => { await fn(); results.push({ name, passed: true }); console.log('PASS', name); };
const overflow = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
async function a11y(name: string) { const a = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze(); await writeFile(`${dir}/a11y-${name}.json`, JSON.stringify({ violations: a.violations, incomplete: a.incomplete }, null, 2)); expect(a.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([]); }
async function neutral() {
    const failures = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('body *')].flatMap(el => {
        if (!el.getClientRects().length) return [];
        const s = getComputedStyle(el);
        return (['color', 'backgroundColor', 'borderTopColor', 'outlineColor'] as const).flatMap(p => { const m = s[p].match(/^rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/); return m && Math.max(+m[1], +m[2], +m[3]) - Math.min(+m[1], +m[2], +m[3]) > 1 ? [`${el.tagName}.${el.className}: ${p} ${s[p]}`] : []; });
    }).slice(0, 20));
    expect(failures).toEqual([]);
}
const menu = async (item: string | RegExp) => {
    if (await page.locator('.sidebar.open').count()) await page.getByRole('button', { name: 'Close navigation panel', exact: true }).click();
    await page.getByRole('button', { name: 'Account menu', exact: true }).click();
    await page.getByRole('menuitem', { name: item }).click();
};
const account = async () => { await menu('Your account'); await expect(page.getByRole('heading', { name: 'Your account.', level: 1 })).toBeVisible(); };
const dialog = () => page.locator('dialog[open]');
const go = async (path: string) => { await page.locator(`.sidebar a[href="${path}"]`).first().click(); };
const deleteDemoAccount = async () => {
    await account();
    await page.getByRole('button', { name: 'Delete your account…', exact: true }).click();
    await dialog().getByLabel('Type delete my account to confirm').fill('delete my account');
    await dialog().getByRole('button', { name: 'Delete my account', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Your fictional account has been deleted.' })).toBeVisible();
};
try {
    await page.setContent(await readFile(root + '/.preview/REUNIR-preview.html', 'utf8'), { waitUntil: 'load' });
    await check('Your account lists the persona’s communities and says what deletion keeps and removes', async () => {
        await account();
        await expect(page.locator('.account-communities li')).toHaveText([/Code Black/, /Studio North/]);
        const panel = page.locator('.account-delete');
        await expect(panel.getByRole('heading', { name: 'What stays, shown as Former member' })).toBeVisible();
        await expect(panel).toContainText('Posts and comments, so conversations still make sense');
        await expect(panel).toContainText('Your learning record: tracks, completed lessons, knowledge-check answers and points');
        await expect(panel.getByRole('link', { name: 'Open your profile' })).toBeVisible();
        await neutral(); await a11y('account'); await overflow();
        await page.screenshot({ path: dir + '/account.png', fullPage: true });
    });
    await check('an owner is told why their account cannot be deleted, with no delete button', async () => {
        await switchPreviewRole(page, 'admin'); await account();
        await expect(page.locator('.account-owner-note')).toHaveText(/^You own Code Black and Studio North\. A community needs its owner, so this account cannot be deleted while you own one\./);
        await expect(page.getByRole('button', { name: 'Delete your account…' })).toHaveCount(0);
        await a11y('account-owner');
        await switchPreviewRole(page, 'member');
    });
    await check('the dialogue names the communities, needs the typed phrase and keeps the account on cancel', async () => {
        await account();
        await page.getByRole('button', { name: 'Delete your account…', exact: true }).click();
        await expect(dialog().getByRole('heading', { name: 'Delete your account?' })).toBeVisible();
        await expect(dialog()).toContainText('This deletes your account in Code Black and Studio North and cannot be undone.');
        await expect(dialog()).toContainText('This fictional demo has no passwords.');
        await expect(dialog().getByLabel('Your password')).toHaveCount(0);
        await dialog().getByLabel('Type delete my account to confirm').fill('delete');
        await dialog().getByRole('button', { name: 'Delete my account', exact: true }).click();
        await expect(dialog().getByRole('alert')).toHaveText('Type “delete my account” to confirm.');
        await neutral(); await a11y('delete-dialogue');
        await dialog().getByRole('button', { name: 'Keep my account', exact: true }).click();
        await expect(dialog()).toHaveCount(0);
        await go('/members'); await expect(page.locator('.member-card').filter({ hasText: 'Alex Morgan' })).toHaveCount(1);
    });
    await check('deleting the account in the demo explains what a connected community keeps and removes', async () => {
        await deleteDemoAccount();
        await expect(page.locator('.account-farewell')).toContainText('your posts, comments and project work would stay, shown as Former member');
        await expect(page.locator('.sidebar')).toHaveCount(0);
        await neutral(); await a11y('farewell'); await overflow();
        await page.screenshot({ path: dir + '/farewell.png' });
    });
    await check('the owner sees the kept comment and conversation as Former member, without a profile, photo or reply box', async () => {
        await page.getByRole('button', { name: 'See the community as Amina Okafor', exact: true }).click();
        await expect(page.locator('.topbar')).toBeVisible();
        await go('/discussions');
        await page.getByRole('link', { name: 'The first version is never the final story.' }).first().click();
        const comment = page.locator('.comment').filter({ hasText: 'Happy to take a look at the first-run experience.' });
        await expect(comment.locator('strong')).toHaveText('Former member');
        await expect(comment.locator('.avatar img')).toHaveCount(0);
        await expect(page.getByText('Alex Morgan')).toHaveCount(0);
        await neutral(); await a11y('former-comment');
        await go('/members');
        await expect(page.locator('.member-card').filter({ hasText: /Former member|Alex Morgan/ })).toHaveCount(0);
        await go('/messages');
        await page.locator('.inbox-list .inbox-person').filter({ hasText: 'Former member' }).click();
        await expect(page.locator('.thread-heading strong')).toHaveText('Former member');
        await expect(page.locator('.thread-heading')).toContainText('This account was deleted. Their messages stay here for you.');
        await expect(page.getByRole('link', { name: 'View member profile' })).toHaveCount(0);
        await expect(page.getByRole('button', { name: /^(Block|Unblock)$/ })).toHaveCount(0);
        await expect(page.locator('textarea#message-body')).toHaveCount(0);
        await expect(page.getByRole('note')).toHaveText('You can read this conversation, but you cannot reply to a former member.');
        await expect(page.locator('.message-bubble').first()).toContainText('Welcome, Alex.');
        await neutral(); await a11y('former-thread');
        await page.getByRole('button', { name: 'Account menu', exact: true }).click();
        await expect(page.getByRole('menuitem', { name: /Preview as member/ })).toHaveCount(0);
        await page.keyboard.press('Escape');
    });
    await check('restarting the demo after a second deletion brings every fictional account back', async () => {
        await switchPreviewRole(page, 'instructor');
        await deleteDemoAccount();
        await page.getByRole('button', { name: 'Restart the demo', exact: true }).click();
        await expect(page.locator('.topbar')).toBeVisible();
        await go('/members');
        await expect(page.locator('.member-card').filter({ hasText: /Alex Morgan|Idris Cole/ })).toHaveCount(2);
        await page.getByRole('button', { name: 'Account menu', exact: true }).click();
        await expect(page.locator('.account-menu strong').first()).toHaveText('Alex Morgan');
        await expect(page.getByRole('menuitem', { name: /Preview as instructor/ })).toHaveCount(1);
        await page.keyboard.press('Escape');
    });
    await check('the account page and dialogue fit a phone screen', async () => {
        await page.setViewportSize({ width: 390, height: 844 });
        await account(); await overflow();
        await page.getByRole('button', { name: 'Delete your account…', exact: true }).click();
        await expect(dialog()).toBeVisible(); await overflow(); await a11y('delete-dialogue-mobile');
        await page.screenshot({ path: dir + '/delete-dialogue-mobile.png' });
        await dialog().getByRole('button', { name: 'Keep my account', exact: true }).click();
        await page.setViewportSize({ width: 1512, height: 1100 });
    });
    await check('account journeys produced no uncaught browser errors', async () => { expect(errors).toEqual([]); });
    await writeFile(dir + '/results.json', JSON.stringify({ generatedAt: new Date().toISOString(), method: 'Bundled standalone preview in Chromium; fictional browser-local data only.', results, errors }, null, 2));
    console.log(`${results.length} account browser checks passed`);
} catch (e) {
    await page.screenshot({ path: dir + '/failure.png', fullPage: true }).catch(() => {});
    await writeFile(dir + '/results.json', JSON.stringify({ results, errors, failure: String(e) }, null, 2));
    throw e;
} finally { await browser.close(); }
