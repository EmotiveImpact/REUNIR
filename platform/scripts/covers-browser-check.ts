/** Actual bundled React in Chromium with fictional browser-local data. Cover bytes stay in the page; nothing is uploaded anywhere. */
import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { switchPreviewRole } from './ui-test-helpers';
import { picture, withExif } from './cover-test-helpers';
const root = resolve(import.meta.dirname, '..'), dir = root + '/evidence/covers'; await mkdir(dir, { recursive: true });
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
        return (['color', 'backgroundColor', 'borderTopColor', 'outlineColor'] as const).flatMap(p => { const m = s[p].match(/^rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/); return m && Math.max(+m[1], +m[2], +m[3]) - Math.min(+m[1], +m[2], +m[3]) > 1 ? [`${el.tagName}.${el.className}: ${p}=${s[p]}`] : []; })
            .concat(s.backgroundImage.includes('gradient') && !/progress-ring/.test(String(el.className)) ? ['gradient: ' + el.className] : []);
    }).slice(0, 20));
    expect(failures).toEqual([]);
}
const go = async (path: string) => {
    if ((page.viewportSize()?.width || 1512) < 1000 && !await page.locator('.sidebar').evaluate(el => el.classList.contains('open'))) await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
    await page.locator(`.sidebar a[href="${path}"]`).first().click();
};
const library = async () => { await go('/paths'); await page.locator('a[href="/learn"]').first().click(); await expect(page.locator('.track-card').first()).toBeVisible(); };
const track = async (id: string) => { await library(); await page.locator(`.track-card[href="/learn/${id}"]`).click(); await expect(page.locator('.track-detail-head h1')).toBeVisible(); };
const project = async (id: string) => { await go('/projects'); await page.locator(`.project-card[href="/projects/${id}"]`).click(); await expect(page.locator('.project-detail-cover')).toBeVisible(); };
const dialog = () => page.locator('dialog[open]');
const status = () => dialog().locator('.cover-editor-status');
async function choose(file: { name: string; mimeType: string; buffer: Buffer }) {
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), dialog().getByRole('button', { name: /^Choose (an|another) image$/ }).click()]);
    await chooser.setFiles(file);
}
const save = async () => { await dialog().getByRole('button', { name: 'Save cover', exact: true }).click(); await expect(dialog()).toHaveCount(0); };
/** Bytes behind a rendered cover, read back from its object URL inside the page. */
const stored = (selector: string) => page.locator(selector).evaluate(async (img: HTMLImageElement) => {
    await img.decode();
    const blob = await (await fetch(img.src)).blob(), bytes = new Uint8Array(await blob.arrayBuffer());
    let latin = ''; for (const b of bytes) latin += String.fromCharCode(b);
    return { type: blob.type, size: bytes.length, width: img.naturalWidth, height: img.naturalHeight, position: getComputedStyle(img).objectPosition, latin };
});
const MOUNTAIN = await readFile(root + '/apps/web/src/assets/community-mountain.jpg');
try {
    await page.setContent(await readFile(root + '/.preview/REUNIR-preview.html', 'utf8'), { waitUntil: 'load' });
    await check('seeded tracks and projects show a plain neutral panel with no words on it', async () => {
        await library();
        expect(await page.locator('.track-card .cover-media').count()).toBeGreaterThan(2);
        await expect(page.locator('.track-card .cover-media:not(.cover-plain)')).toHaveCount(0);
        expect((await page.locator('.cover-media').allInnerTexts()).join('').trim()).toBe('');
        await neutral(); await a11y('library-plain');
        await go('/projects'); await expect(page.locator('.project-card .cover-media.cover-plain')).toHaveCount(4); await neutral();
        await page.screenshot({ path: dir + '/projects-plain.png' });
    });
    await check('a member sees no cover controls on a track or on someone else’s project', async () => {
        await track('track_product'); await expect(page.getByRole('button', { name: /cover/i })).toHaveCount(0);
        await project('project_common'); await expect(page.getByRole('button', { name: /cover/i })).toHaveCount(0);
    });
    await switchPreviewRole(page, 'admin');
    await check('an administrator’s cover dialogue is labelled, keyboard reachable and accessible', async () => {
        await track('track_product');
        await page.getByRole('button', { name: 'Add a cover', exact: true }).click();
        await expect(dialog().getByRole('heading', { name: 'Track cover' })).toBeVisible();
        await expect(dialog().getByRole('button', { name: 'Save cover', exact: true })).toBeDisabled();
        await neutral(); await a11y('dialog-empty');
        await page.keyboard.press('Escape'); await expect(dialog()).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Add a cover', exact: true })).toBeFocused();
    });
    await check('a photo is resized in the browser, its location metadata removed, and saved with a chosen focal point', async () => {
        await page.getByRole('button', { name: 'Add a cover', exact: true }).click();
        await choose({ name: 'trip.jpg', mimeType: 'image/jpeg', buffer: withExif(MOUNTAIN, 'REUNIR-PRIVATE-LOCATION') });
        await expect(status()).toContainText('Ready');
        const frame = dialog().locator('.cover-stage-frame'), box = (await frame.boundingBox())!;
        await page.mouse.click(box.x + box.width * .3, box.y + box.height * .7);
        await expect(dialog().getByLabel('Left to right', { exact: true })).toHaveValue('30');
        await expect(dialog().getByLabel('Top to bottom', { exact: true })).toHaveValue('70');
        await dialog().getByLabel('Top to bottom', { exact: true }).focus(); await page.keyboard.press('ArrowUp');
        await expect(dialog().getByLabel('Top to bottom', { exact: true })).toHaveValue('71');
        await neutral(); await a11y('dialog-ready'); await dialog().screenshot({ path: dir + '/dialog-ready.png' });
        await save();
        await expect(page.locator('.toast')).toContainText('Cover saved.');
        const saved = await stored('.track-detail-cover img');
        expect(saved).toMatchObject({ type: 'image/jpeg', width: 440, height: 310, position: '30% 71%' });
        expect(saved.latin).not.toContain('REUNIR-PRIVATE-LOCATION'); expect(saved.latin).not.toContain('Exif');
        expect(await page.locator('.track-detail-cover img').getAttribute('alt')).toBe('');
        await expect(page.getByRole('button', { name: 'Change cover', exact: true })).toBeVisible();
        await library(); await expect(page.locator('.track-card[href="/learn/track_product"] .cover-media img')).toHaveCSS('object-position', '30% 71%');
        await neutral(); await a11y('library-cover'); await page.screenshot({ path: dir + '/library-cover.png' });
    });
    await check('a large picture is scaled to 1,600 pixels and a transparent PNG stays PNG', async () => {
        await track('track_story');
        await page.getByRole('button', { name: 'Add a cover', exact: true }).click();
        await choose({ name: 'wide.png', mimeType: 'image/png', buffer: await picture(page, 'image/png', 2400, 1200, true) });
        await expect(status()).toContainText('Ready. Choose the part of the picture');
        await save();
        expect(await stored('.track-detail-cover img')).toMatchObject({ type: 'image/png', width: 1600, height: 800, position: '50% 50%' });
        await page.getByRole('button', { name: 'Change cover', exact: true }).click();
        await choose({ name: 'large.jpg', mimeType: 'image/jpeg', buffer: await picture(page, 'image/jpeg', 3000, 2000) });
        await expect(status()).toContainText('Ready'); await save();
        expect(await stored('.track-detail-cover img')).toMatchObject({ type: 'image/jpeg', width: 1600, height: 1067 });
    });
    await check('changing only the focal point keeps the same picture', async () => {
        const before = await page.locator('.track-detail-cover img').getAttribute('src');
        await page.getByRole('button', { name: 'Change cover', exact: true }).click();
        await dialog().getByLabel('Left to right', { exact: true }).fill('80'); await save();
        await expect(page.locator('.track-detail-cover img')).toHaveCSS('object-position', '80% 50%');
        expect(await page.locator('.track-detail-cover img').getAttribute('src')).toBe(before);
    });
    await check('an unreadable file is refused in the dialogue and changes nothing', async () => {
        await page.getByRole('button', { name: 'Change cover', exact: true }).click();
        await choose({ name: 'notes.png', mimeType: 'image/png', buffer: Buffer.from('<html><script>alert(1)</script></html>') });
        await expect(dialog().getByRole('alert')).toContainText('could not be read as an image');
        await expect(dialog().getByRole('button', { name: 'Save cover', exact: true })).toBeDisabled();
        await a11y('dialog-error');
        await dialog().getByRole('button', { name: 'Cancel', exact: true }).click();
        await expect(page.locator('.track-detail-cover img')).toHaveCSS('object-position', '80% 50%');
    });
    await check('an administrator can replace another member’s project cover and remove it again', async () => {
        await project('project_common');
        await page.getByRole('button', { name: 'Add a cover', exact: true }).click();
        await expect(dialog().getByRole('heading', { name: 'Project cover' })).toBeVisible();
        await choose({ name: 'mountain.jpg', mimeType: 'image/jpeg', buffer: MOUNTAIN }); await expect(status()).toContainText('Ready'); await save();
        await expect(page.locator('.project-detail-cover img')).toBeVisible();
        await go('/'); await expect(page.locator('.v4-project-row[href="/projects/project_common"] .cover-media img')).toBeVisible();
        await neutral(); await a11y('home-cover');
        await go('/discussions'); await expect(page.locator('.post-visual .cover-media img')).toBeVisible();
        await expect(page.getByRole('link', { name: 'Explore Common Ground', exact: true })).toBeVisible();
        await neutral(); await a11y('feed-cover'); await page.locator('.post-visual').screenshot({ path: dir + '/feed-cover.png' });
        await project('project_common'); await page.getByRole('button', { name: 'Change cover', exact: true }).click();
        await dialog().getByRole('button', { name: 'Remove cover', exact: true }).click(); await expect(dialog()).toHaveCount(0);
        await expect(page.locator('.toast')).toContainText('Cover removed.');
        await expect(page.locator('.project-detail-cover .cover-media')).toHaveClass(/cover-plain/);
        await expect(page.getByRole('button', { name: 'Add a cover', exact: true })).toBeVisible();
    });
    const settings = () => page.locator('.cover-library-settings');
    await check('an administrator keeps a community cover library in Community settings', async () => {
        await go('/settings');
        await expect(settings().getByRole('heading', { name: 'Cover library' })).toBeVisible();
        await expect(settings().locator('.cover-library-list li')).toHaveCount(1);
        await expect(settings()).toContainText('Mountain ridge'); await expect(settings()).toContainText('1 of 24 pictures');
        await settings().getByRole('button', { name: 'Add a picture', exact: true }).click();
        await expect(dialog().getByRole('heading', { name: 'Add a library picture' })).toBeVisible();
        await expect(dialog().getByRole('button', { name: 'Add to library', exact: true })).toBeDisabled();
        await choose({ name: 'harbour.jpg', mimeType: 'image/jpeg', buffer: await picture(page, 'image/jpeg', 1200, 800) });
        await expect(status()).toContainText('Ready. Give it a short name');
        await expect(dialog().getByRole('button', { name: 'Add to library', exact: true })).toBeDisabled();
        await dialog().getByLabel('Name', { exact: true }).fill('Quiet harbour');
        await neutral(); await a11y('library-add'); await dialog().screenshot({ path: dir + '/library-add.png' });
        await dialog().getByRole('button', { name: 'Add to library', exact: true }).click(); await expect(dialog()).toHaveCount(0);
        await expect(page.locator('.toast')).toContainText('Quiet harbour is in the cover library.');
        await expect(settings().locator('.cover-library-list li')).toHaveCount(2); await expect(settings()).toContainText('2 of 24 pictures');
        await neutral(); await a11y('library-settings'); await settings().screenshot({ path: dir + '/library-settings.png' });
    });
    await check('a cover can come from the library instead of an upload, chosen by pointer or keyboard', async () => {
        await track('track_brand');
        await page.getByRole('button', { name: 'Add a cover', exact: true }).click();
        await expect(dialog().getByLabel('Upload your own', { exact: true })).toBeChecked();
        await dialog().getByLabel('Community library', { exact: true }).check();
        await expect(dialog().getByRole('button', { name: /^Choose (an|another) image$/ })).toHaveCount(0);
        await expect(dialog().getByRole('button', { name: 'Save cover', exact: true })).toBeDisabled();
        await dialog().getByLabel('Mountain ridge', { exact: true }).check();
        await expect(status()).toContainText('Mountain ridge chosen.');
        await dialog().getByLabel('Left to right', { exact: true }).fill('60');
        await neutral(); await a11y('dialog-library'); await dialog().screenshot({ path: dir + '/dialog-library.png' });
        await save();
        expect(await stored('.track-detail-cover img')).toMatchObject({ type: 'image/jpeg', size: 14450, width: 440, height: 288, position: '60% 50%' });
        await page.getByRole('button', { name: 'Change cover', exact: true }).click();
        await expect(dialog().getByLabel('Community library', { exact: true })).toBeChecked();
        await expect(dialog().getByLabel('Mountain ridge', { exact: true })).toBeChecked();
        await dialog().getByLabel('Mountain ridge', { exact: true }).focus(); await page.keyboard.press('ArrowRight');
        await expect(dialog().getByLabel('Quiet harbour', { exact: true })).toBeChecked();
        await save();
        expect(await stored('.track-detail-cover img')).toMatchObject({ width: 1200, height: 800, position: '50% 50%' });
        await library(); await expect(page.locator('.track-card[href="/learn/track_brand"] .cover-media img')).toBeVisible();
    });
    await check('a picture in use stays in the library until its covers change', async () => {
        await go('/settings');
        await expect(settings().getByRole('button', { name: 'Remove Quiet harbour', exact: true })).toBeDisabled();
        await expect(settings()).toContainText('The cover of 1 track or project.');
        await track('track_brand'); await page.getByRole('button', { name: 'Change cover', exact: true }).click();
        await dialog().getByLabel('Mountain ridge', { exact: true }).check(); await save();
        await go('/settings');
        page.once('dialog', d => d.accept());
        await settings().getByRole('button', { name: 'Remove Quiet harbour', exact: true }).click();
        await expect(page.locator('.toast')).toContainText('Quiet harbour was removed from the cover library.');
        await expect(settings().locator('.cover-library-list li')).toHaveCount(1);
        await expect(settings().getByRole('button', { name: 'Remove Mountain ridge', exact: true })).toBeDisabled();
    });
    await switchPreviewRole(page, 'instructor');
    await check('an instructor chooses a library picture for their own track and has no library settings', async () => {
        await track('track_product'); await page.getByRole('button', { name: 'Change cover', exact: true }).click();
        await expect(dialog().getByLabel('Upload your own', { exact: true })).toBeChecked();
        await dialog().getByLabel('Community library', { exact: true }).check();
        await dialog().getByLabel('Mountain ridge', { exact: true }).check(); await save();
        expect(await stored('.track-detail-cover img')).toMatchObject({ width: 440, height: 288 });
        await expect(page.locator('.sidebar a[href="/settings"]')).toHaveCount(0);
    });
    await switchPreviewRole(page, 'member');
    await check('a member who starts a project can give it a cover, and other members see it', async () => {
        await go('/projects'); await page.getByRole('button', { name: 'Start a project', exact: true }).click();
        const form = dialog();
        await form.locator('[name="title"]').fill('Night market zine'); await form.locator('[name="tagline"]').fill('A small printed guide to the market.');
        await form.locator('[name="body"]').fill('Fictional project created by the cover check.'); await form.locator('[name="category"]').fill('Editorial');
        await form.getByRole('button', { name: 'Create project', exact: true }).click();
        await expect(page.locator('.page-heading h1')).toHaveText('Night market zine');
        await page.getByRole('button', { name: 'Add a cover', exact: true }).click();
        await choose({ name: 'mountain.jpg', mimeType: 'image/jpeg', buffer: MOUNTAIN }); await expect(status()).toContainText('Ready'); await save();
        await expect(page.locator('.project-detail-cover img')).toBeVisible();
        await track('track_story'); await expect(page.getByRole('button', { name: /cover/i })).toHaveCount(0);
        await expect(page.locator('.track-detail-cover img')).toBeVisible();
    });
    await check('members see covers chosen from the library, with no way to change them', async () => {
        await track('track_brand'); await expect(page.locator('.track-detail-cover img')).toBeVisible();
        await expect(page.getByRole('button', { name: /cover/i })).toHaveCount(0);
        await expect(page.locator('.sidebar a[href="/settings"]')).toHaveCount(0);
    });
    await check('390px: the cover dialogue fits, stays accessible and pages keep no horizontal overflow', async () => {
        await page.setViewportSize({ width: 390, height: 844 });
        await go('/projects'); await overflow(); await neutral();
        await page.locator('.project-card').filter({ hasText: 'Night market zine' }).click();
        await page.getByRole('button', { name: 'Change cover', exact: true }).click();
        await expect(dialog().getByLabel('Left to right', { exact: true })).toBeVisible();
        expect(await dialog().evaluate(d => d.scrollWidth <= d.clientWidth)).toBe(true);
        await a11y('dialog-mobile'); await dialog().screenshot({ path: dir + '/dialog-mobile.png' });
        await dialog().getByRole('button', { name: 'Cancel', exact: true }).click(); await overflow();
        await page.screenshot({ path: dir + '/project-mobile.png' });
    });
    await check('no uncaught browser errors in the cover journey', async () => { expect(errors).toEqual([]); });
    await writeFile(dir + '/browser-results.json', JSON.stringify({ method: 'Bundled React in local Chromium, fictional state; not hosted acceptance.', results, errors }, null, 2));
    console.log(`${results.length} cover browser checks passed`);
} catch (e) {
    await page.screenshot({ path: dir + '/failure.png', fullPage: true }).catch(() => {});
    await writeFile(dir + '/browser-results.json', JSON.stringify({ results, errors, failure: String(e) }, null, 2)); throw e;
} finally { await browser.close(); }
