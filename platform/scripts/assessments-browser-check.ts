/** Actual bundled React in Chromium with fictional browser-local data. Knowledge checks from authoring to feedback; no hosted service. */
import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { openProfile, switchPreviewRole } from './ui-test-helpers';
import { createSeed } from '../packages/domain/src/seed';
const root = resolve(import.meta.dirname, '..'), dir = root + '/evidence/knowledge-checks'; await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1512, height: 1100 } }); const page = await context.newPage(); page.setDefaultTimeout(10000);
const results: { name: string; passed: boolean }[] = [], errors: string[] = [];
page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
const check = async (name: string, fn: () => Promise<void>) => { await fn(); results.push({ name, passed: true }); console.log('PASS', name); };
const kc = () => page.locator('.lesson-content .knowledge-check'), editor = () => page.locator('.creator-editor'), quiz = () => editor().locator('.quiz-editor');
const toast = () => page.locator('.toast');
const overflow = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
const openMenu = async () => { if ((page.viewportSize()?.width || 1512) < 1000 && !await page.locator('.sidebar').evaluate(el => el.classList.contains('open'))) await page.getByRole('button', { name: 'Open navigation', exact: true }).click(); };
const track = async () => { await openMenu(); await page.locator('.sidebar a[href="/paths"]').first().click(); await page.locator('a[href="/learn"]').first().click(); await page.locator('.track-card[href="/learn/track_product"]').click(); };
const lesson = async (id: string) => { await track(); await page.locator(`.lesson-step[href="/learn/track_product/${id}"]`).click(); await expect(page.locator('.lesson-content h2').first()).toBeVisible(); };
const studio = async (title: string) => { await track(); await page.getByRole('link', { name: 'Creator studio', exact: true }).click(); await page.locator('.creator-title').filter({ hasText: title }).click(); await expect(editor()).toBeVisible(); };
const queue = async () => { await openMenu(); await page.locator('.sidebar a[href="/admin"]').click(); await page.getByRole('button', { name: /^Knowledge checks · \d+$/ }).click(); await expect(page.locator('.quiz-review')).toBeVisible(); };
const role = (as: 'admin' | 'member') => switchPreviewRole(page, as);
const save = async () => { await editor().getByRole('button', { name: 'Save draft', exact: true }).click(); await expect(editor()).toContainText('Saved privately'); };
const publish = async () => { await editor().getByRole('button', { name: 'Publish saved lesson', exact: true }).click(); await expect(editor()).toContainText('matches the published lesson'); };
async function a11y(name: string) { const a = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze(); await writeFile(dir + '/a11y-' + name + '.json', JSON.stringify({ violations: a.violations, incomplete: a.incomplete }, null, 2)); expect(a.violations).toEqual([]); }
/** The approved interface is black, white and neutral grey: every visible colour in these components must be a grey. */
async function neutral(selector: string) {
    const failures = await page.evaluate(sel => {
        const out: string[] = [];
        for (const el of document.querySelectorAll<HTMLElement>(`${sel}, ${sel} *`)) {
            if (!el.getClientRects().length) continue;
            const s = getComputedStyle(el);
            for (const p of ['color', 'backgroundColor', 'borderTopColor', 'outlineColor', 'accentColor'] as const) {
                const m = String(s[p]).match(/^rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/);
                if (m && Math.max(+m[1], +m[2], +m[3]) - Math.min(+m[1], +m[2], +m[3]) > 1) out.push(`${el.tagName}.${el.className}: ${p}=${s[p]}`);
            }
        }
        return out;
    }, selector);
    expect(failures).toEqual([]);
}
const WRITTEN = 'Fictional answer: they paused at the save step, so I would add autosave and say so on screen.';
const FEEDBACK = 'A specific observation. Next time, say how you would know the change worked.';
try {
    await page.setContent(await readFile(root + '/.preview/REUNIR-preview.html', 'utf8'), { waitUntil: 'load' });
    await check('a member sees the knowledge check, its rules and no answers', async () => {
        await lesson('lesson_5');
        await expect(kc()).toContainText('3 questions · 4 points · Pass mark 75% · 3 of 3 attempts left');
        await expect(kc()).toContainText('Only you and your community’s owners and administrators can see your answers');
        await expect(kc().locator('.quiz-question')).toHaveCount(3);
        await expect(kc().locator('.quiz-correct')).toHaveCount(0); await expect(kc()).not.toContainText('Accepted answers');
        await expect(kc().getByRole('button', { name: 'Submit answers' })).toBeDisabled();
        await neutral('.lesson-content .knowledge-check'); await a11y('learner-form');
    });
    await check('a failing attempt shows each result without revealing the answers', async () => {
        await kc().getByRole('radio', { name: 'Exactly what you need feedback on' }).check();
        await kc().getByRole('checkbox', { name: 'One complete path to a useful outcome' }).check();
        await expect(kc().getByRole('button', { name: 'Submit answers' })).toBeDisabled();
        await kc().getByRole('textbox').fill('helpful');
        await kc().getByRole('button', { name: 'Submit answers' }).click();
        await expect(toast()).toContainText('You scored 1 of 4 (25%). The pass mark is 75%.');
        await expect(kc()).toContainText('1 of 4 points · 25%'); await expect(kc()).toContainText('Below the pass mark');
        await expect(kc()).toContainText('Correct · 1 of 1 point'); await expect(kc()).toContainText('Not correct · 0 of 2 points');
        await expect(kc()).toContainText('Correct answers appear once you pass or use every attempt.');
        await expect(kc()).toContainText('2 of 3 attempts left');
        await expect(kc().locator('.quiz-correct')).toHaveCount(0); await expect(kc()).not.toContainText('Reviewers help most');
    });
    await check('an attempt changes neither lesson completion nor points', async () => {
        await expect(page.locator('.lesson-footer').getByRole('button', { name: 'Mark complete · +20 points' })).toBeEnabled();
        await expect(page.locator('.lesson-step[href="/learn/track_product/lesson_5"] .step-number.done')).toHaveCount(0);
    });
    await check('trying again and passing reveals answers and explanations for every attempt', async () => {
        await kc().getByRole('button', { name: 'Try again' }).click();
        await expect(kc().locator('.quiz-question')).toHaveCount(3);
        await kc().getByRole('radio', { name: 'Exactly what you need feedback on' }).check();
        await kc().getByRole('checkbox', { name: 'One complete path to a useful outcome' }).check();
        await kc().getByRole('checkbox', { name: 'The essentials for the person’s problem' }).check();
        await kc().getByRole('textbox').fill('  Useful ');
        await kc().getByRole('button', { name: 'Submit answers' }).click();
        await expect(toast()).toContainText('You scored 4 of 4 (100%). You passed.');
        await expect(kc().locator('.quiz-attempt').first()).toContainText('Passed');
        await expect(kc().locator('.quiz-attempt').first().locator('.quiz-correct')).toHaveCount(3);
        await expect(kc()).toContainText('Reviewers help most'); await expect(kc()).toContainText('Accepted answers: useful');
        await kc().locator('.quiz-history summary').click();
        await expect(kc().locator('.quiz-history .quiz-attempt')).toHaveCount(1);
        await expect(kc().locator('.quiz-history .quiz-correct')).toHaveCount(3);
        await expect(kc()).toContainText('You passed. You can try again to practise.');
        await page.screenshot({ path: dir + '/learner-passed-desktop.png', fullPage: false, animations: 'disabled' });
    });
    await check('a written answer waits for a reviewer and blocks another attempt meanwhile', async () => {
        await lesson('lesson_6');
        await expect(kc()).toContainText('2 questions · 4 points · No pass mark · Unlimited attempts');
        await kc().getByRole('radio', { name: 'Watch quietly and note where they pause' }).check();
        await kc().getByRole('textbox').fill(WRITTEN);
        await expect(kc()).toContainText(`${WRITTEN.length} of 2000 characters`);
        await kc().getByRole('button', { name: 'Submit answers' }).click();
        await expect(toast()).toContainText('Submitted. A reviewer will mark your written answers and send feedback.');
        await expect(kc()).toContainText('Waiting for feedback'); await expect(kc()).toContainText('1 of 4 points so far');
        await expect(kc()).toContainText('Your written answers are waiting for a reviewer.');
        await expect(kc().getByRole('button', { name: 'Try again' })).toHaveCount(0);
        await a11y('learner-waiting');
    });
    await check('the owner’s queue lists both waiting answers and validates marks', async () => {
        await role('admin'); await queue();
        await expect(page.getByRole('button', { name: 'Knowledge checks · 2' })).toBeVisible();
        const cards = page.locator('.quiz-review > .review-grid .quiz-review-card');
        await expect(cards).toHaveCount(2);
        await expect(cards.first()).toContainText('Sofia Chen'); await expect(cards.nth(1)).toContainText('Alex Morgan');
        const alex = cards.nth(1);
        await expect(alex).toContainText(WRITTEN);
        await alex.getByRole('spinbutton').fill('4');
        await expect(alex).toContainText('Enter a whole number from 0 to 3.');
        await alex.getByRole('textbox').fill(FEEDBACK);
        await expect(alex.getByRole('button', { name: 'Send marks and feedback' })).toBeDisabled();
        await alex.getByRole('spinbutton').fill('2');
        await neutral('.quiz-review'); await a11y('review-queue');
        await alex.getByRole('button', { name: 'Send marks and feedback' }).click();
        await expect(toast()).toContainText('Feedback sent. The learner sees it with their answers.');
        await expect(page.getByRole('button', { name: 'Knowledge checks · 1' })).toBeVisible();
        await expect(cards).toHaveCount(1);
        await expect(page.locator('.quiz-review details').filter({ hasText: 'Reviewed' }).locator('summary')).toContainText('1');
    });
    await check('the learner follows the notification to their marks and feedback', async () => {
        await role('member');
        await page.locator('a.notification-button').click();
        await page.locator('.notification-row').filter({ hasText: 'Feedback on your knowledge check' }).click();
        await expect(kc()).toContainText('Feedback from Amina Okafor'); await expect(kc()).toContainText(FEEDBACK);
        await expect(kc()).toContainText('Marked · 2 of 3 points'); await expect(kc()).toContainText('3 of 4 points · 75%');
        await expect(kc().locator('.quiz-correct')).toHaveCount(0); await expect(kc()).toContainText('This check does not show correct answers.');
        await expect(kc().getByRole('button', { name: 'Try again' })).toBeVisible();
    });
    await check('the learner downloads their own learning record with every attempt, mark and piece of feedback', async () => {
        await openProfile(page);
        await expect(page.getByRole('heading', { name: 'Your learning record' })).toBeVisible();
        const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download your learning record', exact: true }).click()]);
        expect(download.suggestedFilename()).toMatch(/^reunir-learning-record-code-black-\d{4}-\d{2}-\d{2}\.json$/);
        const record = JSON.parse(await readFile((await download.path())!, 'utf8'));
        type Attempt = { lesson: string; status: string; feedback: string; reviewedBy: string | null; score: number; maxScore: number; answers: Record<string, unknown>[] };
        const attempts = (title: string) => (record.knowledgeChecks as Attempt[]).filter(a => a.lesson === title);
        expect([record.format, record.member.name]).toEqual(['reunir.learning-record', 'Alex Morgan']);
        expect(attempts('Test before you celebrate').at(-1)).toMatchObject({ status: 'reviewed', feedback: FEEDBACK, reviewedBy: 'Amina Okafor', score: 3, maxScore: 4 });
        expect(attempts('Test before you celebrate').flatMap(a => a.answers).some(x => 'correctOptions' in x)).toBe(false);
        expect(attempts('Cut it down to the useful part').length).toBeGreaterThan(1);
        expect(attempts('Cut it down to the useful part').every(a => a.answers.every(x => 'correctOptions' in x))).toBe(true);
        expect(JSON.stringify(record)).not.toContain('Sofia');
        await expect(toast()).toContainText('Your learning record is downloading.');
        await neutral('.learning-record'); await a11y('learning-record');
    });
    await check('the studio edits a knowledge check privately and explains what blocks saving', async () => {
        await role('admin'); await studio('Cut it down to the useful part');
        await expect(quiz()).toContainText('3 of 15 questions · 4 points');
        await quiz().getByRole('button', { name: 'Add question', exact: true }).click();
        await expect(quiz().locator('.quiz-problems')).toContainText('Write each question before saving.');
        await expect(quiz().locator('.quiz-problems')).toContainText('Give every option some text.');
        await expect(editor().getByRole('button', { name: 'Save draft', exact: true })).toBeDisabled();
        const added = quiz().locator('.quiz-question-editor').nth(3);
        await added.getByRole('combobox', { name: 'Type' }).selectOption('short');
        await expect(quiz().locator('.quiz-problems')).toContainText('Fill in or remove each empty accepted answer.');
        await added.getByRole('textbox', { name: 'Question', exact: true }).fill('Name the one thing your first version must do.');
        await added.getByRole('textbox', { name: 'Accepted answer 1 for question 4' }).fill('solve one problem');
        await expect(quiz().locator('.quiz-problems')).toHaveCount(0);
        await neutral('.quiz-editor'); await save();
        await editor().getByRole('button', { name: 'Preview', exact: true }).click();
        await expect(editor().locator('.knowledge-check.preview .quiz-question')).toHaveCount(4);
        await expect(editor().locator('.knowledge-check.preview')).not.toContainText('solve one problem');
        await editor().getByRole('button', { name: 'Write', exact: true }).click();
        await role('member'); await lesson('lesson_5');
        await expect(kc()).toContainText('3 questions · 4 points', { timeout: 5000 });
    });
    await check('publishing makes the new question live; earlier attempts keep the questions they answered', async () => {
        await role('admin'); await studio('Cut it down to the useful part'); await publish();
        await role('member'); await lesson('lesson_5');
        await expect(kc()).toContainText('4 questions · 5 points · Pass mark 75% · 1 of 3 attempts left');
        await expect(kc().locator('.quiz-attempt').first().locator('.quiz-attempt-answers > li')).toHaveCount(3);
        await kc().getByRole('button', { name: 'Try again' }).click();
        await expect(kc().locator('.quiz-question')).toHaveCount(4);
        await expect(kc()).not.toContainText('solve one problem');
        await kc().getByRole('button', { name: 'Cancel' }).click();
    });
    await check('removing a check keeps the learner’s earlier attempts and feedback', async () => {
        await role('admin'); await studio('Test before you celebrate');
        await quiz().getByRole('button', { name: 'Remove knowledge check' }).click();
        await expect(quiz().getByRole('button', { name: 'Add a knowledge check' })).toBeVisible();
        await save(); await publish();
        await role('member'); await lesson('lesson_6');
        await expect(kc()).toContainText('This lesson no longer has a knowledge check. Your earlier attempts are kept here.');
        await expect(kc()).toContainText(FEEDBACK); await expect(kc().locator('.quiz-question')).toHaveCount(0);
    });
    await check('the studio editor and review queue pass accessibility checks', async () => {
        await role('admin'); await studio('Cut it down to the useful part'); await quiz().scrollIntoViewIfNeeded();
        await page.screenshot({ path: dir + '/studio-editor-desktop.png', fullPage: false, animations: 'disabled' }); await overflow(); await a11y('studio-desktop');
        await queue(); await page.screenshot({ path: dir + '/review-queue-desktop.png', fullPage: false, animations: 'disabled' }); await a11y('queue-after-review');
    });
    await check('390px and 360px knowledge-check screens stay within the viewport', async () => {
        await page.setViewportSize({ width: 390, height: 844 });
        await overflow(); await a11y('queue-mobile');
        await page.locator('.quiz-review-card').first().screenshot({ path: dir + '/review-card-mobile.png', animations: 'disabled' });
        await studio('Cut it down to the useful part'); await quiz().scrollIntoViewIfNeeded(); await overflow(); await a11y('studio-mobile');
        await role('member'); await lesson('lesson_5'); await kc().scrollIntoViewIfNeeded(); await overflow(); await a11y('learner-mobile');
        await page.screenshot({ path: dir + '/learner-mobile.png', fullPage: false, animations: 'disabled' });
        await page.setViewportSize({ width: 360, height: 800 }); await overflow();
        await page.setViewportSize({ width: 1512, height: 1100 });
    });
    await check('the second community has no knowledge checks from the first', async () => {
        await page.getByRole('button', { name: 'Open Studio North demo community' }).click(); await lesson('lesson_5');
        await expect(page.locator('.lesson-content')).toBeVisible(); await expect(kc()).toHaveCount(0);
    });
    await check('a long review queue opens 20 at a time, oldest first, with exact counts, and moves focus to the new answers', async () => {
        // A second page starts from fictional demo data with 45 waiting answers, placed in its browser storage before the app loads.
        const state = createSeed(), first = state.quizAttempts[0];
        const learners = ['member_alex', 'member_maya', 'member_jordan', 'member_theo', 'member_sofia', 'member_nia'];
        state.quizAttempts = Array.from({ length: 45 }, (_, i) => ({ ...structuredClone(first), id: `attempt_wait_${String(i).padStart(2, '0')}`, userId: learners[i % learners.length], attemptNumber: 1 + Math.floor(i / learners.length), createdAt: new Date(Date.parse('2026-09-20T09:00:00.000Z') + i * 3600000).toISOString() }));
        const crowded = await context.newPage(); crowded.setDefaultTimeout(10000); crowded.on('pageerror', e => errors.push(e.message));
        // The same bundled preview, served at a stand-in address inside this browser so it has its own storage. Nothing leaves the machine.
        const html = await readFile(root + '/.preview/REUNIR-preview.html', 'utf8');
        await crowded.route('http://reunir-preview.test/**', route => route.fulfill({ status: 200, contentType: 'text/html', body: html }));
        await crowded.addInitScript(([key, value]) => { if (!localStorage.getItem(key)) localStorage.setItem(key, value); }, ['reunir.alpha1.v1.code-black', JSON.stringify(state)] as [string, string]);
        try {
            await crowded.goto('http://reunir-preview.test/', { waitUntil: 'load' });
            await switchPreviewRole(crowded, 'admin');
            await crowded.locator('.sidebar a[href="#/admin"]').click(); await crowded.getByRole('button', { name: /^Knowledge checks · \d+$/ }).click();
            const queue = crowded.locator('.quiz-review'), cards = queue.locator(':scope > .review-grid .quiz-review-card');
            await expect(queue.locator('.quiz-review-heading')).toContainText('45');
            await expect(cards).toHaveCount(20);
            await expect(queue.locator(':scope > .review-more')).toContainText('Showing 20 of 45 waiting answers.');
            await expect(cards.first().locator('h2')).toHaveId('quiz-review-attempt_wait_00');
            await queue.locator(':scope > .review-more').getByRole('button', { name: 'Show 20 more', exact: true }).click();
            await expect(cards).toHaveCount(40);
            await expect(crowded.locator('#quiz-review-attempt_wait_20')).toBeFocused();
            await queue.locator(':scope > .review-more').getByRole('button', { name: 'Show 5 more', exact: true }).click();
            await expect(cards).toHaveCount(45);
            await expect(crowded.locator('#quiz-review-attempt_wait_40')).toBeFocused();
            await expect(queue.locator(':scope > .review-more')).toHaveCount(0);
            const a = await new AxeBuilder({ page: crowded }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
            expect(a.violations.map(v => v.id)).toEqual([]);
        } finally { await crowded.close(); }
    });
    await check('the knowledge-check journey causes no unhandled browser exceptions', async () => { expect(errors).toEqual([]); });
    await writeFile(dir + '/browser-results.json', JSON.stringify({ generatedAt: new Date().toISOString(), method: 'Actual bundled React in Chromium with fictional browser-local data; no hosted service.', results, errors }, null, 2));
    console.log(results.length + ' knowledge-check browser checks passed');
} catch (e) { await page.screenshot({ path: dir + '/failure.png', fullPage: true }).catch(() => {}); await writeFile(dir + '/browser-results.json', JSON.stringify({ results, errors, failure: String(e) }, null, 2)); throw e; } finally { await browser.close(); }
