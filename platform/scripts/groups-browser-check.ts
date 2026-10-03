/** Actual bundled React in Chromium with fictional browser-local data. Group conversations in the inbox (Alpha 24). */
import { switchPreviewRole } from './ui-test-helpers';
import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..'), dir = root + '/evidence/groups'; await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: true, args: ['--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 1512, height: 1050 } })).newPage(); page.setDefaultTimeout(10000);
const results: { name: string; passed: boolean }[] = [], errors: string[] = [];
page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
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
const nav = async (to: string) => { if ((page.viewportSize()?.width || 1512) < 1000 && !await page.locator('.sidebar').evaluate(el => el.classList.contains('open'))) await page.getByRole('button', { name: 'Open navigation', exact: true }).click(); await page.locator(`.sidebar a[href="${to}"]`).first().click(); };
const thread = (name: string | RegExp) => page.locator('.inbox-list .inbox-person').filter({ hasText: name });
const send = async (text: string) => { await page.getByLabel('Your message', { exact: true }).fill(text); await page.getByRole('button', { name: 'Send message', exact: true }).click(); await expect(page.locator('.message-bubble p').filter({ hasText: text })).toBeVisible(); };
const pick = async (name: string) => { await dialog().getByRole('checkbox', { name: new RegExp(name) }).check(); };
try {
    await page.setContent(await readFile(root + '/.preview/REUNIR-preview.html', 'utf8'), { waitUntil: 'load' });
    await check('the inbox offers a new group beside a new message', async () => {
        await nav('/messages'); await expect(page.locator('h1')).toHaveText('A little closer.');
        await page.getByRole('button', { name: 'New group', exact: true }).click();
        await expect(dialog().getByRole('heading', { name: 'Start a group' })).toBeVisible();
        await expect(dialog()).toContainText('anyone you add later reads only what is written after they join');
        await expect(dialog().getByRole('button', { name: 'Start group' })).toBeDisabled();
        await neutral(); await a11y('new-group'); await page.screenshot({ path: dir + '/new-group.png' });
    });
    await check('a group needs a name and two other people', async () => {
        await dialog().getByLabel('Group name').fill('Open studio crew');
        await pick('Theo Williams'); await expect(dialog().getByRole('button', { name: 'Start group' })).toBeDisabled();
        await pick('Amina Okafor'); await expect(dialog().getByRole('button', { name: 'Start group' })).toBeEnabled();
        await dialog().getByRole('button', { name: 'Start group' }).click(); await expect(dialog()).toHaveCount(0);
        await expect(page.locator('.thread-heading')).toContainText('Open studio crew');
        await expect(page.locator('.thread-heading')).toContainText('3 people · only people in this group can read it');
        await expect(page.locator('.thread-privacy')).toContainText('Private to the people in this group.');
        await expect(page.getByRole('button', { name: 'Block', exact: true })).toHaveCount(0);
    });
    await check('a message reaches the group and the inbox lists it by name', async () => {
        await send('Who is bringing work to the open studio on Thursday?');
        await expect(thread('Open studio crew')).toContainText('Who is bringing work');
        await page.getByLabel('Find a conversation').fill('Theo'); await expect(thread('Open studio crew')).toBeVisible();
        await page.getByLabel('Find a conversation').fill('');
        await neutral(); await a11y('group-thread'); await page.screenshot({ path: dir + '/group-thread.png' });
    });
    await check('another person in the group sees who wrote each message and replies', async () => {
        await switchPreviewRole(page, 'admin'); await nav('/messages');
        await thread('Open studio crew').click();
        await expect(page.locator('.message-row.theirs .message-sender').first()).toHaveText('Alex Morgan');
        await send('I will bring the new onboarding sketches.');
    });
    await check('the people dialogue lists everyone and only the starter can remove', async () => {
        await page.getByRole('button', { name: 'People', exact: true }).click();
        await expect(dialog().getByRole('list', { name: 'Group members' }).locator('li')).toHaveCount(3);
        await expect(dialog()).toContainText('Started this group');
        await expect(dialog().getByRole('button', { name: /^Remove/ })).toHaveCount(0);
        await dialog().getByRole('button', { name: 'Close dialogue' }).click();
        await switchPreviewRole(page, 'member'); await nav('/messages'); await thread('Open studio crew').click();
        // The demo keeps a thread it read moments ago for 30 seconds, as the live inbox does between polls.
        await page.getByRole('button', { name: 'Refresh messages', exact: true }).click();
        await expect(page.locator('.message-row.theirs .message-sender').first()).toHaveText('Amina Okafor');
        await page.getByRole('button', { name: 'People', exact: true }).click();
        await expect(dialog().getByRole('button', { name: /^Remove/ })).toHaveCount(2);
        await a11y('group-people');
    });
    await check('adding someone later and renaming the group', async () => {
        await dialog().getByRole('button', { name: 'Add people', exact: true }).click();
        await expect(dialog()).toContainText('They will read only what is written after they join.');
        await pick('Jordan Ellis'); await dialog().getByRole('button', { name: 'Add to group' }).click();
        await expect(page.getByText('One person added.')).toBeVisible();
        await expect(dialog().getByRole('list', { name: 'Group members' }).locator('li')).toHaveCount(4);
        await dialog().locator('#group-title').fill('Thursday critique'); await dialog().getByRole('button', { name: 'Rename' }).click();
        await expect(page.getByText('Group renamed.')).toBeVisible();
        await dialog().getByRole('button', { name: 'Close dialogue' }).click();
        await expect(page.locator('.thread-heading')).toContainText('Thursday critique');
        await expect(page.locator('.thread-heading')).toContainText('4 people');
    });
    await check('the starter removes someone; their place goes but the thread stays', async () => {
        await page.getByRole('button', { name: 'People', exact: true }).click();
        await dialog().getByRole('button', { name: 'Remove Jordan Ellis' }).click();
        await expect(dialog().getByRole('list', { name: 'Group members' }).locator('li')).toHaveCount(3);
        await dialog().getByRole('button', { name: 'Close dialogue' }).click();
    });
    await check('direct threads are unchanged and still offer blocking', async () => {
        await thread('Amina Okafor').click();
        await expect(page.getByRole('button', { name: 'Block', exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: 'People', exact: true })).toHaveCount(0);
    });
    await check('the group and its dialogues fit a phone screen', async () => {
        await page.setViewportSize({ width: 390, height: 844 });
        await nav('/messages'); await overflow(); await thread('Thursday critique').click(); await overflow();
        await page.getByRole('button', { name: 'People', exact: true }).click(); await overflow(); await a11y('group-people-mobile');
        await page.screenshot({ path: dir + '/group-mobile.png' });
        await dialog().getByRole('button', { name: 'Close dialogue' }).click();
        await page.setViewportSize({ width: 1512, height: 1050 });
    });
    await check('leaving takes the group out of the inbox', async () => {
        await page.getByRole('button', { name: 'People', exact: true }).click();
        await dialog().getByRole('button', { name: 'Leave group' }).click();
        await expect(page.getByText('You left the group.')).toBeVisible();
        await expect(thread('Thursday critique')).toHaveCount(0);
        await switchPreviewRole(page, 'admin'); await nav('/messages');
        // Amina's inbox may still hold the name it read under 30 seconds ago; refreshing the thread brings both up to date.
        await thread(/Open studio crew|Thursday critique/).click();
        await page.getByRole('button', { name: 'Refresh messages', exact: true }).click();
        await expect(page.locator('.thread-heading')).toContainText('Thursday critique');
        await expect(page.locator('.thread-heading')).toContainText('2 people');
        await expect(page.locator('.thread-body')).toContainText('Who is bringing work', { useInnerText: true });
    });
    await check('group journeys produced no uncaught browser errors', async () => { expect(errors).toEqual([]); });
    await writeFile(dir + '/results.json', JSON.stringify({ generatedAt: new Date().toISOString(), method: 'Bundled standalone preview in Chromium; fictional browser-local data only.', results, errors }, null, 2));
    console.log(`${results.length} group conversation browser checks passed`);
} catch (e) {
    await page.screenshot({ path: dir + '/failure.png', fullPage: true }).catch(() => {});
    await writeFile(dir + '/results.json', JSON.stringify({ results, errors, failure: String(e) }, null, 2));
    throw e;
} finally { await browser.close(); }
