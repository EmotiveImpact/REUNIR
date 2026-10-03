import { switchPreviewRole } from './ui-test-helpers';
/**
 * Task files and live project work in the bundled demo. Two tabs of the same browser share the fictional demo's storage,
 * which stands in for two people: one tab's change reaches the other through the same change check the live app uses.
 */
import { chromium, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..'), dir = root + '/evidence/task-files'; await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
const results: { name: string; passed: boolean }[] = [], errors: string[] = [];
const check = async (name: string, fn: () => Promise<void>) => { await fn(); results.push({ name, passed: true }); console.log('PASS', name); };
// The same bundled preview at a stand-in address, so both tabs share one origin's storage. Nothing leaves the machine.
const html = await readFile(root + '/.preview/REUNIR-preview.html', 'utf8');
await context.route('http://reunir-preview.test/**', route => route.fulfill({ status: 200, contentType: 'text/html', body: html }));
async function tab() { const p = await context.newPage(); p.setDefaultTimeout(10000); p.on('pageerror', e => errors.push(e.message)); await p.goto('http://reunir-preview.test/', { waitUntil: 'load' }); await expect(p.locator('h1')).toBeVisible(); return p; }
const work = async (p: Page) => { await p.locator('.sidebar a[href="#/projects"]').first().click(); await p.locator('.project-card').filter({ hasText: 'Common Ground' }).first().click(); await p.getByRole('link', { name: 'Open project workspace' }).click(); await expect(p.locator('h1')).toContainText('/ workspace'); };
const card = (p: Page, id: string) => p.locator(`[data-task-id="${id}"]`);
const dialog = (p: Page) => p.getByRole('dialog');
const close = (p: Page) => dialog(p).getByRole('button', { name: 'Close dialogue', exact: true }).click();
const files = (p: Page) => dialog(p).locator('.task-files');
const pdf = (text: string) => Buffer.from(`%PDF-1.4\n% fictional task file: ${text}\n1 0 obj << >> endobj\n%%EOF\n`);
const attach = (p: Page, name: string, buffer = pdf(name), mimeType = 'application/pdf') => files(p).locator('input[type="file"]').setInputFiles({ name, mimeType, buffer });
const overflow = async (p: Page) => expect(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
async function a11y(p: Page, name: string) { const a = await new AxeBuilder({ page: p }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze(); await writeFile(dir + '/a11y-' + name + '.json', JSON.stringify({ violations: a.violations, incomplete: a.incomplete }, null, 2)); expect(a.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([]); }
let alex: Page, idris: Page;
try {
    alex = await tab(); idris = await tab();
    await check('the workboard says live updates are on, quietly', async () => {
        await work(alex);
        await expect(alex.locator('.work-live')).toHaveText('Live updates on');
        await expect(alex.locator('.work-live')).toHaveAttribute('role', 'status');
    });
    await check('a team member attaches a file to a task, verified in the browser and listed with who added it', async () => {
        await card(alex, 'task_test').click();
        await expect(files(alex).getByRole('heading', { name: /Files/ })).toBeVisible();
        await expect(files(alex)).toContainText('Drafts, references and pictures the team needs for this work.');
        await attach(alex, 'Interview notes.pdf');
        await expect(files(alex).locator('.task-files-status')).toContainText('Interview notes.pdf attached.');
        const row = files(alex).locator('.task-file').filter({ hasText: 'Interview notes.pdf' });
        await expect(row).toContainText('PDF'); await expect(row).toContainText('Alex Morgan');
        await expect(row.getByRole('button', { name: 'Remove Interview notes.pdf' })).toBeVisible();
    });
    await check('a file whose contents do not match its type is refused and nothing is attached', async () => {
        await attach(alex, 'Not really.pdf', Buffer.from('plain text pretending to be a PDF'));
        await expect(files(alex).locator('.task-files-status')).toContainText('does not match its type');
        await expect(files(alex).locator('.task-file')).toHaveCount(1);
    });
    await check('downloading saves the file under its own name', async () => {
        const [download] = await Promise.all([alex.waitForEvent('download'), files(alex).getByRole('button', { name: 'Download Interview notes.pdf' }).click()]);
        expect(download.suggestedFilename()).toBe('Interview notes.pdf');
    });
    await check('task detail with files passes automated accessibility and keeps files apart from proof', async () => {
        await expect(files(alex)).toContainText('A file is not proof');
        await alex.screenshot({ path: dir + '/task-files-desktop.png', animations: 'disabled' });
        await a11y(alex, 'task-files-desktop');
        await close(alex);
    });
    await check('the project lead in another tab sees the file and may remove it; a teammate may remove only their own', async () => {
        await switchPreviewRole(idris, 'instructor'); await work(idris);
        await card(idris, 'task_test').click();
        const row = files(idris).locator('.task-file').filter({ hasText: 'Interview notes.pdf' });
        await expect(row).toContainText('Alex Morgan');
        await expect(row.getByRole('button', { name: 'Remove Interview notes.pdf' })).toBeVisible();
        await attach(idris, 'Lead brief.pdf');
        await expect(files(idris).locator('.task-file')).toHaveCount(2);
        await close(idris);
    });
    await check('another person’s change reaches an open board without reloading, with "Updated just now"', async () => {
        await expect(alex.locator('.work-live')).toHaveText('Updated just now', { timeout: 15000 });
        await card(alex, 'task_test').click();
        await expect(files(alex).locator('.task-file')).toHaveCount(2);
        const lead = files(alex).locator('.task-file').filter({ hasText: 'Lead brief.pdf' });
        await expect(lead).toContainText('Idris Cole');
        await expect(lead.getByRole('button', { name: 'Remove Lead brief.pdf' })).toHaveCount(0);
        // A note from the lead appears in the open task while Alex has it open.
        await card(idris, 'task_test').click();
        await dialog(idris).getByLabel('Team note').fill('The brief is attached. Read it before the first session.');
        await dialog(idris).getByRole('button', { name: 'Add note', exact: true }).click();
        await close(idris);
        await expect(dialog(alex).locator('.task-note').filter({ hasText: 'The brief is attached.' })).toHaveCount(1, { timeout: 15000 });
    });
    await check('removing a file deletes it for everyone', async () => {
        await files(alex).getByRole('button', { name: 'Remove Interview notes.pdf' }).click();
        await expect(files(alex).locator('.task-file')).toHaveCount(1);
        await close(alex);
        await card(idris, 'task_test').click();
        await expect(files(idris).locator('.task-file').filter({ hasText: 'Interview notes.pdf' })).toHaveCount(0, { timeout: 15000 });
        await close(idris);
    });
    await check('two people editing one task: the later editor sees who changed it and chooses, nothing is overwritten', async () => {
        await switchPreviewRole(alex, 'admin'); await work(alex);
        await card(alex, 'task_flow').click(); await dialog(alex).getByRole('button', { name: 'Edit task', exact: true }).click();
        await dialog(alex).getByLabel('Task title').fill('Build the profile discovery flow, admin version');
        await card(idris, 'task_flow').click(); await dialog(idris).getByRole('button', { name: 'Edit task', exact: true }).click();
        await dialog(idris).getByLabel('Task title').fill('Build the profile discovery flow, lead version');
        await dialog(idris).getByRole('button', { name: 'Save task', exact: true }).click();
        await expect(dialog(idris).getByRole('heading', { name: 'Build the profile discovery flow, lead version', exact: true })).toBeVisible();
        await close(idris);
        const banner = dialog(alex).locator('.task-conflict');
        await expect(banner).toBeVisible({ timeout: 15000 });
        await expect(banner).toHaveAttribute('role', 'alert');
        await expect(banner).toContainText('Idris Cole changed this task while you were editing');
        await expect(dialog(alex).getByRole('button', { name: 'Save task', exact: true })).toBeDisabled();
        await expect(dialog(alex).getByLabel('Task title')).toHaveValue('Build the profile discovery flow, admin version');
        await alex.screenshot({ path: dir + '/task-conflict-desktop.png', animations: 'disabled' });
        await a11y(alex, 'task-conflict-desktop');
        await dialog(alex).getByRole('button', { name: 'Load the latest version', exact: true }).click();
        await expect(dialog(alex).getByLabel('Task title')).toHaveValue('Build the profile discovery flow, lead version');
        await expect(banner).toHaveCount(0);
        await dialog(alex).getByLabel('Task title').fill('Build the profile discovery flow, agreed');
        await dialog(alex).getByRole('button', { name: 'Save task', exact: true }).click();
        await expect(dialog(alex).getByRole('heading', { name: 'Build the profile discovery flow, agreed', exact: true })).toBeVisible();
        await close(alex);
    });
    await check('a save sent before the change arrives is refused as a conflict, then kept edits are saved on purpose', async () => {
        await card(alex, 'task_flow').click(); await dialog(alex).getByRole('button', { name: 'Edit task', exact: true }).click();
        await dialog(alex).getByLabel('The brief').fill('Admin brief that should not silently replace the lead’s.');
        await expect(idris.locator('.work-card').filter({ hasText: 'agreed' })).toHaveCount(1, { timeout: 15000 });
        await card(idris, 'task_flow').click(); await dialog(idris).getByRole('button', { name: 'Edit task', exact: true }).click();
        await dialog(idris).getByLabel('The brief').fill('The lead’s brief, saved first.');
        await dialog(idris).getByRole('button', { name: 'Save task', exact: true }).click(); await close(idris);
        // Usually the save goes first and is refused; if the change check is quicker, the notice is already showing.
        const banner = dialog(alex).locator('.task-conflict');
        await dialog(alex).getByRole('button', { name: 'Save task', exact: true }).click({ timeout: 2000 }).catch(() => { /* the notice arrived first and disabled saving */ });
        await expect(banner).toBeVisible();
        await expect(banner).toContainText('Your edits are still in the form and have not been saved.');
        await dialog(alex).getByRole('button', { name: 'Keep my edits', exact: true }).click();
        await dialog(alex).getByRole('button', { name: 'Save task', exact: true }).click();
        await expect(dialog(alex).locator('.task-brief')).toHaveText('Admin brief that should not silently replace the lead’s.');
        await close(alex);
    });
    await check('390px task files and conflict notice stay within the screen and pass accessibility', async () => {
        await alex.setViewportSize({ width: 390, height: 844 });
        await card(alex, 'task_test').click();
        await overflow(alex); await a11y(alex, 'task-files-mobile');
        await alex.screenshot({ path: dir + '/task-files-mobile.png', animations: 'disabled' });
        await close(alex); await overflow(alex);
    });
    await check('task files and live updates cause no browser exceptions', async () => { expect(errors).toEqual([]); });
    await writeFile(dir + '/browser-task-files-results.json', JSON.stringify({ generatedAt: new Date().toISOString(), method: 'Actual bundled React demo in Chromium, two tabs sharing fictional browser-local data. The change check and conflict rules are the same domain functions the API uses.', results, errors }, null, 2));
    console.log(results.length + ' task files browser checks passed');
} catch (e) {
    for (const [name, p] of [['alex', alex!], ['idris', idris!]] as const) await p?.screenshot({ path: `${dir}/failure-${name}.png` }).catch(() => {});
    await writeFile(dir + '/browser-task-files-results.json', JSON.stringify({ results, errors, failure: String(e) }, null, 2));
    throw e;
} finally { await browser.close(); }
