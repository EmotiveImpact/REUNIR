/** Actual bundled React in Chromium with fictional browser-local data. Notification settings stay in this page. */
import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..'), dir = root + '/evidence/notifications'; await mkdir(dir, { recursive: true });
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
const notices = async () => { await page.locator('a.notification-button').first().click(); await expect(page.getByRole('heading', { name: 'A little heads-up.', level: 1 })).toBeVisible(); };
const settings = async () => { await page.getByRole('button', { name: 'Notification settings', exact: true }).click(); await expect(dialog().getByRole('heading', { name: 'Notification settings' })).toBeVisible(); };
try {
    await page.setContent(await readFile(root + '/.preview/REUNIR-preview.html', 'utf8'), { waitUntil: 'load' });
    await check('the settings start with every topic on, no digest, and say the demo never emails', async () => {
        await notices(); await settings();
        for (const topic of ['Conversations', 'Learning', 'Projects', 'Events']) await expect(dialog().getByRole('checkbox', { name: new RegExp(topic) })).toBeChecked();
        await expect(dialog().getByRole('radio', { name: 'No email digest' })).toBeChecked();
        await expect(dialog()).toContainText('Changes to your role, access or ownership. These always arrive.');
        await expect(dialog().getByRole('status')).toHaveText('The browser demo never sends email. Your choice is saved for when email is set up.');
        await neutral(); await a11y('settings'); await overflow();
        await page.screenshot({ path: dir + '/settings.png' });
    });
    await check('turning topics off and choosing a digest is saved and shown again', async () => {
        await dialog().getByRole('checkbox', { name: /Conversations/ }).uncheck();
        await dialog().getByRole('checkbox', { name: /Events/ }).uncheck();
        await dialog().getByRole('radio', { name: 'Weekly digest' }).check();
        await dialog().getByRole('button', { name: 'Save notification settings' }).click();
        await expect(dialog()).toHaveCount(0);
        await expect(page.getByText(/Notification settings saved\. A weekly email digest/)).toBeVisible();
        await settings();
        await expect(dialog().getByRole('checkbox', { name: /Conversations/ })).not.toBeChecked();
        await expect(dialog().getByRole('checkbox', { name: /Events/ })).not.toBeChecked();
        await expect(dialog().getByRole('checkbox', { name: /Learning/ })).toBeChecked();
        await expect(dialog().getByRole('radio', { name: 'Weekly digest' })).toBeChecked();
        await dialog().getByRole('button', { name: 'Close dialogue' }).click();
    });
    await check('earlier notices stay after muting', async () => {
        await expect(page.locator('.notification-row')).not.toHaveCount(0);
        await expect(page.locator('.notification-row', { hasText: 'The studio is open' })).toBeVisible();
    });
    await check('the page and dialogue fit a phone screen', async () => {
        await page.setViewportSize({ width: 390, height: 844 });
        await overflow(); await settings(); await overflow(); await a11y('settings-mobile');
        await page.screenshot({ path: dir + '/settings-mobile.png' });
        await dialog().getByRole('button', { name: 'Close dialogue' }).click();
        await page.setViewportSize({ width: 1512, height: 1100 });
    });
    await check('notification journeys produced no uncaught browser errors', async () => { expect(errors).toEqual([]); });
    await writeFile(dir + '/results.json', JSON.stringify({ generatedAt: new Date().toISOString(), method: 'Bundled standalone preview in Chromium; fictional browser-local data only.', results, errors }, null, 2));
    console.log(`${results.length} notification browser checks passed`);
} catch (e) {
    await page.screenshot({ path: dir + '/failure.png', fullPage: true }).catch(() => {});
    await writeFile(dir + '/results.json', JSON.stringify({ results, errors, failure: String(e) }, null, 2));
    throw e;
} finally { await browser.close(); }
