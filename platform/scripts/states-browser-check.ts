/** Loading, error and empty screens in the bundled React demo, in Chromium, with fictional browser-local data only. */
import { chromium, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createSeed, DEMO_USER } from '../packages/domain/src/seed';
import { switchPreviewRole, openProfile } from './ui-test-helpers';
const root = resolve(import.meta.dirname, '..'), dir = root + '/evidence/states'; await mkdir(dir, { recursive: true });
// The same bundled preview, served at a stand-in address inside this browser so addresses (and so unknown routes) work. Nothing leaves the machine.
const ORIGIN = 'http://reunir-preview.test/', html = await readFile(root + '/.preview/REUNIR-preview.html', 'utf8');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: true, args: ['--no-sandbox'] });
const results: { name: string; passed: boolean }[] = [], errors: string[] = [];
const check = async (name: string, fn: () => Promise<void>) => { await fn(); results.push({ name, passed: true }); console.log('PASS', name); };
async function open(setup?: (page: Page) => Promise<unknown>) {
    const context = await browser.newContext({ viewport: { width: 1512, height: 1100 } }), page = await context.newPage(); page.setDefaultTimeout(10000);
    page.on('pageerror', e => errors.push(e.message));
    await page.route(ORIGIN + '**', route => route.fulfill({ status: 200, contentType: 'text/html', body: html }));
    await setup?.(page);
    await page.goto(ORIGIN, { waitUntil: 'load' }); await expect(page.locator('.sidebar')).toBeVisible();
    return page;
}
// Moving within the app without reloading it, as a link would.
const go = async (page: Page, path: string) => { await page.evaluate(p => { location.hash = '#' + p; }, path); };
const overflow = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
async function a11y(page: Page, name: string) { const a = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze(); await writeFile(`${dir}/a11y-${name}.json`, JSON.stringify({ violations: a.violations, incomplete: a.incomplete }, null, 2)); expect(a.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([]); }
async function neutral(page: Page) {
    const failures = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('body *')].flatMap(el => {
        if (!el.getClientRects().length) return [];
        const s = getComputedStyle(el);
        return (['color', 'backgroundColor', 'borderTopColor', 'outlineColor', 'accentColor'] as const).flatMap(p => { const m = s[p].match(/^rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/); return m && Math.max(+m[1], +m[2], +m[3]) - Math.min(+m[1], +m[2], +m[3]) > 1 ? [`${el.tagName}.${el.className}: ${p} ${s[p]}`] : []; });
    }).slice(0, 20));
    expect(failures).toEqual([]);
}
const empty = (page: Page, title: string) => page.locator('.empty-state').filter({ has: page.getByRole('heading', { name: title, exact: true }) });

// A community on its first day: one question, no events, no notices, no tasks and an empty inbox. Fictional data only.
const firstDay = createSeed('code-black');
const kept = firstDay.posts.find(p => p.id === 'post_maya')!;
firstDay.posts = [kept]; firstDay.comments = firstDay.comments.filter(c => c.postId === kept.id); firstDay.reactions = firstDay.reactions.filter(r => r.postId === kept.id); firstDay.bookmarks = []; firstDay.reports = [];
firstDay.events = []; firstDay.rsvps = []; firstDay.notifications = []; firstDay.projectTasks = []; firstDay.taskNotes = [];
const memberProject = firstDay.projects.find(p => firstDay.projectMembers.some(m => m.projectId === p.id && m.userId === DEMO_USER) && p.ownerId !== DEMO_USER);
const emptySpace = firstDay.spaces.find(s => s.visibility !== 'private' && s.id !== kept.spaceId)!;
const emptyInbox = { threads: [], messages: [], read: {}, blocks: [], reports: [], keys: {} };

try {
    const page = await open();
    await check('an unknown address shows a real Not found page inside the shell, with a way home', async () => {
        await go(page, '/no-such-place');
        await expect(page.getByRole('heading', { name: 'We could not find that page.', level: 1 })).toBeVisible();
        await expect(page.locator('.not-found')).toContainText('/no-such-place');
        await expect(page.locator('.sidebar .primary-nav')).toBeVisible();
        await neutral(page); await a11y(page, 'not-found'); await overflow(page);
        await page.screenshot({ path: dir + '/not-found.png' });
        await page.locator('.not-found').getByRole('link', { name: 'Go to your home' }).click();
        await expect(page.locator('.not-found')).toHaveCount(0);
    });
    await check('a page that fails to display keeps the navigation, explains itself, reassures and recovers with Retry', async () => {
        await go(page, '/states/fault');
        const failure = page.getByRole('alert').filter({ has: page.getByRole('heading', { name: 'This page ran into a problem.' }) });
        await expect(failure).toBeVisible();
        await expect(failure).toContainText('Your saved demo data has not been deleted.');
        await expect(page.locator('.sidebar .primary-nav')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Account menu', exact: true })).toBeVisible();
        const detail = failure.locator('details');
        await expect(detail).not.toHaveAttribute('open', /.*/);
        await detail.locator('summary').click(); await expect(detail).toContainText('A simulated display fault in the fictional demo.');
        await neutral(page); await a11y(page, 'page-error'); await overflow(page);
        await page.screenshot({ path: dir + '/page-error.png' });
        await failure.getByRole('button', { name: 'Try again' }).click();
        await expect(empty(page, 'The page recovered.')).toBeVisible();
        await page.getByRole('button', { name: 'Simulate the problem again' }).click();
        await expect(failure).toBeVisible();
        // Moving to another page clears the failure.
        await page.locator('.sidebar a[href="#/projects"]').click();
        await expect(page.getByRole('heading', { name: 'Good things are taking shape.', level: 1 })).toBeVisible();
        await expect(failure).toHaveCount(0);
    });
    await check('going offline shows a calm notice; the demo keeps working; coming back says so', async () => {
        await page.context().setOffline(true);
        const notice = page.locator('.state-banner[data-state="offline"]');
        await expect(notice).toBeVisible(); await expect(notice).toHaveAttribute('role', 'status');
        await expect(notice).toContainText('You are offline. This fictional demo keeps working in your browser. Nothing is sent anywhere.');
        await neutral(page); await a11y(page, 'offline'); await overflow(page);
        await page.screenshot({ path: dir + '/offline.png' });
        await page.context().setOffline(false);
        await expect(notice).toHaveCount(0);
        await expect(page.locator('.toast')).toContainText('You are back online.');
    });
    await check('a refused command is shown as a failure, nothing is saved and the form keeps what was typed', async () => {
        await openProfile(page);
        await page.getByRole('button', { name: 'Edit profile' }).click();
        const dialog = page.locator('dialog[open]');
        await dialog.getByLabel('Name').fill('   ');
        await dialog.getByLabel('What do you do?').fill('A headline that should not be saved');
        await dialog.getByRole('button', { name: 'Save profile' }).click();
        await expect(page.locator('.toast.error')).toContainText('Nothing was saved. Fill in the name and try again.');
        await expect(dialog).toBeVisible(); await expect(dialog.getByLabel('What do you do?')).toHaveValue('A headline that should not be saved');
        await a11y(page, 'failed-command');
        await dialog.getByRole('button', { name: 'Close dialogue' }).click();
        await expect(page.getByRole('heading', { name: 'Alex Morgan', level: 1 })).toBeVisible();
        await expect(page.locator('.profile-identity')).not.toContainText('A headline that should not be saved');
    });
    await check('a search that finds no one says so and offers to clear it', async () => {
        await go(page, '/members');
        await page.getByLabel('Search members and skills').fill('zzzz-nobody');
        await expect(empty(page, 'No one matches that search.')).toBeVisible();
        await a11y(page, 'members-no-results');
        await page.getByRole('button', { name: 'Clear the search' }).click();
        await expect(page.locator('.member-card').first()).toBeVisible();
    });
    await page.context().close();

    const day = await open(async p => p.addInitScript(([state, inbox]) => {
        if (!localStorage.getItem('reunir.alpha1.v1.code-black')) localStorage.setItem('reunir.alpha1.v1.code-black', state);
        if (!localStorage.getItem('reunir.chat.v1.code-black')) localStorage.setItem('reunir.chat.v1.code-black', inbox);
    }, [JSON.stringify(firstDay), JSON.stringify(emptyInbox)] as [string, string]));
    await check('a filter with no matches is told apart from an empty community, and can be cleared', async () => {
        await go(day, '/discussions');
        await day.getByRole('group', { name: 'Filter posts' }).getByRole('button', { name: 'Resources' }).click();
        await expect(empty(day, 'Nothing of this kind here yet.')).toBeVisible();
        await day.getByRole('button', { name: 'Show everything' }).click();
        await expect(day.locator('.post-card')).toHaveCount(1);
    });
    await check('an empty space invites the first post', async () => {
        await go(day, '/spaces/' + emptySpace.id);
        await expect(empty(day, 'Room for a first thought.')).toBeVisible();
        await neutral(day); await a11y(day, 'first-post');
        await day.getByRole('button', { name: 'Write the first post' }).click();
        await expect(day.locator('dialog[open]')).toBeVisible();
        await day.locator('dialog[open]').getByRole('button', { name: 'Close dialogue' }).click();
    });
    await check('no events: a member is told honestly, and only an administrator is offered to plan one', async () => {
        await go(day, '/events');
        await expect(empty(day, 'Keep a little space in the diary.')).toContainText('No upcoming events yet.');
        await expect(day.getByRole('button', { name: 'Plan the next event' })).toHaveCount(0);
        await a11y(day, 'no-events-member');
        await day.getByRole('button', { name: 'I am going' }).click();
        await expect(empty(day, 'Nothing in your diary yet.')).toBeVisible();
        await switchPreviewRole(day, 'admin'); await go(day, '/events');
        await expect(day.getByRole('button', { name: 'Plan the next event' })).toBeVisible();
        await switchPreviewRole(day, 'member');
    });
    await check('no notices and an empty inbox each say what will appear there', async () => {
        await go(day, '/notifications');
        await expect(empty(day, 'A quiet moment.')).toBeVisible();
        await a11y(day, 'no-notices');
        await go(day, '/messages');
        await expect(empty(day, 'Your next collaborator?')).toBeVisible();
        await a11y(day, 'empty-inbox');
        await day.getByRole('button', { name: 'Write a first message' }).click();
        const dialog = day.locator('dialog[open]');
        await dialog.getByLabel('Find a member to message').fill('zzzz-nobody');
        await expect(dialog.getByRole('heading', { name: 'No one matches that name.' })).toBeVisible();
        await dialog.getByRole('button', { name: 'Close dialogue' }).click();
    });
    await check('a project with no tasks: only a lead or administrator is offered to add the first one', async () => {
        if (memberProject) {
            await go(day, `/projects/${memberProject.id}/work`);
            await expect(empty(day, 'No tasks yet.')).toContainText('The project lead adds the first piece of work.');
            await expect(day.getByRole('button', { name: 'Add the first task' })).toHaveCount(0);
        }
        await switchPreviewRole(day, 'admin');
        await go(day, `/projects/${(memberProject ?? firstDay.projects[0]).id}/work`);
        await expect(empty(day, 'No tasks yet.')).toBeVisible();
        await neutral(day); await a11y(day, 'no-tasks-admin'); await overflow(day);
        await day.screenshot({ path: dir + '/no-tasks.png' });
        await day.getByRole('button', { name: 'Add the first task' }).click();
        await expect(day.locator('dialog[open]')).toBeVisible();
        await day.locator('dialog[open]').getByRole('button', { name: 'Close dialogue' }).click();
    });
    await check('empty and error screens fit a phone screen', async () => {
        await day.setViewportSize({ width: 390, height: 844 });
        await go(day, '/events'); await overflow(day);
        await go(day, '/nowhere'); await expect(day.getByRole('heading', { name: 'We could not find that page.' })).toBeVisible(); await overflow(day); await a11y(day, 'not-found-mobile');
        await go(day, '/states/fault'); await expect(day.getByRole('heading', { name: 'This page ran into a problem.' })).toBeVisible(); await overflow(day);
        await day.screenshot({ path: dir + '/page-error-mobile.png' });
    });
    await day.context().close();
    await check('state journeys produced no uncaught browser errors', async () => { expect(errors).toEqual([]); });
    await writeFile(dir + '/results.json', JSON.stringify({ generatedAt: new Date().toISOString(), method: 'Bundled standalone preview in Chromium at a stand-in address; fictional browser-local data only.', results, errors }, null, 2));
    console.log(`${results.length} state browser checks passed`);
} catch (e) {
    await writeFile(dir + '/results.json', JSON.stringify({ results, errors, failure: String(e) }, null, 2));
    throw e;
} finally { await browser.close(); }
