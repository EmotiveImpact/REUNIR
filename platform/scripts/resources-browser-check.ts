/** Actual bundled React in Chromium with fictional browser-local data. File bytes stay in the page; nothing is uploaded anywhere. */
import { chromium, expect, type Download } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { switchPreviewRole, answerConfirmations } from './ui-test-helpers';
const root = resolve(import.meta.dirname, '..'), dir = root + '/evidence/lesson-resources'; await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1512, height: 1100 }, acceptDownloads: true }); const page = await context.newPage(); page.setDefaultTimeout(10000);
const results: { name: string; passed: boolean }[] = [], errors: string[] = [];
page.on('pageerror', e => errors.push(e.message)); await answerConfirmations(page);
const check = async (name: string, fn: () => Promise<void>) => { await fn(); results.push({ name, passed: true }); console.log('PASS', name); };
const editor = () => page.locator('.creator-editor'), files = () => page.locator('.lesson-content .lesson-resources');
const rows = () => editor().locator('.resource-row');
const overflow = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
const openMenu = async () => { if ((page.viewportSize()?.width || 1512) < 1000 && !await page.locator('.sidebar').evaluate(el => el.classList.contains('open'))) await page.getByRole('button', { name: 'Open navigation', exact: true }).click(); };
const track = async () => { await openMenu(); await page.locator('.sidebar a[href="/paths"]').first().click(); await page.locator('a[href="/learn"]').first().click(); await page.locator('.track-card[href="/learn/track_product"]').click(); };
const lesson = async () => { await track(); await page.locator('.lesson-step[href="/learn/track_product/lesson_4"]').click(); };
const studio = async () => { await track(); await page.getByRole('link', { name: 'Creator studio', exact: true }).click(); await page.locator('.creator-title').filter({ hasText: 'Choose one real problem' }).click(); await expect(editor()).toBeVisible(); };
const role = (as: 'admin' | 'member') => switchPreviewRole(page, as);
const pdf = (text: string) => Buffer.from(`%PDF-1.4\n% ${text}\n`);
async function choose(button: string, file: { name: string; mimeType: string; buffer: Buffer }) {
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), editor().getByRole('button', { name: button, exact: true }).click()]);
    await chooser.setFiles(file);
}
async function fetchFile(button: ReturnType<typeof page.getByRole>): Promise<{ name: string; text: string }> {
    const [download] = await Promise.all([page.waitForEvent('download'), button.click()]) as [Download, unknown];
    return { name: download.suggestedFilename(), text: (await readFile((await download.path())!)).toString('latin1') };
}
const save = async () => { await editor().getByRole('button', { name: 'Save draft', exact: true }).click(); await expect(editor()).toContainText('Saved privately'); };
const publish = async () => { await editor().getByRole('button', { name: 'Publish saved lesson', exact: true }).click(); await expect(editor()).toContainText('matches the published lesson'); };
async function a11y(name: string) { const a = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze(); await writeFile(dir + '/a11y-' + name + '.json', JSON.stringify({ violations: a.violations, incomplete: a.incomplete }, null, 2)); expect(a.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([]); }
const NOTES = 'fictional interview notes template', REVISED = 'fictional revised worksheet';
try {
    await page.setContent(await readFile(root + '/.preview/REUNIR-preview.html', 'utf8'), { waitUntil: 'load' });
    await check('a member sees the published lesson file and downloads a real PDF', async () => {
        await lesson();
        await expect(files()).toContainText('Problem interview worksheet'); await expect(files()).toContainText('PDF · 1 KB');
        const got = await fetchFile(page.getByRole('button', { name: 'Download Problem interview worksheet', exact: true }));
        expect(got.name).toBe('Problem interview worksheet.pdf'); expect(got.text.startsWith('%PDF-1.4')).toBe(true); expect(got.text).toContain('Problem interview worksheet');
    });
    await check('members get no file authoring controls', async () => {
        await expect(page.getByRole('button', { name: 'Add file', exact: true })).toHaveCount(0);
        await expect(page.getByRole('link', { name: 'Creator studio', exact: true })).toHaveCount(0);
    });
    await check('the owner sees the lesson’s existing file in its private draft', async () => {
        await role('admin'); await studio();
        await expect(rows()).toHaveCount(1); await expect(rows().first()).toContainText('Problem interview worksheet');
        await expect(editor()).toContainText('matches the published lesson');
    });
    await check('unsupported and disguised files are refused without changing the draft', async () => {
        await choose('Add file', { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('plain text') });
        await expect(page.locator('.toast')).toContainText('Use a PDF, Word, PowerPoint, Excel, JPEG, PNG, WebP, MP4, WebM or WebVTT captions file.');
        await choose('Add file', { name: 'worksheet.pdf', mimeType: 'application/pdf', buffer: Buffer.from('<html><script>alert(1)</script></html>') });
        await expect(page.locator('.toast')).toContainText('does not match its type');
        await expect(rows()).toHaveCount(1); await expect(editor().getByRole('button', { name: 'Save draft', exact: true })).toBeDisabled();
        await expect(editor().locator('.resource-status')).toContainText('Nothing in the draft changed');
    });
    await check('a verified upload joins the draft as an unsaved change', async () => {
        await choose('Add file', { name: 'Interview notes template.pdf', mimeType: 'application/pdf', buffer: pdf(NOTES) });
        await expect(rows()).toHaveCount(2); await expect(rows().nth(1)).toContainText('New');
        await expect(editor()).toContainText('Unsaved edits');
        await expect(editor().getByRole('button', { name: 'Publish saved lesson', exact: true })).toBeDisabled();
    });
    await check('files are named, described and reordered before saving', async () => {
        await rows().nth(1).getByLabel('File name shown to learners', { exact: true }).fill('Interview notes');
        await rows().nth(1).getByLabel('Description for learners (optional)', { exact: true }).fill('Use this during your first conversation.');
        await editor().getByRole('button', { name: 'Move Interview notes up', exact: true }).click();
        await expect(rows().first()).toContainText('Interview notes');
    });
    await check('a file without a name cannot be saved', async () => {
        await rows().first().getByLabel('File name shown to learners', { exact: true }).fill('');
        await expect(rows().first().getByRole('alert')).toContainText('Give this file a name');
        await expect(editor().getByRole('button', { name: 'Save draft', exact: true })).toBeDisabled();
        await rows().first().getByLabel('File name shown to learners', { exact: true }).fill('Interview notes');
    });
    await check('saved draft files stay private from learners', async () => {
        await save();
        await role('member'); await lesson();
        await expect(files().locator('.lesson-resource')).toHaveCount(1); await expect(files()).not.toContainText('Interview notes');
    });
    await check('private preview lists the saved files and downloads the draft copy', async () => {
        await role('admin'); await studio();
        await editor().getByRole('button', { name: 'Preview', exact: true }).click();
        await expect(editor().locator('.creator-preview .lesson-resource')).toHaveCount(2);
        const got = await fetchFile(editor().getByRole('button', { name: 'Download Interview notes', exact: true }));
        expect(got.name).toBe('Interview notes.pdf'); expect(got.text).toContain(NOTES);
        await editor().getByRole('button', { name: 'Write', exact: true }).click();
    });
    await check('publication releases files in order with their learner-facing names', async () => {
        await publish();
        await role('member'); await lesson();
        await expect(files().locator('.lesson-resource strong')).toHaveText(['Interview notes', 'Problem interview worksheet']);
        await expect(files()).toContainText('Use this during your first conversation.');
        const got = await fetchFile(page.getByRole('button', { name: 'Download Interview notes', exact: true }));
        expect(got.name).toBe('Interview notes.pdf'); expect(got.text).toContain(NOTES);
    });
    await check('a learner lesson with files has no automated accessibility violations', async () => { await overflow(); await a11y('learner-files'); await page.screenshot({ path: dir + '/learner-files.png', fullPage: true, animations: 'disabled' }); });
    await check('replacement waits for publication before learners receive the new file', async () => {
        await role('admin'); await studio();
        await choose('Replace file for Problem interview worksheet', { name: 'worksheet-v2.pdf', mimeType: 'application/pdf', buffer: pdf(REVISED) });
        await expect(rows().nth(1)).toContainText('Replaced'); await save();
        await role('member'); await lesson();
        let got = await fetchFile(page.getByRole('button', { name: 'Download Problem interview worksheet', exact: true }));
        expect(got.text).not.toContain(REVISED);
        await role('admin'); await studio(); await publish();
        await role('member'); await lesson();
        got = await fetchFile(page.getByRole('button', { name: 'Download Problem interview worksheet', exact: true }));
        expect(got.name).toBe('Problem interview worksheet.pdf'); expect(got.text).toContain(REVISED);
    });
    await check('removal reaches learners on publication while history keeps the file', async () => {
        await role('admin'); await studio();
        await editor().getByRole('button', { name: 'Remove Interview notes from the draft', exact: true }).click();
        await expect(rows()).toHaveCount(1); await save(); await publish();
        await editor().locator('.creator-history summary').click();
        const older = editor().locator('.creator-revision').filter({ hasText: 'Interview notes' }).first();
        const got = await fetchFile(older.getByRole('button', { name: 'Download Interview notes', exact: true }));
        expect(got.name).toBe('Interview notes.pdf'); expect(got.text).toContain(NOTES);
        await role('member'); await lesson();
        await expect(files().locator('.lesson-resource')).toHaveCount(1); await expect(files()).not.toContainText('Interview notes');
    });
    await check('an upload removed before saving can be discarded', async () => {
        await role('admin'); await studio();
        await choose('Add file', { name: 'Spare handout.pdf', mimeType: 'application/pdf', buffer: pdf('fictional spare handout') });
        await expect(rows()).toHaveCount(2);
        await editor().getByRole('button', { name: 'Remove Spare handout from the draft', exact: true }).click();
        const spare = editor().locator('.resource-unattached');
        await spare.locator('summary').click(); await expect(spare).toContainText('Spare handout.pdf');
        await spare.getByRole('button', { name: 'Discard Spare handout.pdf', exact: true }).click();
        await expect(editor().locator('.resource-unattached')).toHaveCount(0);
        await expect(editor()).toContainText('matches the published lesson');
    });
    await check('restoring an older revision brings its files back only into the draft', async () => {
        await editor().locator('.creator-history summary').click();
        await editor().locator('.creator-revision').filter({ hasText: 'Interview notes' }).first().getByRole('button', { name: 'Restore as draft', exact: true }).click();
        await expect(rows()).toHaveCount(2);
        await role('member'); await lesson();
        await expect(files().locator('.lesson-resource')).toHaveCount(1);
    });
    await check('the studio file editor passes automated accessibility checks on desktop', async () => {
        await role('admin'); await studio(); await editor().locator('.resource-editor').scrollIntoViewIfNeeded();
        await page.screenshot({ path: dir + '/studio-files-desktop.png', fullPage: false, animations: 'disabled' }); await overflow(); await a11y('studio-desktop');
    });
    await check('390px and 360px file controls stay within the viewport', async () => {
        await page.setViewportSize({ width: 390, height: 844 }); await overflow(); await editor().locator('.resource-editor').scrollIntoViewIfNeeded();
        await page.screenshot({ path: dir + '/studio-files-mobile.png', fullPage: false, animations: 'disabled' }); await a11y('studio-mobile');
        await page.setViewportSize({ width: 360, height: 800 }); await overflow();
        await page.setViewportSize({ width: 1512, height: 1100 });
    });
    await check('an uploaded lesson video is published and plays at the top of the lesson for learners', async () => {
        await studio();
        await expect(editor().locator('.resource-editor-head p')).toContainText('MP4 or WebM video up to 500 MB');
        await choose('Add file', { name: 'Welcome clip.webm', mimeType: 'video/webm', buffer: await readFile(root + '/scripts/fixtures/lesson-long.webm') });
        await expect(rows().last()).toContainText('WebM video'); await expect(rows().last()).toContainText('New');
        await save(); await publish();
        await role('member'); await lesson();
        // The lesson leads with its video on a full-width stage instead of listing it among the files.
        const clip = page.locator('.lesson-content .lesson-stage');
        await expect(clip).toContainText('WebM video');
        await expect(clip).toHaveCount(1); await expect(files().locator('.lesson-resource').filter({ hasText: 'Welcome clip' })).toHaveCount(0);
        expect(await clip.evaluate(el => !!(el.compareDocumentPosition(document.querySelector('.lesson-content h2')!) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
        await clip.getByRole('button', { name: 'Play Welcome clip', exact: true }).click();
        const video = clip.locator('video');
        await expect(video).toBeVisible();
        await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState >= 1 && v.duration > 0)).toBe(true);
        await expect(files()).toContainText('video links after two hours');
        await overflow(); await a11y('learner-video'); await page.screenshot({ path: dir + '/learner-video.png', fullPage: true, animations: 'disabled' });
        const got = await fetchFile(clip.getByRole('button', { name: 'Download Welcome clip', exact: true }));
        expect(got.name).toBe('Welcome clip.webm');
    });
    await check('captions show as a track on the lesson video, and a browser that refuses storage still plays it', async () => {
        await role('admin'); await studio();
        await choose('Add file', { name: 'Welcome clip.vtt', mimeType: 'text/vtt', buffer: Buffer.from('WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nWelcome to the lesson.\n') });
        await expect(rows().last()).toContainText('Captions (WebVTT)');
        await save(); await publish();
        await role('member'); await lesson();
        const clip = page.locator('.lesson-content .lesson-stage');
        await expect(clip).toContainText('Captions available');
        await clip.getByRole('button', { name: 'Play Welcome clip', exact: true }).click();
        const video = clip.locator('video');
        await expect(video.locator('track[kind="captions"]')).toHaveAttribute('label', 'Welcome clip');
        await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.textTracks.length)).toBe(1);
        // This preview runs in a blank document, where the browser refuses local storage: the video still plays from the
        // start and nothing breaks. Remembering the place is covered by tests/video-position.test.ts.
        await video.evaluate((v: HTMLVideoElement) => { v.pause(); v.currentTime = 20; v.dispatchEvent(new Event('pause')); });
        await lesson(); await clip.getByRole('button', { name: 'Play Welcome clip', exact: true }).click();
        await expect(clip.locator('video')).toBeVisible(); await expect(clip.locator('.lesson-resume')).toHaveCount(0);
        await a11y('learner-video-captions');
    });
    await check('the second community does not inherit files from the first', async () => {
        await page.getByRole('button', { name: 'Open Studio North demo community' }).click(); await lesson();
        await expect(page.locator('.lesson-content')).toBeVisible(); await expect(files()).toHaveCount(0);
    });
    await check('the file journey causes no unhandled browser exceptions', async () => { expect(errors).toEqual([]); });
    await writeFile(dir + '/browser-results.json', JSON.stringify({ generatedAt: new Date().toISOString(), method: 'Actual bundled React in Chromium with fictional browser-local data and in-page file bytes; no storage provider or hosted service.', results, errors }, null, 2));
    console.log(results.length + ' lesson resource browser checks passed');
} catch (e) { await page.screenshot({ path: dir + '/failure.png', fullPage: true }).catch(() => {}); await writeFile(dir + '/browser-results.json', JSON.stringify({ results, errors, failure: String(e) }, null, 2)); throw e; } finally { await browser.close(); }
