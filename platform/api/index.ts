import type { IncomingMessage, ServerResponse } from 'node:http';
import { getRequestListener } from '@hono/node-server';
import { bootstrap } from '../apps/api/src/bootstrap';
let listener: ReturnType<typeof getRequestListener> | undefined;
let starting: Promise<void> | undefined;
export default async function handler(req: IncomingMessage, res: ServerResponse) {
    try {
        if (!listener) {
            starting ??= bootstrap().then(({ app }) => { listener = getRequestListener(app.fetch); });
            await starting;
        }
        return listener!(req, res);
    }
    catch {
        starting = undefined;
        res.statusCode = 503;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        res.end(JSON.stringify({ error: { code: 'NOT_CONFIGURED', message: 'REUNIR server configuration needs attention. No demonstration data is served by this API.' } }));
    }
}
export const config = { api: { bodyParser: false } };
