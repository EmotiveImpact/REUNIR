/**
 * Actual bundled React in Chromium with fictional browser-local data: a busy community whose feeds and archived tasks
 * load a page at a time. The preview is served at a stand-in address inside this browser so it has its own storage;
 * nothing leaves the machine.
 */
import { chromium, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createSeed, DEMO_USER } from '../packages/domain/src/seed';
import { visibleRecords } from '../packages/domain/src/engine';

const root = resolve(import.meta.dirname, '..'), dir = root + '/evidence/paging'; await mkdir(dir, { recursive: true });
const ORG = 'org_code_black';
const at = (n: number) => new Date(Date.UTC(2026, 8, 1) + n * 60000).toISOString();
// 60 fictional posts older than the seeded ones (a resource every fifth), and 25 archived tasks on Common Ground.
const state = createSeed();
for (let i = 0; i < 60; i++) state.posts.push({ id: `busy_${String(i).padStart(2, '0')}`, organizationId: ORG, createdAt: at(i), spaceId: i % 2 ? 'space_build' : 'space_general', authorId: 'member_maya', kind: i % 5 ? 'update' : 'resource', title: `Fictional post ${i}`, body: 'A fictional post for the paging check.', pinned: false, hidden: false, cover: '' });
state.comments.push({ id: 'busy_reply', organizationId: ORG, createdAt: at(2), postId: 'busy_02', authorId: 'member_theo', body: 'An early reply that only travels with its post.' });
const template = state.projectTasks.find(t => t.id === 'task_empty')!;
for (let i = 0; i < 25; i++) state.projectTasks.push({ ...structuredClone(template), id: `old_task_${String(i).padStart(2, '0')}`, title: `Archived piece ${i}`, createdAt: at(i), archived: true });
// What Alex, the demo member, can see: the counts the screens must show.
const visible = visibleRecords(state, { organizationId: ORG, userId: DEMO_USER, requestId: 'paging-check' }).posts;
const posts = visible.length, pinned = visible.filter(p => p.pinned).length;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1512, height: 1100 } });
const html = await readFile(root + '/.preview/REUNIR-preview.html', 'utf8');
await context.route('http://reunir-preview.test/**', route => route.fulfill({ status: 200, contentType: 'text/html', body: html }));
await context.addInitScript(([key, value]) => { if (!localStorage.getItem(key)) localStorage.setItem(key, value); }, ['reunir.alpha1.v1.code-black', JSON.stringify(state)] as [string, string]);
const page = await context.newPage(); page.setDefaultTimeout(10000);
const results: { name: string; passed: boolean }[] = [], errors: string[] = [];
page.on('pageerror', e => errors.push(e.message));
const check = async (name: string, fn: () => Promise<void>) => { await fn(); results.push({ name, passed: true }); console.log('PASS', name); };
const overflow = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
async function a11y(name: string) { const a = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze(); await writeFile(`${dir}/a11y-${name}.json`, JSON.stringify({ violations: a.violations, incomplete: a.incomplete }, null, 2)); expect(a.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([]); }
async function neutral() {
    const failures = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('body *')].flatMap(el => {
        if (!el.getClientRects().length) return [];
        const s = getComputedStyle(el);
        return (['color', 'backgroundColor', 'borderTopColor'] as const).flatMap(p => { const m = s[p].match(/^rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/); return m && Math.max(+m[1], +m[2], +m[3]) - Math.min(+m[1], +m[2], +m[3]) > 12 ? [`${el.tagName}.${el.className} ${p} ${s[p]}`] : []; });
    }).slice(0, 20));
    expect(failures).toEqual([]);
}
const go = async (p: Page, hash: string) => { await p.goto('http://reunir-preview.test/#' + hash, { waitUntil: 'load' }); };
const cards = () => page.locator('.post-list > .post-card');
const more = () => page.locator('.review-more');

try {
    await check('the conversation opens with one page of posts and an exact total', async () => {
        await go(page, '/discussions');
        await expect(page.locator('.feed-heading h2 span')).toHaveText(String(posts));
        await expect(cards()).toHaveCount(20 + pinned);
        await expect(more()).toContainText(`Showing ${20 + pinned} of ${posts} posts.`);
        await neutral(); await a11y('feed'); await overflow();
        await page.screenshot({ path: dir + '/feed.png' });
    });
    await check('“Show older posts” adds the next page and moves focus to the first new post', async () => {
        await more().getByRole('button', { name: 'Show older posts', exact: true }).click();
        await expect(cards()).toHaveCount(40 + pinned);
        await expect(cards().nth(20 + pinned)).toBeFocused();
        while (await more().count()) { const before = await cards().count(); await more().getByRole('button', { name: 'Show older posts', exact: true }).click(); await expect(cards()).not.toHaveCount(before); }
        await expect(cards()).toHaveCount(posts);
        await expect(more()).toHaveCount(0);
        await expect(page.locator('#post-busy_00')).toBeVisible();
    });
    await check('appreciating an old post keeps every page in place', async () => {
        const old = page.locator('#post-busy_01');
        await old.getByRole('button', { name: 'Appreciate post' }).click();
        await expect(old.getByRole('button', { name: 'Remove appreciation' })).toContainText('1');
        await expect(cards()).toHaveCount(posts);
    });
    await check('filters page from the server too', async () => {
        await page.getByRole('group', { name: 'Filter posts' }).getByRole('button', { name: 'Resources', exact: true }).click();
        const resources = visible.filter(p => p.kind === 'resource').length;
        await expect(page.locator('.feed-heading h2 span')).toHaveText(String(resources));
        await expect(cards()).toHaveCount(resources);
    });
    await check('an old post opens on its own page with its replies, and a reply can be added', async () => {
        await go(page, '/post/busy_02');
        await expect(page.getByRole('heading', { name: 'Fictional post 2' })).toBeVisible();
        await expect(page.locator('.comments-panel')).toContainText('An early reply that only travels with its post.');
        await page.getByLabel('Add your perspective').fill('A fictional reply to an old post.');
        await page.getByRole('button', { name: 'Publish reply' }).click();
        await expect(page.locator('.comments-panel')).toContainText('A fictional reply to an old post.');
        await expect(page.locator('.comments-panel h2')).toHaveText('2 perspectives');
        await a11y('old-post'); await overflow();
    });
    await check('a post nobody can see says so', async () => {
        await go(page, '/post/no_such_post');
        await expect(page.getByRole('heading', { name: 'That conversation is not available.' })).toBeVisible();
    });
    await check('resources in Knowledge page from the server', async () => {
        await go(page, '/knowledge');
        await expect(page.locator('.post-list > .post-card')).toHaveCount(visible.filter(p => p.kind === 'resource' && !p.hidden).length);
    });
    await check('archived tasks open a page at a time on the board', async () => {
        await go(page, '/projects/project_common/work');
        await expect(page.locator('.work-board .work-card')).toHaveCount(4);
        await page.getByRole('button', { name: 'Archive', exact: true }).click();
        await expect(page.locator('.work-card')).toHaveCount(20);
        await expect(more()).toContainText('Showing 20 of 25 archived tasks.');
        await more().getByRole('button', { name: 'Show older archived tasks', exact: true }).click();
        await expect(page.locator('.work-card')).toHaveCount(25);
        await expect(more()).toHaveCount(0);
        await neutral(); await a11y('archive'); await overflow();
        await page.screenshot({ path: dir + '/archive.png' });
    });
    await check('a link to an archived task opens it with its details', async () => {
        await go(page, '/projects/project_common/work?task=old_task_03');
        await expect(page.getByRole('dialog').getByRole('heading', { name: 'Archived piece 3' })).toBeVisible();
        await expect(page.getByRole('dialog').locator('.task-detail-meta')).toContainText('Archived');
    });
    await check('the feed fits a phone screen', async () => {
        await page.setViewportSize({ width: 390, height: 844 });
        await go(page, '/discussions'); await expect(cards()).not.toHaveCount(0); await overflow(); await a11y('feed-mobile');
        await page.setViewportSize({ width: 1512, height: 1100 });
    });
    await check('paging journeys produced no uncaught browser errors', async () => { expect(errors).toEqual([]); });
    await writeFile(dir + '/results.json', JSON.stringify({ generatedAt: new Date().toISOString(), method: 'Bundled standalone preview in Chromium at a stand-in address; fictional browser-local data only.', results, errors }, null, 2));
    console.log(`${results.length} paging browser checks passed`);
} catch (e) {
    await page.screenshot({ path: dir + '/failure.png', fullPage: true }).catch(() => {});
    await writeFile(dir + '/results.json', JSON.stringify({ results, errors, failure: String(e) }, null, 2));
    throw e;
} finally { await browser.close(); }
