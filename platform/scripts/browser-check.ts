import { switchPreviewRole } from './ui-test-helpers';
import { chromium, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const html = await readFile(root + '/.preview/REUNIR-preview.html', 'utf8');
await mkdir(root + '/evidence/alpha02/regression', { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1512, height: 1050 } });
const page = await context.newPage();
// Fixture events are dated September 2026. Fix Date only; timers still run normally.
await page.clock.setFixedTime(new Date('2026-09-24T12:00:00Z'));
page.setDefaultTimeout(6000);
page.setDefaultNavigationTimeout(6000);
const errors: string[] = [];
page.on('pageerror', e => errors.push(e.message));
const results: {
    name: string;
    passed: boolean;
}[] = [];
async function check(name: string, fn: () => Promise<void>) { await fn(); results.push({ name, passed: true }); console.log('PASS', name); }
async function nav(name: string) {
    const routes: Record<string,string> = {'Your home':'/','Home':'/','Paths':'/paths','Learn':'/paths','Missions':'/missions','Projects':'/projects','Events':'/events','Your people':'/members','Discussions':'/discussions'};
    await page.locator('.sidebar').locator(`a[href="${routes[name]}"]`).first().click();
    if(name==='Learn') await page.locator('.path-subnav').getByRole('link',{name:'Course library'}).click();
}
async function shot(name: string, fullPage = false) { await page.screenshot({ path: root + '/evidence/alpha02/regression/' + name + '.png', fullPage, animations: 'disabled' }); }
async function noOverflow() { expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); }
try {
    await page.setContent(html, { waitUntil: 'load' });
    await expect(page.locator('h1')).toContainText('Build together.');
    await check('working home renders with explicit demo disclosure', async () => { await expect(page.locator('.app-footer')).toContainText('FICTIONAL DEMO · BROWSER-LOCAL'); await noOverflow(); await shot('home-desktop'); });
    await check('private studio is not visible to a normal member', async () => { await expect(page.locator('.spaces-nav').getByText('The studio')).toHaveCount(0); });
    await check('post creation mutates the feed', async () => { await page.getByRole('button', { name: 'Create', exact: true }).click(); await page.locator('.create-options button').first().click(); await page.getByRole('dialog').locator('input[name=title]').fill('Browser-built thought'); await page.getByLabel('Your post', { exact: true }).fill('A real post created through the React interface.'); await page.getByRole('button', { name: 'Publish post', exact: true }).click(); await nav('Discussions'); await expect(page.getByRole('heading', { name: 'Browser-built thought' })).toBeVisible(); });
    await check('save and appreciation change actual records', async () => { const card = page.locator('.post-card').filter({ hasText: 'Browser-built thought' }); await card.getByRole('button', { name: 'Appreciate post', exact: true }).click(); await expect(card.getByRole('button', { name: 'Remove appreciation' })).toHaveAttribute('aria-pressed', 'true'); await card.getByRole('button', { name: 'Save post', exact: true }).click(); await page.locator('.sidebar-lower').getByRole('link', { name: 'Saved for later' }).click(); await expect(page.getByRole('heading', { name: 'Browser-built thought' })).toBeVisible(); });
    await check('comments are created in a real thread', async () => { await page.getByRole('heading', { name: 'Browser-built thought' }).getByRole('link').click(); await page.locator('.reply-form textarea').fill('An actual reply, not a decorative button.'); await page.locator('.reply-form button[type=submit],.reply-form .button').click(); await expect(page.locator('.comment').filter({ hasText: 'An actual reply' })).toHaveCount(1); });
    await check('learning catalogue and player render', async () => { await nav('Learn'); await expect(page.locator('.track-card')).toHaveCount(4); await shot('learn-desktop'); await page.getByRole('heading', { name: 'From idea to first version' }).click(); await expect(page.locator('.curriculum')).toBeVisible(); await shot('lesson-desktop'); });
    await check('completion moves learning progress forward', async () => { await page.getByRole('button', { name: 'Mark complete · +20 points' }).click(); await expect(page.locator('.curriculum .panel-title')).toContainText('2/3'); });
    await check('mission proof submission is visible in its pending state', async () => { await nav('Missions'); await shot('missions-desktop'); await page.locator('.mission-card').first().click(); await page.getByLabel('Your proof and reflection').fill('Browser proof: an original film with a deliberate sound design choice.'); await page.locator('.proof-form input[type=url]').fill('https://example.com/original-film'); await page.getByRole('button', { name: 'Submit your proof' }).click(); await expect(page.locator('.submission-status')).toContainText('pending'); });
    await check('project creation includes the creator as a team member', async () => { await nav('Projects'); await shot('projects-desktop'); await page.getByRole('button', { name: 'Start a project', exact: true }).click(); const d = page.getByRole('dialog'); await d.locator('[name=title]').fill('The browser build'); await d.locator('[name=tagline]').fill('Something created, not merely displayed.'); await d.locator('[name=body]').fill('A collaboration around a useful first version.'); await d.locator('[name=category]').fill('Product design'); await d.locator('[name=skills]').fill('Design, Development'); await d.getByRole('button', { name: 'Create project', exact: true }).click(); await expect(page.locator('h1')).toHaveText('The browser build'); await expect(page.getByText('You lead this project.')).toBeVisible(); });
    await check('team members can publish project updates', async () => { await page.getByLabel('Share a little progress').fill('The first version is ready for feedback.'); await page.getByRole('button', { name: 'Publish update' }).click(); await expect(page.locator('.project-update')).toContainText('The first version is ready'); });
    await check('event RSVP persists in the displayed guest list', async () => { await nav('Events'); await shot('events-desktop'); await page.locator('.event-card').first().click(); await page.getByRole('button', { name: 'Count me in' }).click(); await expect(page.getByRole('button', { name: 'Cancel my RSVP' })).toBeVisible(); });
    await check('member directory filters skills', async () => { await nav('Your people'); await shot('members-desktop'); await page.locator('.directory-search input').fill('filmmaker'); await expect(page.locator('.member-card')).toHaveCount(1); await page.locator('.directory-search input').fill(''); });
    await check('search returns authorised content and navigates to it', async () => { await page.locator('.header-search').click(); await page.getByRole('textbox', { name: 'Search your community' }).fill('The browser build'); await page.locator('.search-results button').first().click(); await expect(page.locator('h1')).toHaveText('The browser build'); });
    await check('admin preview exposes private studio and review tools', async () => { await switchPreviewRole(page,'admin'); await expect(page.locator('h1')).toContainText('Build together.'); await expect(page.locator('.spaces-nav')).toContainText('The studio'); await page.locator('.sidebar-lower').getByRole('link', { name: 'Community studio' }).click(); await page.getByRole('button', { name: /Proof to review/ }).click(); await shot('review-desktop'); });
    await check('admin review awards proof exactly once in the UI', async () => { const card = page.locator('.review-card').filter({ hasText: 'Browser proof:' }); await card.getByLabel('Thoughtful feedback').fill('A clear intention, expressed through sound. Good work.'); await card.getByRole('button', { name: /Approve/ }).click(); await expect(page.locator('.review-card').filter({ hasText: 'Browser proof:' })).toHaveCount(0); await switchPreviewRole(page,'member'); await nav('Missions'); await page.locator('.mission-card').first().click(); await expect(page.locator('.submission-status')).toContainText('approved'); await expect(page.locator('.submission-status')).toContainText('A clear intention'); });
    await check('community switching isolates previous activity', async () => { await page.getByRole('button', { name: 'Open Studio North demo community' }).click(); await expect(page.locator('.breadcrumb')).toContainText('Studio North'); await expect(page.getByRole('heading', { name: 'Browser-built thought' })).toHaveCount(0); await page.getByRole('button', { name: 'Open Code Black', exact: true }).click(); await nav('Discussions'); await expect(page.getByRole('heading', { name: 'Browser-built thought' })).toBeVisible(); });
    await check('desktop core WCAG A/AA automatic checks', async () => { await nav('Home'); const a = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze(); await writeFile(root + '/evidence/alpha02/regression/accessibility.json', JSON.stringify({ url: 'in-memory offline preview', violations: a.violations, incomplete: a.incomplete }, null, 2)); expect(a.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => n.target) }))).toEqual([]); });
    await check('mobile home, navigation and first fold', async () => { await page.setViewportSize({ width: 390, height: 844 }); await navMobile('Home'); await noOverflow(); await shot('home-mobile'); await expect(page.locator('.mobile-bottom')).toBeVisible(); });
    for (const name of ['Learn', 'Missions', 'Projects', 'Events'])
        await check(`mobile ${name.toLowerCase()} is usable without horizontal scrolling`, async () => { await navMobile(name); await noOverflow(); await shot(name.toLowerCase() + '-mobile'); });
    await check('small-phone navigation works', async () => { await page.setViewportSize({ width: 360, height: 780 }); await navMobile('Home'); await page.getByRole('button', { name: 'Open navigation', exact: true }).click(); await expect(page.locator('.sidebar')).toHaveClass(/open/); await page.locator('.primary-nav').getByRole('link', { name: 'Your people', exact: true }).click(); await expect(page.locator('h1')).toBeVisible(); await noOverflow(); });
    await check('no uncaught JavaScript errors', async () => { expect(errors).toEqual([]); });
    await writeFile(root + '/evidence/alpha02/regression/browser-tests.json', JSON.stringify({ generatedAt: new Date().toISOString(), method: 'Offline bundled React rendered in an in-memory browser document; MemoryRouter for embed compatibility. Network and file navigation are restricted in this runtime.', results, errors }, null, 2));
    console.log(`${results.length} browser checks passed`);
}
catch (e) {
    console.error(String(e));
    if (!page.isClosed())
        await page.screenshot({ path: root + '/evidence/alpha02/regression/browser-failure.png', fullPage: true, animations: 'disabled' }).catch(() => { });
    await writeFile(root + '/evidence/alpha02/regression/browser-tests.json', JSON.stringify({ results, errors, failure: String(e) }, null, 2));
    throw e;
}
finally {
    await browser.close();
}
async function navMobile(name: string) {
    const mapped=name==='Learn'?'Paths':name;
    const bottom=page.locator('.mobile-bottom').getByRole('link',{name:mapped,exact:true});
    if(await bottom.count())await bottom.click();
    else {await page.getByRole('button',{name:'Open navigation',exact:true}).click();await nav(name);}
    if(name==='Learn')await page.locator('.path-subnav').getByRole('link',{name:'Course library'}).click();
}
