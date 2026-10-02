import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
let html = await readFile(root + '/.standalone-dist/index.html', 'utf8');
html=html.replace(/<link[^>]*rel="modulepreload"[^>]*>/g,'');
for (const match of [...html.matchAll(/<link[^>]*href="([^"]+\.css)"[^>]*>/g)]) {
    let css = await readFile(resolve(root, '.standalone-dist', match[1].replace(/^\.\//, '')), 'utf8');
    const image = await readFile(root + '/apps/web/public/hero.jpg');
    css = css.replace(/url\([^)]*hero\.jpg[^)]*\)/g, `url(data:image/jpeg;base64,${image.toString('base64')})`);
    html = html.replace(match[0], () => `<style>${css}</style>`);
}
for (const match of [...html.matchAll(/<script[^>]*src="([^"]+\.js)"[^>]*><\/script>/g)]) {
    const js = await readFile(resolve(root, '.standalone-dist', match[1].replace(/^\.\//, '')), 'utf8');
    html = html.replace(match[0], () => `<script type="module">${js.replace(/<\/script/gi, '<\\/script')}</script>`);
}
await mkdir(root + '/.preview', { recursive: true });
await writeFile(root + '/.preview/REUNIR-preview.html', html);
console.log('Standalone React demo written to .preview/REUNIR-preview.html');
