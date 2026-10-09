import { switchPreviewRole, answerConfirmations } from './ui-test-helpers';
/** Actual bundled React in Chromium with fictional browser-local data. Every form uses the shared shadcn components. */
import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..'), dir = root + '/evidence/forms'; await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: true, args: ['--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 1512, height: 1100 } })).newPage(); page.setDefaultTimeout(10000);
await page.clock.setFixedTime(new Date('2026-09-24T12:00:00Z'));
const results: { name: string; passed: boolean }[] = [], errors: string[] = [], swept: string[] = [];
page.on('pageerror', e => errors.push(e.message)); const stopAnswering = await answerConfirmations(page, () => false);
const check = async (name: string, fn: () => Promise<void>) => { await fn(); results.push({ name, passed: true }); console.log('PASS', name); };
const overflow = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
async function a11y(name: string) { const a = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze(); await writeFile(`${dir}/a11y-${name}.json`, JSON.stringify({ violations: a.violations, incomplete: a.incomplete }, null, 2)); expect(a.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([]); }
/** Native controls that are not one of the shared components. File pickers and the focal-point sliders stay native on purpose; Radix's own hidden form inputs are aria-hidden. */
async function unshared(where: string) {
    swept.push(where);
    return page.evaluate(() => [...document.querySelectorAll<HTMLElement>('input,textarea,select,label,button.button,[role=checkbox],[role=radio],[role=switch]')].filter(el => {
        if (el.getAttribute('aria-hidden') === 'true') return false;
        if (el instanceof HTMLInputElement && ['file', 'range', 'hidden'].includes(el.type)) return false;
        const slot = el.dataset.slot;
        if (el.matches('input')) return slot !== 'input';
        if (el.matches('textarea')) return slot !== 'textarea' && !el.closest('.ProseMirror');
        if (el.matches('select')) return slot !== 'native-select';
        if (el.matches('label')) return slot !== 'label';
        if (el.matches('button.button')) return slot !== 'button';
        return !['checkbox', 'radio-group-item', 'switch'].includes(slot || '');
    }).map(el => `${el.tagName.toLowerCase()}${el.className ? '.' + String(el.className).split(' ').slice(0, 2).join('.') : ''} ${el.getAttribute('aria-label') || el.textContent?.trim().slice(0, 40) || ''}`));
}
const dialog = () => page.locator('dialog[open]');
const sidebar = () => page.locator('.sidebar');
try {
    await page.setContent(await readFile(root + '/.preview/REUNIR-preview.html', 'utf8'), { waitUntil: 'load' });
    await expect(page.locator('h1')).toContainText('Build together.');
    await check('every page an administrator can open uses only the shared form components', async () => {
        await switchPreviewRole(page, 'admin');
        const hrefs = await sidebar().locator('a[href^="/"]').evaluateAll(as => [...new Set(as.map(a => a.getAttribute('href')!))]);
        expect(hrefs.length).toBeGreaterThan(10);
        for (const href of hrefs) {
            await sidebar().locator(`a[href="${href}"]`).first().click();
            await expect(page.locator('main h1').first()).toBeVisible();
            expect(await unshared(href), href).toEqual([]);
        }
        await sidebar().locator('a[href="/paths"]').first().click(); await page.locator('a[href="/learn"]').first().click(); await page.locator('.track-card[href="/learn/track_product"]').click();
        await page.getByRole('link', { name: 'Creator studio', exact: true }).click(); await expect(page.locator('h1')).toContainText('Teach something that matters.');
        expect(await unshared('creator studio')).toEqual([]);
        await page.locator('.creator-title').filter({ hasText: 'Choose one real problem' }).click(); await expect(page.locator('.creator-editor')).toBeVisible();
        expect(await unshared('lesson editor')).toEqual([]);
    });
    await check('the switch in the creator studio is a labelled, keyboard-operated shadcn Switch', async () => {
        // Opening a draft has already turned the archive view on, so it starts checked.
        const archive = page.getByRole('switch', { name: 'Show archive', exact: true });
        await expect(archive).toHaveAttribute('data-slot', 'switch'); await expect(archive).toBeChecked();
        await archive.focus(); await page.keyboard.press('Space'); await expect(archive).not.toBeChecked(); await expect(archive).toBeFocused();
        await page.keyboard.press('Space'); await expect(archive).toBeChecked();
        await a11y('creator-studio');
    });
    await check('every create dialogue uses the shared components, keeps its names and passes axe', async () => {
        for (const option of ['Start a conversation', 'Start a project', 'Create a learning track', 'Create a mission', 'Create an event']) {
            await page.getByRole('button', { name: 'Create', exact: true }).click();
            await page.locator('.create-options button').filter({ hasText: option }).click();
            await expect(dialog()).toBeVisible();
            expect(await unshared('create: ' + option)).toEqual([]);
            await expect(dialog().locator('[data-slot=input][name=title]')).toHaveCount(1);
            await expect(dialog().locator('[data-slot=textarea][name=body]')).toHaveCount(1);
            await expect(dialog().locator('[data-slot=native-select]').first()).toBeVisible();
            await a11y('create-' + option.split(' ').pop()!.toLowerCase());
            await dialog().getByRole('button', { name: 'Not now', exact: true }).click(); await expect(dialog()).toHaveCount(0);
        }
    });
    await check('a create form is filled and submitted from the keyboard with native validation intact', async () => {
        const trigger = page.getByRole('button', { name: 'Create', exact: true });
        await trigger.click(); await page.locator('.create-options button').filter({ hasText: 'Start a conversation' }).click();
        const kind = dialog().locator('select[name=kind]');
        await expect(kind).toHaveAttribute('data-slot', 'native-select'); await expect(kind).toHaveAccessibleName(/^Post type/);
        await kind.focus(); await kind.selectOption('question'); await expect(kind).toHaveValue('question');
        await page.keyboard.press('Tab'); await expect(dialog().locator('[name=title]')).toBeFocused(); await page.keyboard.type('Keyboard-built question');
        await page.keyboard.press('Tab'); await expect(dialog().getByLabel('Your post', { exact: true })).toBeFocused();
        await dialog().getByRole('button', { name: 'Publish post', exact: true }).click();
        expect(await dialog().getByLabel('Your post', { exact: true }).evaluate((el: HTMLTextAreaElement) => el.validity.valueMissing)).toBe(true);
        await expect(dialog()).toBeVisible();
        await dialog().getByLabel('Your post', { exact: true }).focus(); await page.keyboard.type('Asked entirely from the keyboard.');
        await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await expect(dialog().getByRole('button', { name: 'Publish post', exact: true })).toBeFocused();
        await page.keyboard.press('Enter'); await expect(dialog()).toHaveCount(0);
        await sidebar().locator('a[href="/discussions"]').first().click();
        await expect(page.getByRole('heading', { name: 'Keyboard-built question' })).toBeVisible();
    });
    await check('Escape closes a form dialogue and returns focus to what opened it', async () => {
        await page.getByRole('button', { name: 'Create', exact: true }).click();
        const option = page.locator('.create-options button').filter({ hasText: 'Start a project' });
        await option.click(); await expect(dialog()).toBeVisible();
        await expect(dialog().locator(':focus')).toHaveCount(1);
        await page.keyboard.press('Escape'); await expect(dialog()).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Create', exact: true })).toBeFocused();
    });
    await check('checkboxes and radio groups work from the keyboard in notification settings', async () => {
        await page.locator('a.notification-button').first().click();
        const opener = page.getByRole('button', { name: 'Notification settings', exact: true }); await opener.click();
        const learning = dialog().getByRole('checkbox', { name: /Learning/ });
        await expect(learning).toHaveAttribute('data-slot', 'checkbox'); await expect(learning).toBeChecked();
        await learning.focus(); await page.keyboard.press('Space'); await expect(learning).not.toBeChecked();
        await page.keyboard.press('Space'); await expect(learning).toBeChecked();
        const off = dialog().getByRole('radio', { name: 'No email digest' });
        await expect(off).toHaveAttribute('data-slot', 'radio-group-item');
        await expect(dialog().getByRole('radiogroup')).toHaveAccessibleName('Email digest');
        await off.focus(); await page.keyboard.press('ArrowDown');
        await expect(dialog().getByRole('radio', { name: 'Daily digest' })).toBeChecked(); await expect(dialog().getByRole('radio', { name: 'Daily digest' })).toBeFocused();
        await expect(off).not.toBeChecked();
        await page.keyboard.press('ArrowUp'); await expect(off).toBeChecked();
        expect(await unshared('notification settings')).toEqual([]);
        await a11y('notification-settings');
        await page.keyboard.press('Escape'); await expect(dialog()).toHaveCount(0); await expect(opener).toBeFocused();
    });
    await check('a member-access checkbox is a labelled shadcn Checkbox', async () => {
        await sidebar().locator('a[href="/access"]').first().click();
        await page.getByRole('button', { name: 'Manage Alex Morgan', exact: true }).click();
        const box = dialog().locator('.access-checkbox [role=checkbox]').first();
        await expect(box).toHaveAttribute('data-slot', 'checkbox'); await expect(box).toHaveAccessibleName(/./);
        expect(await unshared('member access')).toEqual([]);
        await a11y('member-access');
        await dialog().getByRole('button', { name: 'Close dialogue', exact: true }).click();
    });
    await check('the app asks with its own confirmation box: Cancel first, Escape cancels, focus comes back', async () => {
        await stopAnswering();
        await page.getByRole('button', { name: 'Manage Alex Morgan', exact: true }).click();
        const role = page.getByRole('dialog').getByRole('combobox', { name: 'Community role' }), before = await role.inputValue();
        const box = page.getByRole('alertdialog'), changeTo = before === 'moderator' ? 'member' : 'moderator';
        await role.focus(); await role.selectOption(changeTo);
        await expect(box).toHaveAccessibleName(`Change Alex Morgan's role to ${changeTo}?`);
        await expect(box.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
        await expect(box.getByRole('button', { name: 'Change role', exact: true })).toHaveAttribute('data-slot', 'button');
        await a11y('confirmation');
        await page.keyboard.press('Escape'); await expect(box).toHaveCount(0);
        await expect(role).toHaveValue(before); await expect(role).toBeFocused();
        await role.selectOption(changeTo); await box.getByRole('button', { name: 'Cancel', exact: true }).click();
        await expect(box).toHaveCount(0); await expect(role).toHaveValue(before);
        await page.getByRole('dialog').getByRole('button', { name: 'Close dialogue', exact: true }).click();
        await answerConfirmations(page, () => false);
    });
    await check('collections, group conversations, task files and teaching roles use the shared components', async () => {
        const closeWithEscape = async () => { await page.keyboard.press('Escape'); await expect(dialog()).toHaveCount(0); };
        await sidebar().locator('a[href="/collections"]').first().click();
        await page.getByRole('button', { name: 'New collection', exact: true }).click(); await expect(dialog()).toBeVisible();
        await expect(dialog().getByLabel('Title')).toHaveAttribute('data-slot', 'input');
        expect(await unshared('new collection')).toEqual([]); await a11y('new-collection'); await closeWithEscape();
        await sidebar().locator('a[href="/messages"]').first().click();
        await page.getByRole('button', { name: 'New group', exact: true }).click(); await expect(dialog()).toBeVisible();
        await expect(dialog().getByLabel('Group name')).toHaveAttribute('data-slot', 'input');
        const person = dialog().getByRole('checkbox', { name: /Theo Williams/ });
        await expect(person).toHaveAttribute('data-slot', 'checkbox');
        await person.focus(); await page.keyboard.press('Space'); await expect(person).toBeChecked();
        await page.keyboard.press('Space'); await expect(person).not.toBeChecked();
        expect(await unshared('new group')).toEqual([]); await a11y('new-group'); await closeWithEscape();
        await sidebar().locator('a[href="/projects"]').first().click(); await page.locator('.project-card').filter({ hasText: 'Common Ground' }).first().click();
        await page.getByRole('link', { name: 'Open project workspace' }).click(); await page.locator('[data-task-id="task_test"]').click(); await expect(dialog()).toBeVisible();
        await expect(dialog().locator('.task-files')).toBeVisible();
        expect(await unshared('task with files')).toEqual([]); await a11y('task-files'); await closeWithEscape();
        await sidebar().locator('a[href="/paths"]').first().click(); await page.locator('a[href="/learn"]').first().click(); await page.locator('.track-card[href="/learn/track_product"]').click();
        await page.getByRole('button', { name: 'Instructors', exact: true }).click(); await expect(dialog()).toBeVisible();
        await expect(dialog().getByLabel('Role', { exact: true })).toHaveAttribute('data-slot', 'native-select');
        expect(await unshared('teaching roles')).toEqual([]); await a11y('teaching-roles'); await closeWithEscape();
    });
    await check('labels, fields and the dialogue still fit a phone screen', async () => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.getByRole('button', { name: 'Create', exact: true }).click(); await page.locator('.create-options button').filter({ hasText: 'Create an event' }).click();
        await overflow(); expect(await dialog().evaluate(d => d.scrollWidth <= d.clientWidth)).toBe(true);
        await a11y('create-event-mobile'); await page.screenshot({ path: dir + '/create-event-mobile.png' });
        await dialog().getByRole('button', { name: 'Not now', exact: true }).click();
        await page.setViewportSize({ width: 1512, height: 1100 });
    });
    await check('form journeys produced no uncaught browser errors', async () => { expect(errors).toEqual([]); });
    await writeFile(dir + '/results.json', JSON.stringify({ generatedAt: new Date().toISOString(), method: 'Bundled standalone preview in Chromium; fictional browser-local data only.', swept, results, errors }, null, 2));
    console.log(`${results.length} form browser checks passed`);
} catch (e) {
    await page.screenshot({ path: dir + '/failure.png', fullPage: true }).catch(() => {});
    await writeFile(dir + '/results.json', JSON.stringify({ swept, results, errors, failure: String(e) }, null, 2));
    throw e;
} finally { await browser.close(); }
