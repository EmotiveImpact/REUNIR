/** Actual bundled React in Chromium with fictional browser-local data. Corrections and withdrawals of reviewed evidence. */
import { switchPreviewRole } from './ui-test-helpers';
import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..'), dir = root + '/evidence/evidence-history'; await mkdir(dir, { recursive: true });
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
        return (['color', 'backgroundColor', 'borderTopColor', 'outlineColor'] as const).flatMap(p => { const m = s[p].match(/^rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/); return m && Math.max(+m[1], +m[2], +m[3]) - Math.min(+m[1], +m[2], +m[3]) > 1 ? [`${el.tagName}.${el.className}: ${p}=${s[p]}`] : []; });
    }).slice(0, 20));
    expect(failures).toEqual([]);
}
const nav = async (to: string) => { if ((page.viewportSize()?.width || 1512) < 1000 && !await page.locator('.sidebar').evaluate(el => el.classList.contains('open'))) await page.getByRole('button', { name: 'Open navigation', exact: true }).click(); await page.locator(`.sidebar a[href="${to}"]`).first().click(); };
const common = async () => { await nav('/projects'); await page.locator('.project-card').filter({ hasText: 'Common Ground' }).click(); };
const dialog = () => page.locator('dialog[open]');
const role = (as: 'admin' | 'member') => switchPreviewRole(page, as);
const TITLE = 'Tested the booking flow with creators', CORRECTED = 'Tested the booking flow with three creators';
const item = (title: string) => page.locator('.evidence-item').filter({ has: page.getByRole('heading', { name: title, exact: true }) });
try {
    await page.setContent(await readFile(root + '/.preview/REUNIR-preview.html', 'utf8'), { waitUntil: 'load' });
    await check('a recognised contribution offers its author Correct… and Withdraw…, and nobody else either', async () => {
        await common();
        const join = page.getByRole('button', { name: 'Join the project', exact: true }); if (await join.count()) await join.click();
        await page.getByRole('button', { name: 'Record contribution' }).click();
        await dialog().getByLabel('Contribution title').fill(TITLE);
        await dialog().getByLabel('What you did and what changed').fill('Observed tasks and revised the confirmation step.');
        await dialog().getByRole('button', { name: 'Submit contribution' }).click();
        await expect(item(TITLE).getByRole('button', { name: 'Correct…' })).toHaveCount(0);
        await role('admin'); await common();
        await item(TITLE).getByLabel('contribution review feedback').fill('Checked the notes.');
        await item(TITLE).getByRole('button', { name: 'Recognise contribution' }).click();
        await expect(item(TITLE)).toContainText('recognised');
        await expect(item(TITLE).getByRole('button', { name: 'Correct…' })).toHaveCount(0);
        await expect(item(TITLE).getByRole('button', { name: 'Withdraw…' })).toBeVisible();
        await role('member'); await common();
        await expect(item(TITLE).getByRole('button', { name: 'Correct…' })).toBeVisible();
        await expect(item(TITLE).getByRole('button', { name: 'Withdraw…' })).toBeVisible();
    });
    await check('the author asks for a correction; the reviewed wording stays while it waits', async () => {
        await item(TITLE).getByRole('button', { name: 'Correct…' }).click();
        await expect(dialog().getByLabel('Title')).toHaveValue(TITLE);
        await dialog().getByLabel('Title').fill(CORRECTED);
        await dialog().getByLabel('Why the correction?').fill('The first wording left out how many creators took part.');
        await neutral(); await a11y('correct-dialogue');
        await dialog().getByRole('button', { name: 'Send correction for review' }).click();
        await expect(dialog()).toHaveCount(0);
        await expect(item(TITLE)).toContainText('Correction waiting for review');
        await expect(item(TITLE)).toContainText(CORRECTED);
        await expect(item(TITLE).getByRole('button', { name: 'Correction waiting' })).toBeDisabled();
        await page.screenshot({ path: dir + '/correction-pending.png', fullPage: true });
    });
    await check('an administrator reviews the correction in a dialogue; the history keeps the earlier wording', async () => {
        await role('admin'); await common();
        await item(TITLE).getByRole('button', { name: 'Review correction' }).click();
        await expect(dialog()).toContainText('Reviewed wording');
        await expect(dialog()).toContainText('Proposed wording');
        await expect(dialog().getByRole('button', { name: 'Accept correction' })).toBeDisabled();
        await dialog().getByLabel('Correction review response').fill('Matches the testing notes.');
        await neutral(); await a11y('review-dialogue');
        await dialog().getByRole('button', { name: 'Accept correction' }).click();
        await expect(dialog()).toHaveCount(0);
        const c = item(CORRECTED);
        await expect(c.locator('.evidence-change')).toContainText(/Corrected on/);
        await expect(c.locator('.evidence-wording').filter({ hasText: 'Earlier wording' })).toContainText(TITLE);
        await expect(c).toContainText('Matches the testing notes.');
    });
    await check('an administrator withdraws a verified outcome: it shows as withdrawn and leaves the archive', async () => {
        await nav('/outputs');
        await expect(page.locator('.output-card').filter({ hasText: 'Notes from the studio: issue 01' })).toHaveCount(1);
        const card = page.locator('.outcome-card').filter({ hasText: 'Notes from the studio: issue 01' });
        await card.getByRole('button', { name: 'Withdraw…' }).click();
        await dialog().getByLabel('Reason').fill('The issue was never printed.');
        await dialog().getByRole('button', { name: 'Withdraw outcome' }).click();
        await expect(card).toContainText('withdrawn');
        await expect(card.locator('.evidence-change')).toContainText(/Withdrawn on/);
        await expect(card).toContainText('The issue was never printed.');
        await expect(page.locator('.output-card').filter({ hasText: 'Notes from the studio: issue 01' })).toHaveCount(0);
        await expect(card.getByRole('button', { name: 'Withdraw…' })).toHaveCount(0);
        await neutral(); await a11y('outputs-withdrawn');
        await page.screenshot({ path: dir + '/outcome-withdrawn.png', fullPage: true });
    });
    await check('the author withdraws a contribution; it stays on record, marked withdrawn, with its reason', async () => {
        await role('member'); await common();
        await item(CORRECTED).getByRole('button', { name: 'Withdraw…' }).click();
        await dialog().getByLabel('Reason').fill('These notes belonged to a different test.');
        await dialog().getByRole('button', { name: 'Withdraw contribution' }).click();
        const c = page.locator('.evidence-item.is-withdrawn').filter({ hasText: CORRECTED });
        await expect(c).toContainText('withdrawn');
        await expect(c.locator('.evidence-change')).toHaveCount(2);
        await expect(c.locator('.evidence-change').last()).toContainText(/Withdrawn on/);
        await expect(c).toContainText('These notes belonged to a different test.');
        await expect(c.getByRole('button', { name: /Correct|Withdraw/ })).toHaveCount(0);
        await neutral(); await a11y('project-withdrawn'); await overflow();
        await page.screenshot({ path: dir + '/contribution-withdrawn.png', fullPage: true });
    });
    await check('the history fits a phone screen', async () => {
        await page.setViewportSize({ width: 390, height: 844 });
        await overflow();
        await page.setViewportSize({ width: 1512, height: 1100 });
    });
    await check('evidence history journeys produced no uncaught browser errors', async () => { expect(errors).toEqual([]); });
    await writeFile(dir + '/results.json', JSON.stringify({ generatedAt: new Date().toISOString(), method: 'Bundled standalone preview in Chromium; fictional browser-local data only.', results, errors }, null, 2));
    console.log(`${results.length} evidence history browser checks passed`);
} catch (e) {
    await page.screenshot({ path: dir + '/failure.png', fullPage: true }).catch(() => {});
    await writeFile(dir + '/results.json', JSON.stringify({ results, errors, failure: String(e) }, null, 2));
    throw e;
} finally { await browser.close(); }
