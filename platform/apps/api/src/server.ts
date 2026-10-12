import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { bootstrap } from './bootstrap';
const { app, db } = await bootstrap();
app.get('/assets/*', serveStatic({ root: './dist' }));
app.get('/hero.jpg', serveStatic({ root: './dist' }));
for (const file of ['/og.png', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png', '/manifest.webmanifest']) app.get(file, serveStatic({ root: './dist' }));
app.get('/', serveStatic({ path: './dist/index.html' }));
const server = serve({ fetch: app.fetch, hostname: process.env.HOST || '127.0.0.1', port: Number(process.env.PORT || 8787) });
console.log('REUNIR API listening. Application data is served only to authenticated members.');
for (const signal of ['SIGINT', 'SIGTERM'] as const)
    process.on(signal, () => { server.close(async () => { await db.close(); process.exit(0); }); });
