/** Actual bundled React in Chromium with fictional browser-local data. Collections of useful content; no hosted service. */
import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { switchPreviewRole } from './ui-test-helpers';
const root = resolve(import.meta.dirname, '..'), dir = root + '/evidence/collections'; await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: true, args: ['--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 1512, height: 1100 } })).newPage(); page.setDefaultTimeout(10000);
const results: { name: string; passed: boolean }[] = [], errors: string[] = [];
page.on('pageerror', e => errors.push(e.message));
const check = async (name: string, fn: () => Promise<void>) => { await fn(); results.push({ name, passed: true }); console.log('PASS', name); };
const overflow = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
async function a11y(name: string) { const a = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze(); await writeFile(`${dir}/a11y-${name}.json`, JSON.stringify({ violations: a.violations, incomplete: a.incomplete }, null, 2)); expect(a.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([]); }
async function neutral() {
    const failures = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('body *')].flatMap(el => {
        if (!el.getClientRects().length || el.closest('.avatar,.v4-hero-image,.cover-media')) return [];
        const s = getComputedStyle(el);
        return (['color', 'backgroundColor', 'borderTopColor', 'outlineColor', 'accentColor'] as const).flatMap(p => { const m = s[p].match(/^rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/); return m && Math.max(+m[1], +m[2], +m[3]) - Math.min(+m[1], +m[2], +m[3]) > 1 ? [`${el.tagName}.${el.className}: ${p} ${s[p]}`] : []; });
    }).slice(0, 20));
    expect(failures).toEqual([]);
}
const dialog = () => page.locator('dialog[open]');
const go = async (href: string) => { await page.locator(`.sidebar a[href="${href}"]`).first().click(); };
const home = () => go('/');
const collections = async () => { await go('/collections'); await expect(page.getByRole('heading', { name: 'Useful collections.', level: 1 })).toBeVisible(); };
const card = (title: string) => page.locator('.collection-card').filter({ has: page.getByRole('heading', { name: title }) });
try {
    await page.setContent(await readFile(root + '/.preview/REUNIR-preview.html', 'utf8'), { waitUntil: 'load' });
    await check('Home shows the featured collection with only what a member can see', async () => {
        const block = page.locator('.featured-collection');
        await expect(block.getByRole('heading', { name: 'Start here' })).toBeVisible();
        await expect(block.locator('.featured-collection-items li')).toHaveCount(4);
        await expect(block).not.toContainText('Team notes');
        await expect(page.locator('.v4-card-grid')).toBeVisible();
        await neutral(); await a11y('home'); await overflow();
        await page.screenshot({ path: dir + '/home.png' });
    });
    await check('the second sidebar links to collections; a member sees published ones without drafts or private items', async () => {
        await collections();
        await expect(page.locator('.collection-card')).toHaveCount(1);
        await expect(page.getByText('Feedback that helps')).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'New collection' })).toHaveCount(0);
        await card('Start here').getByRole('link', { name: /Open collection · 4 items/ }).click();
        await expect(page.getByRole('heading', { name: 'Start here', level: 1 })).toBeVisible();
        await expect(page.locator('.collection-detail > li')).toHaveCount(4);
        await expect(page.locator('.collection-detail')).toContainText('Read this first: how we look after each other here.');
        await expect(page.locator('.collection-detail')).not.toContainText('Team only');
        await expect(page.getByRole('group', { name: 'Manage this collection' })).toHaveCount(0);
        await neutral(); await a11y('member-collection'); await overflow();
        await page.screenshot({ path: dir + '/member-collection.png' });
        await page.locator('.collection-detail .collection-entry').filter({ hasText: 'Choose one real problem' }).click();
        await expect(page.locator('h1')).toBeVisible();
    });
    await check('saved posts stay on the member’s own Saved page', async () => {
        await go('/discussions');
        await page.locator('.post-card').filter({ hasText: 'Good people. Better things.' }).getByRole('button', { name: 'Save post' }).click();
        await go('/saved');
        await expect(page.locator('.post-card').filter({ hasText: 'Good people. Better things.' })).toHaveCount(1);
        await page.locator('.post-card').filter({ hasText: 'Good people. Better things.' }).getByRole('button', { name: 'Unsave post' }).click();
    });
    await check('the community team sees drafts and which items only some people see', async () => {
        await switchPreviewRole(page, 'admin');
        await collections();
        await expect(page.locator('.collection-card')).toHaveCount(2);
        await expect(card('Feedback that helps').locator('.pill', { hasText: 'Draft' })).toBeVisible();
        await expect(card('Start here').locator('.pill', { hasText: 'On Home' })).toBeVisible();
        await card('Start here').getByRole('link', { name: /Open and manage/ }).click();
        await expect(page.locator('.collection-detail > li')).toHaveCount(5);
        await expect(page.locator('.collection-detail')).toContainText('Only people with access to The studio see this');
        await neutral(); await a11y('team-collection');
    });
    await check('a curator creates a draft, adds items with notes, reorders, publishes and features it', async () => {
        await collections();
        await page.getByRole('button', { name: 'New collection' }).click();
        await dialog().getByLabel('Title').fill('Tools we like');
        await dialog().getByLabel('Short description').fill('Small, useful references.');
        await a11y('new-collection');
        await dialog().getByRole('button', { name: 'Create draft collection' }).click();
        await expect(page.getByRole('heading', { name: 'Tools we like', level: 1 })).toBeVisible();
        await expect(page.locator('.page-heading .eyebrow')).toContainText('DRAFT');
        await page.getByRole('button', { name: 'Publish' }).click();
        await expect(page.getByText('Add something to the collection before publishing it.')).toBeVisible();
        for (const [kind, item, note] of [['Lesson', 'Make it recognisable', 'Short and practical.'], ['Project', 'Common Ground', '']] as const) {
            await page.getByRole('button', { name: 'Add an item' }).click();
            await dialog().getByLabel('Kind of content').selectOption({ label: kind });
            await dialog().getByRole('combobox', { name: /^Item/ }).selectOption({ label: item });
            if (note) await dialog().getByLabel('Note for members (optional)').fill(note);
            if (kind === 'Lesson') await a11y('add-item');
            await dialog().getByRole('button', { name: 'Add to collection' }).click();
            await expect(dialog()).toHaveCount(0);
        }
        await expect(page.locator('.collection-detail .collection-entry strong')).toHaveText(['Make it recognisable', 'Common Ground']);
        await page.getByRole('button', { name: 'Move Common Ground up' }).click();
        await expect(page.locator('.collection-detail .collection-entry strong')).toHaveText(['Common Ground', 'Make it recognisable']);
        await page.getByRole('button', { name: 'Edit the note for Common Ground' }).click();
        await dialog().getByLabel('Note for Common Ground').fill('A team that welcomes first contributions.');
        await dialog().getByRole('button', { name: 'Save note' }).click();
        await expect(page.locator('.collection-detail')).toContainText('A team that welcomes first contributions.');
        await page.getByRole('button', { name: 'Publish' }).click();
        await page.getByRole('button', { name: 'Feature on Home' }).click();
        await expect(page.locator('.page-heading .eyebrow')).toContainText('ON HOME');
        await neutral(); await a11y('curator-collection'); await overflow();
        await page.screenshot({ path: dir + '/curator-collection.png' });
    });
    await check('members then see the newly featured collection on Home', async () => {
        await switchPreviewRole(page, 'member');
        await home();
        await expect(page.locator('.featured-collection').getByRole('heading', { name: 'Tools we like' })).toBeVisible();
        await expect(page.locator('.featured-collection-items strong')).toHaveText(['Common Ground', 'Make it recognisable']);
        await collections();
        await expect(page.locator('.collection-card')).toHaveCount(2);
    });
    await check('returning to draft and deleting take it away from members; the content stays', async () => {
        await switchPreviewRole(page, 'admin');
        await collections();
        await card('Tools we like').getByRole('link', { name: /Open and manage/ }).click();
        await page.getByRole('button', { name: 'Return to draft' }).click();
        await switchPreviewRole(page, 'member');
        await home();
        await expect(page.locator('.featured-collection')).toHaveCount(0);
        await collections();
        await expect(page.getByText('Tools we like')).toHaveCount(0);
        await switchPreviewRole(page, 'admin');
        await collections();
        await card('Tools we like').getByRole('link', { name: /Open and manage/ }).click();
        await page.getByRole('button', { name: 'Delete' }).click();
        await a11y('delete-collection');
        await dialog().getByRole('button', { name: 'Delete collection' }).click();
        await expect(page.getByRole('heading', { name: 'Useful collections.', level: 1 })).toBeVisible();
        await expect(page.getByText('Tools we like')).toHaveCount(0);
        await go('/projects');
        await expect(page.getByText('Common Ground').first()).toBeVisible();
        // Featuring another collection had taken "Start here" off Home; put it back.
        await collections();
        await card('Start here').getByRole('link', { name: /Open and manage/ }).click();
        await page.getByRole('button', { name: 'Feature on Home' }).click();
        await expect(page.getByRole('button', { name: 'Remove from Home' })).toBeVisible();
    });
    await check('collections fit a phone screen', async () => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.locator('.mobile-bottom a[href="/"]').click();
        await overflow(); await a11y('home-mobile');
        await page.getByRole('link', { name: 'See the whole collection' }).click();
        await expect(page.getByRole('heading', { name: 'Start here', level: 1 })).toBeVisible();
        await overflow(); await a11y('collection-mobile');
        await page.screenshot({ path: dir + '/collection-mobile.png', fullPage: true });
        await page.setViewportSize({ width: 1512, height: 1100 });
    });
    await check('collection journeys produced no uncaught browser errors', async () => { expect(errors).toEqual([]); });
    await writeFile(dir + '/results.json', JSON.stringify({ generatedAt: new Date().toISOString(), method: 'Bundled standalone preview in Chromium; fictional browser-local data only.', results, errors }, null, 2));
    console.log(`${results.length} collection browser checks passed`);
} catch (e) {
    await page.screenshot({ path: dir + '/failure.png', fullPage: true }).catch(() => {});
    await writeFile(dir + '/results.json', JSON.stringify({ results, errors, failure: String(e) }, null, 2));
    throw e;
} finally { await browser.close(); }
