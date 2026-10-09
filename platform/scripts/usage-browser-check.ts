/** Actual bundled React in Chromium with fictional browser-local data. Usage counts that name no one (decision 060); no hosted service. */
import { chromium, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { switchPreviewRole, answerConfirmations } from './ui-test-helpers';
import { USAGE_AREAS, USAGE_THRESHOLD, USAGE_WEEKS } from '../packages/contracts/src/usage';
import { createSeed } from '../packages/domain/src/seed';
const root = resolve(import.meta.dirname, '..'), dir = root + '/evidence/usage'; await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: true, args: ['--no-sandbox'] });
const html = await readFile(root + '/.preview/REUNIR-preview.html', 'utf8');
const results: { name: string; passed: boolean }[] = [], errors: string[] = [];
const check = async (name: string, fn: () => Promise<void>) => { await fn(); results.push({ name, passed: true }); console.log('PASS', name); };
async function open(signal = false) {
    const context = await browser.newContext({ viewport: { width: 1512, height: 1100 } });
    // A browser sending Global Privacy Control, as some browsers and extensions do.
    if (signal) await context.addInitScript({ content: "Object.defineProperty(Navigator.prototype,'globalPrivacyControl',{get:()=>true})" });
    const page = await context.newPage(); page.setDefaultTimeout(10000);
    page.on('pageerror', e => errors.push(e.message)); await answerConfirmations(page);
    await page.setContent(html, { waitUntil: 'load' });
    return page;
}
const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth).then(ok => expect(ok).toBe(true));
async function a11y(page: Page, name: string) { const a = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze(); await writeFile(`${dir}/a11y-${name}.json`, JSON.stringify({ violations: a.violations, incomplete: a.incomplete }, null, 2)); expect(a.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([]); }
async function neutral(page: Page) {
    const failures = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('body *')].flatMap(el => {
        if (!el.getClientRects().length) return [];
        const s = getComputedStyle(el);
        return (['color', 'backgroundColor', 'borderTopColor', 'outlineColor'] as const).flatMap(p => { const m = s[p].match(/^rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/); return m && Math.max(+m[1], +m[2], +m[3]) - Math.min(+m[1], +m[2], +m[3]) > 1 ? [`${el.tagName}.${el.className}: ${p}=${s[p]}`] : []; });
    }).slice(0, 20));
    expect(failures).toEqual([]);
}
const go = (page: Page, path: string) => page.locator(`.sidebar a[href="${path}"]`).first().click();
const menu = async (page: Page, item: string) => { await page.getByRole('button', { name: 'Account menu', exact: true }).click(); await page.getByRole('menuitem', { name: item, exact: true }).click(); };
const choice = (page: Page) => page.getByRole('switch', { name: 'Count what I open from this device' });
/** This week's cell for a part of the community, from the Usage tab. */
const thisWeek = (page: Page, label: string) => page.locator('.usage-table tbody tr').filter({ has: page.getByRole('rowheader', { name: label, exact: true }) }).locator('td').last();
async function usageTab(page: Page) {
    await go(page, '/admin');
    await page.getByRole('button', { name: 'Usage', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'How the community is used' })).toBeVisible();
}
try {
    const page = await open();
    await check('a member moving between parts of the community is counted once per move, and sees no usage figures', async () => {
        for (let i = 0; i < 5; i++) { await go(page, '/projects'); await go(page, '/missions'); }
        await expect(page.locator('.sidebar a[href="/admin"]')).toHaveCount(0);
    });
    await check('Your account offers to leave this device out, and leaving it out stops counting', async () => {
        await menu(page, 'Your account');
        const panel = page.locator('section.usage-choice');
        await expect(panel).toContainText('The count is all that is kept');
        await expect(choice(page)).toBeChecked();
        await neutral(page); await a11y(page, 'account-choice');
        await choice(page).click();
        await expect(choice(page)).not.toBeChecked();
        for (let i = 0; i < 3; i++) { await go(page, '/events'); await go(page, '/knowledge'); }
        await menu(page, 'Your account');
        await expect(choice(page)).not.toBeChecked();
        await choice(page).click();
        await expect(choice(page)).toBeChecked();
        await expect(page.locator('section.retention')).toContainText('Usage counts');
    });
    await switchPreviewRole(page, 'admin');
    await check('an administrator sees weekly totals per part, small counts hidden and nobody named', async () => {
        await usageTab(page);
        const table = page.locator('.usage-table');
        await expect(table.locator('tbody tr')).toHaveCount(USAGE_AREAS.length);
        await expect(table.locator('thead th')).toHaveCount(USAGE_WEEKS + 1);
        await expect(table.locator('thead th').last()).toHaveText('This week');
        await expect(thisWeek(page, 'Projects')).toHaveText('5');
        await expect(thisWeek(page, 'Missions')).toHaveText('5');
        await expect(thisWeek(page, 'Events')).toHaveText('0');
        await expect(thisWeek(page, 'Knowledge & collections')).toHaveText('0');
        await expect(thisWeek(page, 'Your home').locator('[aria-hidden=true]')).toHaveText(`<${USAGE_THRESHOLD}`);
        await expect(thisWeek(page, 'Your home').locator('.sr-only')).toHaveText(`fewer than ${USAGE_THRESHOLD}`);
        await expect(page.locator('.usage-stats .sample-note')).toContainText('Illustrative counts');
        const text = await page.locator('.usage-stats').innerText();
        for (const m of createSeed().members) expect(text).not.toContain(m.name);
        await neutral(page); await overflow(page); await a11y(page, 'usage-tab'); await page.screenshot({ path: dir + '/usage-tab.png', fullPage: true });
    });
    await check('on a phone the table scrolls inside its own frame, not the page', async () => {
        await page.setViewportSize({ width: 390, height: 900 });
        await expect(page.locator('.usage-table-wrap')).toBeVisible();
        await overflow(page); await neutral(page);
        await page.setViewportSize({ width: 1512, height: 1100 });
    });
    await page.context().close();

    const quiet = await open(true);
    await check('a browser sending Global Privacy Control is never counted, and Your account says why', async () => {
        for (let i = 0; i < 5; i++) { await go(quiet, '/projects'); await go(quiet, '/events'); }
        await menu(quiet, 'Your account');
        await expect(quiet.locator('section.usage-choice')).toContainText('Your browser asks sites not to track you');
        await expect(choice(quiet)).toHaveCount(0);
        await switchPreviewRole(quiet, 'admin');
        await usageTab(quiet);
        await expect(thisWeek(quiet, 'Projects')).toHaveText('0');
        await expect(thisWeek(quiet, 'Events')).toHaveText('0');
    });
    await quiet.context().close();
    expect(errors).toEqual([]);
} finally {
    await writeFile(dir + '/results.json', JSON.stringify({ generatedAt: new Date().toISOString(), method: 'Bundled demo in Chromium with fictional browser-local data.', results, errors }, null, 2));
    await browser.close();
}
console.log(`${results.length} usage browser checks passed`);
