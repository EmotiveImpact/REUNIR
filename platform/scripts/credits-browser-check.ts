/** Actual bundled React in Chromium with fictional browser-local data. Crediting teammates on a contribution, with consent; no hosted service. */
import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { openProfile, switchPreviewRole, answerConfirmations } from './ui-test-helpers';
const root = resolve(import.meta.dirname, '..'), dir = root + '/evidence/credits'; await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: true, args: ['--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 1512, height: 1100 } })).newPage(); page.setDefaultTimeout(10000);
const results: { name: string; passed: boolean }[] = [], errors: string[] = [];
page.on('pageerror', e => errors.push(e.message)); await answerConfirmations(page);
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
const openMenu = async () => { if ((page.viewportSize()?.width || 1512) < 1000 && !await page.locator('.sidebar').evaluate(el => el.classList.contains('open'))) await page.getByRole('button', { name: 'Open navigation', exact: true }).click(); };
const go = async (path: string) => { await openMenu(); await page.locator(`.sidebar a[href="${path}"]`).first().click(); };
const project = async (title: string) => { await go('/projects'); await page.locator('.project-card').filter({ hasText: title }).first().click(); await expect(page.locator('h1')).toContainText(title); };
const toast = () => page.locator('.toast'), dialog = () => page.locator('dialog[open]');
const item = (title: string) => page.locator('.evidence-item').filter({ hasText: title });
const WORK = 'Ran the first onboarding test';
try {
    await page.setContent(await readFile(root + '/.preview/REUNIR-preview.html', 'utf8'), { waitUntil: 'load' });
    await check('an accepted credit in the fictional seed reads "With Nia James" on the contribution', async () => {
        await project('Notes from the process');
        await expect(item('Edited the first Notes issue').locator('.credit-line')).toHaveText('With Nia James');
        await expect(item('Edited the first Notes issue').getByRole('button', { name: /Credit someone/ })).toHaveCount(0);
    });
    await check('the author records a contribution and credits a teammate, who is asked first', async () => {
        await project('Common Ground');
        await page.getByRole('button', { name: 'Record contribution', exact: true }).click();
        await dialog().getByLabel('Contribution title').fill(WORK);
        await dialog().getByLabel('What you did and what changed').fill('Observed three first-run sessions with Idris and wrote up where people hesitated.');
        await dialog().getByRole('button', { name: 'Submit contribution', exact: true }).click();
        await expect(item(WORK)).toBeVisible();
        await item(WORK).getByRole('button', { name: 'Credit someone…', exact: true }).click();
        const options = await dialog().getByLabel('Teammate').locator('option').allTextContents();
        expect(options).toEqual(['Choose a teammate', 'Idris Cole']);
        await dialog().getByLabel('Teammate').selectOption({ label: 'Idris Cole' });
        await dialog().getByLabel('What they did (optional)').fill('co-author');
        await neutral(); await a11y('credit-dialog');
        await dialog().getByRole('button', { name: 'Ask to credit', exact: true }).click();
        await expect(toast()).toContainText('Invitation sent.');
        await expect(item(WORK).locator('.credit-list li')).toContainText('Idris Cole');
        await expect(item(WORK).locator('.credit-list li')).toContainText('Waiting for an answer');
        await expect(item(WORK).locator('.credit-line')).toHaveCount(0);
        await neutral(); await overflow(); await a11y('author'); await page.screenshot({ path: dir + '/author.png', fullPage: true });
    });
    await switchPreviewRole(page, 'admin');
    await check('an administrator sees neither the invitation nor any way to answer it', async () => {
        await project('Common Ground');
        await expect(item(WORK)).toBeVisible();
        await expect(item(WORK).locator('.credit-list, .credit-prompt, .credit-line')).toHaveCount(0);
    });
    await switchPreviewRole(page, 'instructor');
    await check('the invitee is notified, opens the project and accepts', async () => {
        await page.locator('a[href="/notifications"]').first().click();
        await page.locator('.notification-row').filter({ hasText: 'You have been asked to share credit' }).click();
        await expect(page.locator('h1')).toContainText('Common Ground');
        const prompt = item(WORK).locator('.credit-prompt');
        await expect(prompt).toContainText('Alex Morgan would like to credit you on this contribution as co-author');
        await neutral(); await overflow(); await a11y('invitee'); await page.screenshot({ path: dir + '/invitee.png', fullPage: true });
        await prompt.getByRole('button', { name: 'Accept credit', exact: true }).click();
        await expect(toast()).toContainText('Credit accepted.');
        await expect(item(WORK).locator('.credit-line')).toHaveText('With Idris Cole');
        await expect(item(WORK).getByRole('button', { name: 'Remove my credit', exact: true })).toBeVisible();
        await expect(item(WORK).getByRole('button', { name: 'Recognise contribution' }), 'a credited project lead leaves the review to someone else').toHaveCount(0);
    });
    await check('the credited person’s profile lists it as "Credited on", apart from their own contributions', async () => {
        await openProfile(page);
        const section = page.locator('.credited-on');
        await expect(section).toContainText('Credited on');
        await expect(section).toContainText(WORK);
        await expect(section).toContainText('Recorded by Alex Morgan · co-author');
        await expect(page.locator('.panel').filter({ hasText: 'Contributions, not just a bio' })).not.toContainText(WORK);
        await neutral(); await overflow(); await a11y('profile');
    });
    await switchPreviewRole(page, 'member');
    await check('the author sees the acceptance and can remove the credit', async () => {
        await project('Common Ground');
        await expect(item(WORK).locator('.credit-line')).toHaveText('With Idris Cole');
        await expect(item(WORK).locator('.credit-list li')).toContainText('Credited');
        await item(WORK).getByRole('button', { name: 'Remove the credit for Idris Cole', exact: true }).click();
        await expect(toast()).toContainText('Idris Cole is no longer credited.');
        await expect(item(WORK).locator('.credit-line')).toHaveCount(0);
    });
    await check('at phone width the credits stay readable without sideways scrolling', async () => {
        await page.setViewportSize({ width: 390, height: 900 });
        await expect(item(WORK).locator('.credit-list li')).toContainText('Withdrawn');
        await overflow(); await neutral();
        await page.screenshot({ path: dir + '/phone.png', fullPage: true });
    });
    // Alpha 59: credits on outcomes (decision 059), on the same terms as credits on contributions.
    await page.setViewportSize({ width: 1512, height: 1100 });
    const outcome = (title: string) => page.locator('.outcome-card').filter({ hasText: title });
    const OUT = 'A clearer first run for new members';
    await check('the archived output in the fictional seed reads "With Nia James"', async () => {
        await go('/outputs');
        await expect(page.locator('.output-card').filter({ hasText: 'Notes from the studio: issue 01' }).locator('.credit-line')).toHaveText('With Nia James');
    });
    await switchPreviewRole(page, 'admin');
    await check('an administrator recognises the contribution, so its author can record an outcome from it', async () => {
        await project('Common Ground');
        await item(WORK).getByLabel('contribution review feedback').fill('Three observed sessions and clear notes.');
        await item(WORK).getByRole('button', { name: 'Recognise contribution', exact: true }).click();
        await expect(item(WORK)).toContainText('recognised');
    });
    await switchPreviewRole(page, 'member');
    await check('the author records an outcome and credits a teammate on it, who is asked first', async () => {
        await go('/outputs');
        await page.getByRole('button', { name: 'Record outcome', exact: true }).click();
        await dialog().getByLabel('Reviewed evidence').selectOption({ label: WORK });
        await dialog().getByLabel('The outcome', { exact: true }).fill(OUT);
        await dialog().locator('[name=summary]').fill('Three observed sessions led to a simpler first screen.');
        await dialog().getByRole('button', { name: 'Submit outcome', exact: true }).click();
        await expect(outcome(OUT)).toContainText('submitted');
        await outcome(OUT).getByRole('button', { name: 'Credit someone…', exact: true }).click();
        await expect(dialog().getByRole('heading', { name: 'Credit someone on this outcome' })).toBeVisible();
        expect(await dialog().getByLabel('Teammate').locator('option').allTextContents()).toEqual(['Choose a teammate', 'Idris Cole']);
        await dialog().getByLabel('Teammate').selectOption({ label: 'Idris Cole' });
        await dialog().getByLabel('What they did (optional)').fill('co-author');
        await neutral(); await a11y('outcome-credit-dialog');
        await dialog().getByRole('button', { name: 'Ask to credit', exact: true }).click();
        await expect(toast()).toContainText('Invitation sent.');
        await expect(outcome(OUT).locator('.credit-list li')).toContainText('Waiting for an answer');
        await expect(outcome(OUT).locator('.credit-line')).toHaveCount(0);
    });
    await switchPreviewRole(page, 'instructor');
    await check('the invitee opens the outcome from the notice before it is reviewed, accepts, and sees it on their profile', async () => {
        await page.locator('a[href="/notifications"]').first().click();
        await page.locator('.notification-row').filter({ hasText: OUT }).click();
        await expect(page.locator('h1')).toHaveText('Made here. Meant something.');
        const prompt = outcome(OUT).locator('.credit-prompt');
        await expect(prompt).toContainText('Alex Morgan would like to credit you on this outcome as co-author');
        await neutral(); await overflow(); await a11y('outcome-invitee');
        await prompt.getByRole('button', { name: 'Accept credit', exact: true }).click();
        await expect(toast()).toContainText('Credit accepted.');
        await expect(outcome(OUT).locator('.credit-line')).toHaveText('With Idris Cole');
        await openProfile(page);
        await expect(page.locator('.credited-on')).toContainText(OUT);
        await expect(page.locator('.credited-on')).toContainText('Outcome recorded by Alex Morgan · not yet reviewed · co-author');
        await expect(page.locator('.panel').filter({ hasText: 'What changed' })).not.toContainText(OUT);
    });
    await switchPreviewRole(page, 'admin');
    await check('an administrator sees the accepted credit, verifies the outcome and publishes it; the output names the credit', async () => {
        await go('/outputs');
        await expect(outcome(OUT).locator('.credit-line')).toHaveText('With Idris Cole');
        await expect(outcome(OUT).locator('.credit-list, .credit-prompt')).toHaveCount(0);
        await outcome(OUT).getByLabel('outcome review feedback').fill('The recognised contribution supports this.');
        await outcome(OUT).getByRole('button', { name: 'Verify outcome', exact: true }).click();
        await expect(outcome(OUT)).toContainText('Community verified');
        await outcome(OUT).getByLabel('Output type').selectOption('software');
        await outcome(OUT).getByRole('button', { name: 'Publish output', exact: true }).click();
        await expect(page.locator('.output-card').filter({ hasText: OUT }).locator('.credit-line')).toHaveText('With Idris Cole');
        await neutral(); await overflow(); await a11y('outputs-credited'); await page.screenshot({ path: dir + '/outputs.png', fullPage: true });
        await page.setViewportSize({ width: 390, height: 900 });
        await overflow(); await neutral();
    });
    expect(errors).toEqual([]);
} finally {
    await writeFile(dir + '/results.json', JSON.stringify({ generatedAt: new Date().toISOString(), method: 'Bundled demo in Chromium with fictional browser-local data.', results, errors }, null, 2));
    await browser.close();
}
