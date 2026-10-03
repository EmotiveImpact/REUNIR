/** Actual bundled React in Chromium with fictional browser-local data. Track instructors author and review one track; no hosted service. */
import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { switchPreviewRole } from './ui-test-helpers';
const root = resolve(import.meta.dirname, '..'), dir = root + '/evidence/instructors'; await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: true, args: ['--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 1512, height: 1100 } })).newPage(); page.setDefaultTimeout(10000);
const results: { name: string; passed: boolean }[] = [], errors: string[] = [];
page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
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
const track = async (id: string) => { await go('/paths'); await page.locator('a[href="/learn"]').first().click(); await page.locator(`.track-card[href="/learn/${id}"]`).click(); await expect(page.locator('.track-detail-head h1')).toBeVisible(); };
const editor = () => page.locator('.creator-editor'), toast = () => page.locator('.toast'), dialog = () => page.locator('dialog[open]');
try {
    await page.setContent(await readFile(root + '/.preview/REUNIR-preview.html', 'utf8'), { waitUntil: 'load' });
    await check('a member has no teaching link, studio or cover tools', async () => {
        await expect(page.locator('.sidebar a[href="/teaching"]')).toHaveCount(0);
        await track('track_product');
        await expect(page.getByRole('link', { name: 'Creator studio', exact: true })).toHaveCount(0);
        await expect(page.getByRole('button', { name: /cover|Instructors/ })).toHaveCount(0);
    });
    await switchPreviewRole(page, 'instructor');
    await check('the instructor’s teaching page lists only the track they were given, and is accessible', async () => {
        await go('/teaching');
        await expect(page.locator('h1')).toHaveText('Teach what you know.');
        await expect(page.locator('.teaching-track')).toHaveCount(1);
        await expect(page.locator('.teaching-track')).toContainText('From idea to first version');
        await expect(page.locator('.teaching-track')).toContainText('1 waiting for feedback');
        await neutral(); await overflow(); await a11y('teaching'); await page.screenshot({ path: dir + '/teaching.png', fullPage: true });
    });
    await check('the instructor gives feedback on a written answer from their track', async () => {
        const card = page.locator('.quiz-review > .review-grid .quiz-review-card');
        await expect(card).toHaveCount(1); await expect(card).toContainText('Sofia Chen');
        await card.getByRole('spinbutton').fill('2');
        await card.getByRole('textbox').fill('You watched closely and named one clear change. Next time, say who would notice it first.');
        await card.getByRole('button', { name: 'Send marks and feedback' }).click();
        await expect(toast()).toContainText('Feedback sent.');
        await expect(card).toHaveCount(0);
        await expect(page.locator('.teaching-track')).toContainText('0 waiting for feedback');
    });
    await check('the instructor writes and publishes a lesson on their own track', async () => {
        await page.getByRole('link', { name: 'Open Creator studio for From idea to first version', exact: true }).click();
        await page.getByRole('button', { name: 'New lesson draft', exact: true }).click();
        await editor().getByLabel('Lesson title', { exact: true }).fill('Book five conversations');
        await editor().getByLabel('Lesson summary', { exact: true }).fill('Turn the problem into five short calls this week.');
        await editor().getByLabel('Lesson body', { exact: true }).fill('Write to five people who have the problem.\n\nAsk about the last time it happened. Take notes in their words.');
        await editor().getByRole('button', { name: 'Save draft', exact: true }).click(); await expect(editor()).toContainText('Saved privately');
        await editor().getByRole('button', { name: 'Publish saved lesson', exact: true }).click(); await expect(editor()).toContainText('matches the published lesson');
        await expect(page.locator('.creator-title').last()).toContainText('Book five conversations');
        await neutral(); await a11y('instructor-studio');
    });
    await check('another track shows the instructor no studio, cover or instructor tools', async () => {
        await track('track_story');
        await expect(page.locator('.detail-tools')).toHaveCount(0);
        await track('track_product');
        await expect(page.getByRole('link', { name: 'Creator studio', exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: /cover/ })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Instructors', exact: true })).toHaveCount(0, { timeout: 1000 });
    });
    await switchPreviewRole(page, 'admin');
    await check('an administrator adds and removes an instructor from an accessible dialogue', async () => {
        await track('track_story');
        await page.getByRole('button', { name: 'Instructors', exact: true }).click();
        await expect(dialog().getByRole('heading', { name: 'Track instructors' })).toBeVisible();
        await expect(dialog()).toContainText('No instructors yet.');
        await dialog().getByLabel('Add someone to teach').selectOption({ label: 'Maya Bennett' });
        await dialog().getByRole('button', { name: 'Add', exact: true }).click();
        await expect(toast()).toContainText('Maya Bennett can now author and review Stories that make people feel.');
        await expect(dialog().locator('.instructor-list li')).toHaveCount(1);
        await expect(dialog().locator('.instructor-list li')).toContainText('Instructor · added by Amina Okafor');
        await neutral(); await a11y('instructors-dialog'); await dialog().screenshot({ path: dir + '/instructors-dialog.png' });
        await dialog().getByRole('button', { name: 'Remove Maya Bennett from this track', exact: true }).click();
        await expect(dialog()).toContainText('No instructors yet.');
        await dialog().getByRole('button', { name: 'Done', exact: true }).click(); await expect(dialog()).toHaveCount(0);
    });
    await check('an administrator adds a contributor and later makes them an instructor', async () => {
        await page.getByRole('button', { name: 'Instructors', exact: true }).click();
        await dialog().getByLabel('Add someone to teach').selectOption({ label: 'Maya Bennett' });
        await dialog().getByLabel('Role', { exact: true }).selectOption('contributor');
        await dialog().getByRole('button', { name: 'Add', exact: true }).click();
        await expect(toast()).toContainText('Maya Bennett can now write drafts for Stories that make people feel. Instructors publish them.');
        await expect(dialog().locator('.instructor-list li')).toContainText('Contributor · added by Amina Okafor');
        await neutral(); await a11y('contributor-dialog');
        await dialog().getByLabel('Role for Maya Bennett').selectOption('instructor');
        await expect(dialog().locator('.instructor-list li')).toContainText('Instructor · added by Amina Okafor');
        await dialog().getByRole('button', { name: 'Remove Maya Bennett from this track', exact: true }).click();
        await expect(dialog()).toContainText('No instructors yet.');
        await dialog().getByRole('button', { name: 'Done', exact: true }).click(); await expect(dialog()).toHaveCount(0);
    });
    await check('an administrator invites someone new by email to teach the track; the preview sends nothing', async () => {
        await page.getByRole('button', { name: 'Instructors', exact: true }).click();
        await dialog().getByLabel('Invite someone new to teach').fill('new.teacher@example.test');
        await expect(dialog().getByText('They join Code Black as a member and teach Stories that make people feel only.')).toBeVisible();
        await dialog().getByRole('button', { name: 'Invite', exact: true }).click();
        await expect(dialog().getByRole('status')).toHaveText('A fictional invitation for new.teacher@example.test was recorded. The preview never sends email.');
        await neutral(); await a11y('instructors-invite');
        await dialog().getByRole('button', { name: 'Done', exact: true }).click(); await expect(dialog()).toHaveCount(0);
        await go('/access');
        await expect(page.locator('.invite-row', { hasText: 'new.teacher@example.test' })).toContainText('To teach Stories that make people feel');
    });
    await check('the instructor’s review is on record for the owner too', async () => {
        await go('/admin'); await page.getByRole('button', { name: /^Knowledge checks · \d+$/ }).click();
        await expect(page.locator('.quiz-review details').filter({ hasText: 'Reviewed' }).locator('summary')).toContainText('1');
    });
    await switchPreviewRole(page, 'instructor');
    await check('390px: the teaching page stays readable without horizontal overflow', async () => {
        await page.setViewportSize({ width: 390, height: 844 });
        await go('/teaching'); await expect(page.locator('h1')).toHaveText('Teach what you know.');
        await overflow(); await neutral(); await a11y('teaching-mobile'); await page.screenshot({ path: dir + '/teaching-mobile.png' });
    });
    await check('no uncaught browser errors in the instructor journey', async () => { expect(errors).toEqual([]); });
    await writeFile(dir + '/browser-results.json', JSON.stringify({ method: 'Bundled React in local Chromium, fictional state; not hosted acceptance.', results, errors }, null, 2));
    console.log(`${results.length} instructor browser checks passed`);
} catch (e) {
    await page.screenshot({ path: dir + '/failure.png', fullPage: true }).catch(() => {});
    await writeFile(dir + '/browser-results.json', JSON.stringify({ results, errors, failure: String(e) }, null, 2)); throw e;
} finally { await browser.close(); }
