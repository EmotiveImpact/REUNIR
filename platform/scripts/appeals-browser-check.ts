/** Actual bundled React in Chromium with fictional browser-local data: appealing a hidden post and deciding the appeal. */
import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { switchPreviewRole } from './ui-test-helpers';
const root = resolve(import.meta.dirname, '..'), dir = root + '/evidence/appeals'; await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: true, args: ['--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 1512, height: 1100 } })).newPage(); page.setDefaultTimeout(10000);
const results: { name: string; passed: boolean }[] = [], errors: string[] = [];
page.on('pageerror', e => errors.push(e.message));
const check = async (name: string, fn: () => Promise<void>) => { await fn(); results.push({ name, passed: true }); console.log('PASS', name); };
const overflow = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
async function a11y(name: string) { const a = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze(); await writeFile(`${dir}/a11y-${name}.json`, JSON.stringify({ violations: a.violations, incomplete: a.incomplete }, null, 2)); expect(a.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([]); }
async function neutral() {
    const failures = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('body *')].flatMap(el => {
        if (!el.getClientRects().length) return [];
        const s = getComputedStyle(el);
        return (['color', 'backgroundColor', 'borderTopColor', 'outlineColor', 'accentColor'] as const).flatMap(p => { const m = s[p].match(/^rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/); return m && Math.max(+m[1], +m[2], +m[3]) - Math.min(+m[1], +m[2], +m[3]) > 1 ? [`${el.tagName}.${el.className}: ${p} ${s[p]}`] : []; });
    }).slice(0, 20));
    expect(failures).toEqual([]);
}
const dialog = () => page.locator('dialog[open]');
const heading = (name: string) => expect(page.getByRole('heading', { name, level: 1 })).toBeVisible();
const notices = async () => { await page.locator('a.notification-button').first().click(); await heading('A little heads-up.'); };
const openAppealsFromNotice = async (title: string) => { await notices(); await page.locator('.notification-row', { hasText: title }).first().click(); await heading('Appeals'); };
const studioAppeals = async () => {
    await page.getByRole('link', { name: 'Community studio' }).click();
    await page.getByRole('button', { name: 'Moderation', exact: true }).click();
    await page.getByRole('link', { name: 'Open appeals' }).click(); await heading('Appeals');
};
const TITLE = 'Selling my old camera kit';
try {
    await page.setContent(await readFile(root + '/.preview/REUNIR-preview.html', 'utf8'), { waitUntil: 'load' });
    await check('the member is told their post was hidden and still sees it, marked hidden only to them', async () => {
        await openAppealsFromNotice('Your post was hidden');
        await expect(page.getByRole('heading', { name: 'Your hidden posts' })).toBeVisible();
        await expect(page.locator('.appeal-row', { hasText: TITLE })).toBeVisible();
        await expect(page.getByText('You have not appealed anything.')).toBeVisible();
        await expect(page.getByRole('heading', { name: /Appeals to decide/ })).toHaveCount(0);
        await page.locator('.appeal-row', { hasText: TITLE }).getByRole('link', { name: 'Read the post' }).click();
        const card = page.locator('.post-card', { hasText: TITLE });
        await expect(card.getByRole('note')).toContainText('It is hidden only to you');
        await expect(card.getByRole('button', { name: 'Appreciate post' })).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Publish reply' })).toHaveCount(0);
        await neutral(); await a11y('hidden-post'); await overflow();
        await page.screenshot({ path: dir + '/hidden-post.png' });
    });
    await check('the member appeals from their hidden post and the appeal waits for someone who did not hide it', async () => {
        await page.locator('.post-card', { hasText: TITLE }).getByRole('button', { name: 'Appeal' }).click();
        await expect(dialog().getByRole('heading', { name: 'Appeal this decision' })).toBeVisible();
        await expect(dialog().getByRole('button', { name: 'Send appeal' })).toBeDisabled();
        await dialog().getByLabel('Why should it be visible again?').fill('These are friends from the critique group who asked me about the kit.');
        await a11y('appeal-dialog');
        await dialog().getByRole('button', { name: 'Send appeal' }).click();
        await expect(dialog()).toHaveCount(0);
        await expect(page.getByText('Appeal sent. An owner or administrator who did not hide the post will decide it.')).toBeVisible();
        await page.locator('.post-card', { hasText: TITLE }).getByRole('link', { name: 'Your appeal is waiting' }).click();
        await heading('Appeals');
        const card = page.getByRole('article', { name: `Appeal about ${TITLE}` });
        await expect(card).toContainText('Waiting for a decision');
        await expect(card).toContainText('Waiting for an owner or administrator who did not hide the post.');
        await expect(card).toContainText('These are friends from the critique group');
        await neutral(); await a11y('appeals-member'); await overflow();
        await page.screenshot({ path: dir + '/appeals-member.png' });
    });
    await check('an owner who did not hide the post is told, and restores it with a response', async () => {
        await switchPreviewRole(page, 'admin');
        await openAppealsFromNotice('An appeal to decide');
        await expect(page.getByRole('heading', { name: /Appeals to decide/ })).toContainText('1');
        const card = page.getByRole('article', { name: `Appeal about ${TITLE}` });
        await expect(card).toContainText('Hidden by Maya Bennett');
        await expect(card).toContainText('You can decide this appeal.');
        await neutral(); await a11y('appeals-admin');
        await page.screenshot({ path: dir + '/appeals-admin.png' });
        await card.getByRole('button', { name: 'Decide' }).click();
        await expect(dialog().getByRole('heading', { name: 'Decide this appeal' })).toBeVisible();
        await dialog().getByLabel('Response to the member').fill('Selling to friends here is fine. Restored, thank you.');
        await a11y('decide-dialog');
        await dialog().getByRole('button', { name: 'Restore the post' }).click();
        await expect(dialog()).toHaveCount(0);
        await expect(page.getByText('Decision reversed. The post is visible to members again.')).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Decided appeals' })).toBeVisible();
        await expect(page.getByRole('article', { name: `Appeal about ${TITLE}` })).toContainText('Restored');
    });
    await check('the member reads the response, and the post is back without the hidden note', async () => {
        await switchPreviewRole(page, 'member');
        await openAppealsFromNotice('Your post is visible again');
        const card = page.getByRole('article', { name: `Appeal about ${TITLE}` });
        await expect(card).toContainText('Restored');
        await expect(card).toContainText('Selling to friends here is fine. Restored, thank you.');
        await expect(card.getByRole('button', { name: 'Withdraw appeal' })).toHaveCount(0);
        await card.getByRole('link', { name: 'Read the post' }).click();
        const post = page.locator('.post-card', { hasText: TITLE });
        await expect(post.getByRole('note')).toHaveCount(0);
        await expect(post.getByRole('button', { name: 'Appreciate post' })).toBeVisible();
    });
    await check('when the only owner hid the post, the appeal waits and the screen says why', async () => {
        await page.getByRole('link', { name: 'Discussions' }).first().click();
        await page.locator('button.composer').first().click();
        await dialog().getByLabel('Your post', { exact: true }).fill('A fictional post for the appeals check.');
        await dialog().getByRole('button', { name: 'Publish post', exact: true }).click();
        await expect(dialog()).toHaveCount(0);
        await switchPreviewRole(page, 'admin');
        await page.getByRole('link', { name: 'Discussions' }).first().click();
        const post = page.locator('.post-card', { hasText: 'A fictional post for the appeals check.' }).first();
        await post.getByRole('button', { name: 'Post options' }).click();
        await post.getByRole('button', { name: 'Hide post' }).click();
        await switchPreviewRole(page, 'member');
        await openAppealsFromNotice('Your post was hidden');
        await page.locator('.appeal-row', { hasText: 'A post without a title' }).getByRole('button', { name: 'Appeal' }).click();
        await dialog().getByLabel('Why should it be visible again?').fill('It was only a test post.');
        await dialog().getByRole('button', { name: 'Send appeal' }).click();
        await expect(page.getByText(/Nobody can decide it yet/).first()).toBeVisible();
        await expect(page.getByRole('article', { name: 'Appeal about a post' }).getByRole('status')).toContainText('Nobody can decide this yet');
        await switchPreviewRole(page, 'admin');
        await studioAppeals();
        const card = page.getByRole('article', { name: 'Appeal about a post' });
        await expect(card).toContainText('You hid this post, so another owner or administrator decides.');
        await expect(card.getByRole('button', { name: 'Decide' })).toHaveCount(0);
        await switchPreviewRole(page, 'member');
        await openAppealsFromNotice('Your post was hidden');
        await page.getByRole('article', { name: 'Appeal about a post' }).getByRole('button', { name: 'Withdraw appeal' }).click();
        await expect(page.getByText('Appeal withdrawn. The post stays hidden.')).toBeVisible();
        await expect(page.getByRole('article', { name: 'Appeal about a post' })).toContainText('Withdrawn');
    });
    await check('the appeals page and dialogue fit a phone screen', async () => {
        await page.setViewportSize({ width: 390, height: 844 });
        await overflow(); await a11y('appeals-mobile');
        await page.locator('.appeal-row').first().getByRole('button', { name: 'Appeal' }).click();
        await overflow(); await dialog().getByRole('button', { name: 'Close dialogue' }).click();
        await page.screenshot({ path: dir + '/appeals-mobile.png' });
        await page.setViewportSize({ width: 1512, height: 1100 });
    });
    await check('appeal journeys produced no uncaught browser errors', async () => { expect(errors).toEqual([]); });
    await writeFile(dir + '/results.json', JSON.stringify({ generatedAt: new Date().toISOString(), method: 'Bundled standalone preview in Chromium; fictional browser-local data only.', results, errors }, null, 2));
    console.log(`${results.length} appeal browser checks passed`);
} catch (e) {
    await page.screenshot({ path: dir + '/failure.png', fullPage: true }).catch(() => {});
    await writeFile(dir + '/results.json', JSON.stringify({ results, errors, failure: String(e) }, null, 2));
    throw e;
} finally { await browser.close(); }
