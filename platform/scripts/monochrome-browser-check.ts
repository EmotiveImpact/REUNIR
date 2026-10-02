import { switchPreviewRole } from './ui-test-helpers';
/** Actual bundled React; fictional local data only. Not hosted acceptance. */
import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..'), dir = root + '/evidence/monochrome';
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: true });
const context = await browser.newContext({ viewport: { width: 1512, height: 1100 } });
const page = await context.newPage(); page.setDefaultTimeout(10000);
const results: { name: string; passed: boolean }[] = [], errors: string[] = [];
page.on('pageerror', e => errors.push(e.message));
async function check(name: string, fn: () => Promise<void>) { await fn(); results.push({ name, passed: true }); console.log('PASS', name); }
async function nav(path: string) {
 if ((page.viewportSize()?.width || 1512) < 1000 && !(await page.locator('.sidebar').evaluate(el => el.classList.contains('open')))) await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
 await page.locator(`.sidebar a[href="${path}"]`).first().click();
}
async function neutral() {
 const failures = await page.evaluate(() => {
  const failures: string[] = [];
  for (const el of document.querySelectorAll<HTMLElement>('#root *')) {
   if (!el.getClientRects().length) continue;
   const s = getComputedStyle(el);
   for (const p of ['color', 'backgroundColor', 'borderTopColor', 'outlineColor'] as const) {
    const m = s[p].match(/^rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/);
    if (m && Math.max(+m[1], +m[2], +m[3]) - Math.min(+m[1], +m[2], +m[3]) > 1) failures.push(`${el.tagName}.${el.className}: ${p}=${s[p]}`);
   }
   if (s.backgroundImage.includes('gradient') && !el.classList.contains('progress-ring') && !el.classList.contains('v4-progress-ring')) failures.push('Decorative gradient: ' + el.className);
  }
  return failures.slice(0, 20);
 }); expect(failures).toEqual([]);
}
async function overflow() { expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); }
async function a11y(name: string) {
 const a = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
 await writeFile(`${dir}/a11y-${name}.json`, JSON.stringify({ violations: a.violations, incomplete: a.incomplete }, null, 2));
 expect(a.violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) }))).toEqual([]);
}
const shot = (name: string) => page.screenshot({ path: dir + '/' + name + '.png', animations: 'disabled' });
try {
 await page.setContent(await readFile(root + '/.preview/REUNIR-preview.html', 'utf8'), { waitUntil: 'load' });
 await check('purpose-led home survives presentation change', async () => { await expect(page.locator('h1')).toContainText('Build together.'); });
 await check('home colours are neutral without decorative gradients', neutral);
 await check('no whole-app filter alters original member imagery', async () => { for (const s of ['html','body','#root','.app-main']) expect(await page.locator(s).evaluate(el => getComputedStyle(el).filter)).toBe('none'); });
 await check('stored accent choices render the same monochrome contract', async () => {
  for (const a of ['violet','mint','blue','amber']) { await page.evaluate(v => { document.documentElement.dataset.accent = v; }, a); await neutral(); expect(await page.locator('html').evaluate(el => getComputedStyle(el).getPropertyValue('--accent').trim())).toBe('#f5f5f5'); }
 });
 await check('keyboard focus remains visibly outlined without a colour accent', async () => {
  await page.keyboard.press('Tab');
  const focus = await page.evaluate(() => { const s = getComputedStyle(document.activeElement!); return { style:s.outlineStyle, width:parseFloat(s.outlineWidth) }; });
  expect(focus.style).not.toBe('none'); expect(focus.width).toBeGreaterThanOrEqual(2);
  await page.evaluate(() => (document.activeElement as HTMLElement).blur());
 });
 await check('desktop home is readable and accessible', async () => { await overflow(); await a11y('home'); await shot('home-desktop'); });
 await check('learning retains purpose and neutral controls', async () => { await nav('/paths'); await neutral(); await overflow(); });
 await check('workboard retains labelled progress without coloured columns', async () => {
  await nav('/projects'); await page.locator('.project-card').filter({ hasText:'Common Ground' }).first().click(); await page.getByRole('link',{ name:'Open project workspace' }).click();
  await expect(page.locator('.work-board .work-card')).toHaveCount(4); await neutral(); await overflow(); await a11y('workboard'); await shot('workboard-desktop');
 });
 await check('inbox remains available with neutral surfaces', async () => { await nav('/messages'); await neutral(); await overflow(); });
 await switchPreviewRole(page,'admin');
 await check('settings describe the actual monochrome interface', async () => { await nav('/settings'); await expect(page.locator('.appearance-note')).toContainText('monochrome interface'); await expect(page.getByRole('radio')).toHaveCount(0); await neutral(); await a11y('settings'); });
 await check('settings save without choosing a display accent', async () => { await page.getByLabel('Community name',{ exact:true }).fill('Code Black'); await page.getByRole('button',{ name:'Save community settings',exact:true }).click(); await expect(page.getByRole('button',{ name:'Save community settings',exact:true })).toBeEnabled(); await expect(page.locator('.breadcrumb>span')).toHaveText('Code Black'); });
 await check('creator remains neutral and supports private drafts', async () => {
  await nav('/paths'); await page.locator('a[href="/learn"]').first().click(); await page.locator('.track-card[href="/learn/track_product"]').click(); await page.getByRole('link',{ name:'Creator studio',exact:true }).click(); await page.locator('.creator-title').filter({ hasText:'Choose one real problem' }).click();
  await expect(page.locator('.creator-editor')).toContainText('matches the published lesson'); await neutral(); await overflow(); await a11y('creator'); await shot('creator-desktop');
 });
 await check('390px creator remains readable with visible controls', async () => { await page.setViewportSize({ width:390,height:844 }); await overflow(); await neutral(); await page.locator('.creator-editor').scrollIntoViewIfNeeded(); await a11y('creator-mobile'); await shot('creator-mobile'); });
 await check('360px home keeps navigation without horizontal overflow', async () => { await page.setViewportSize({ width:360,height:800 }); await nav('/'); await overflow(); await neutral(); await page.evaluate(() => scrollTo(0,0)); await shot('home-mobile'); });
 await check('no unhandled errors in the monochrome journey', async () => { expect(errors).toEqual([]); });
 await writeFile(dir+'/browser-results.json',JSON.stringify({ method:'Bundled React in local Chromium, fictional state; not hosted acceptance.',results,errors },null,2)); console.log(results.length+' monochrome browser checks passed');
} catch (e) { await page.screenshot({ path:dir+'/failure.png',fullPage:true }).catch(()=>{}); await writeFile(dir+'/browser-results.json',JSON.stringify({ results,errors,failure:String(e) },null,2)); throw e; }
finally { await browser.close(); }
