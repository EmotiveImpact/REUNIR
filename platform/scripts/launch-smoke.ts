/**
 * Hosted smoke check for a deployed staging site. Sends only unauthenticated GET requests, never a secret, cookie or
 * form, and prints no response body. It proves the deployment answers as a live, locked-down REUNIR server; the
 * signed-in and privacy checks in docs/LAUNCH_RUNBOOK.md section 9 still need a person in a real browser.
 *
 *   npm run launch:smoke -- --origin https://<staging-hostname>
 *   npm run launch:smoke -- --origin https://<staging-hostname> --expect-version 0.39.0-alpha.1 --json
 */
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { RELEASE_VERSION } from '../packages/contracts/src/operations';
import type { Finding, FindingState } from './launch-preflight';

export interface Observed { status: number; headers: Headers; body: string; }
export type Observations = Readonly<Record<string, Observed | undefined>>;
type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

/** Every path the smoke check reads. Internal routes must refuse a request without the scheduler header. */
export const SMOKE_PATHS = ['/', '/api/health/live', '/api/health', '/api/internal/mail', '/api/internal/digests', '/api/internal/retention'] as const;
const INTERNAL = SMOKE_PATHS.filter(p => p.startsWith('/api/internal/'));

function json(o: Observed | undefined): Record<string, unknown> | undefined {
    try { const v = o ? JSON.parse(o.body) : undefined; return v && typeof v === 'object' ? v as Record<string, unknown> : undefined; } catch { return undefined; }
}

/** Pure: judges what the server returned. Messages name fields and states, never echo a response body. */
export function inspectSmoke(seen: Observations, expectedVersion: string): Finding[] {
    const out: Finding[] = [];
    const add = (key: string, state: FindingState, message: string) => out.push({ key, state, message });
    const unreachable = (path: string) => add(path, 'fail', `${path} could not be reached. Check the hostname, DNS and that the deployment finished.`);

    const live = seen['/api/health/live'], liveBody = json(live);
    if (!live) unreachable('/api/health/live');
    else if (live.status !== 200 || liveBody?.status !== 'ok') add('/api/health/live', 'fail', `/api/health/live answered ${live.status} without status ok. If the body says NOT_CONFIGURED, read the function log for the configuration error.`);
    else if (liveBody.version !== expectedVersion) add('/api/health/live', 'warn', `The application answers, but reports a different version from ${expectedVersion}. Confirm the intended commit is deployed.`);
    else add('/api/health/live', 'pass', `The application answers and reports version ${expectedVersion}.`);

    const health = seen['/api/health'], h = json(health);
    if (!health) unreachable('/api/health');
    else if (health.status === 503 && (h?.error as { code?: string } | undefined)?.code === 'NOT_CONFIGURED') add('/api/health', 'fail', 'The server refused to start (NOT_CONFIGURED). Read the Vercel function log, fix the named variable and redeploy.');
    else if (health.status !== 200 || h?.status !== 'ok') add('/api/health', 'fail', `/api/health answered ${health.status} without status ok, so the database path is not working through the runtime role.`);
    else {
        add('/api/health', h.mode === 'live' && h.database === 'postgres' ? 'pass' : 'fail', h.mode === 'live' && h.database === 'postgres'
            ? 'The live API reached PostgreSQL through the runtime role.'
            : 'The API is not in live mode on PostgreSQL. A deployed server must never serve the demonstration or an embedded database.');
        add('storage', h.storage === 'configured' ? 'pass' : 'warn', h.storage === 'configured'
            ? 'File storage is configured. Prove a real upload and download in a browser.'
            : 'File storage is not configured. Uploads, lesson files and covers report unavailable; text and links still work.');
    }

    for (const path of INTERNAL) {
        const o = seen[path];
        if (!o) unreachable(path);
        else if (o.status === 403) add(path, 'pass', `${path} refuses a request without the scheduler header.`);
        else if (o.status >= 200 && o.status < 300) add(path, 'fail', `${path} answered ${o.status} without the scheduler header. It must refuse; check CRON_SECRET and redeploy before anything else.`);
        else add(path, 'warn', `${path} answered ${o.status} rather than 403. Confirm the route is deployed and protected.`);
    }

    const page = seen['/'];
    if (!page) unreachable('/');
    else {
        const type = page.headers.get('content-type') ?? '';
        add('/', page.status === 200 && type.includes('text/html') ? 'pass' : 'fail', page.status === 200 && type.includes('text/html')
            ? 'The web application page is served.' : `The home page answered ${page.status} (${type || 'no content type'}) instead of the application page.`);
        const header = (name: string) => page.headers.get(name)?.trim() ?? '';
        const hsts = /max-age=(\d+)/i.exec(header('strict-transport-security'));
        add('Strict-Transport-Security', hsts && Number(hsts[1]) >= 15552000 ? 'pass' : 'fail', hsts && Number(hsts[1]) >= 15552000
            ? 'Browsers are told to use HTTPS for at least six months.' : 'Strict-Transport-Security is missing or shorter than six months. Deploy the vercel.json headers.');
        const expect: [string, (v: string) => boolean, string][] = [
            ['X-Content-Type-Options', v => v.toLowerCase() === 'nosniff', 'nosniff'],
            ['X-Frame-Options', v => v.toUpperCase() === 'DENY', 'DENY'],
            ['Referrer-Policy', v => v.toLowerCase() === 'no-referrer', 'no-referrer'],
            ['Permissions-Policy', v => /camera=\(\)/.test(v) && /microphone=\(\)/.test(v), 'camera and microphone turned off'],
        ];
        for (const [name, ok, want] of expect) add(name, ok(header(name)) ? 'pass' : 'fail', ok(header(name))
            ? `${name} is ${want}.` : `${name} is missing or not ${want}. Deploy the vercel.json headers.`);
        if (header('content-security-policy')) add('Content-Security-Policy', 'pass', 'A Content-Security-Policy is enforced. Check the browser console for blocked resources.');
        else if (header('content-security-policy-report-only')) add('Content-Security-Policy', 'warn', 'A Content-Security-Policy is in report-only mode. Enforce it once staging shows no violations.');
        else add('Content-Security-Policy', 'warn', 'No Content-Security-Policy yet. LAUNCH_RUNBOOK.md asks for one to be tried in report-only mode on staging.');
    }
    return out;
}

/** Fetches every smoke path once, without credentials or redirects. Bodies are kept only for judging. */
export async function observe(origin: string, fetcher: Fetcher = fetch, timeoutMs = 15000): Promise<Observations> {
    const seen: Record<string, Observed | undefined> = {};
    for (const path of SMOKE_PATHS) {
        try {
            const r = await fetcher(new URL(path, origin).href, { method: 'GET', redirect: 'manual', credentials: 'omit', signal: AbortSignal.timeout(timeoutMs), headers: { Accept: path === '/' ? 'text/html' : 'application/json' } });
            seen[path] = { status: r.status, headers: r.headers, body: (await r.text()).slice(0, 4096) };
        } catch { seen[path] = undefined; }
    }
    return seen;
}

/** The origin must be a bare https origin; plain http is allowed only for a local run with --allow-local. */
export function checkOrigin(value: string | undefined, allowLocal: boolean): string | undefined {
    let u: URL;
    try { u = new URL(value ?? ''); } catch { return undefined; }
    if (u.username || u.password || u.search || u.hash || u.pathname !== '/') return undefined;
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname);
    if (u.protocol === 'https:' && !local) return u.origin;
    return allowLocal && local ? u.origin : undefined;
}

async function main(argv: string[]): Promise<number> {
    const at = (flag: string) => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : undefined; };
    if (argv.includes('--help')) { console.log('Hosted smoke check. Unauthenticated GET requests only; no secrets sent or printed. Exit 1 on any failure.\nnpm run launch:smoke -- --origin https://<staging-hostname> [--expect-version <v>] [--json]'); return 0; }
    const origin = checkOrigin(at('--origin'), argv.includes('--allow-local'));
    if (!origin) { console.error('Usage: npm run launch:smoke -- --origin https://<staging-hostname> [--expect-version <v>] [--json]\nThe origin must be a bare https origin with no path.'); return 2; }
    const findings = inspectSmoke(await observe(origin), at('--expect-version') ?? RELEASE_VERSION);
    const failed = findings.filter(f => f.state === 'fail').length, warned = findings.filter(f => f.state === 'warn').length;
    console.log(argv.includes('--json') ? JSON.stringify({ origin, findings }, null, 2) : [
        `REUNIR launch smoke check of ${origin} (unauthenticated GET only)`, ...findings.map(f => `[${f.state}] ${f.key}: ${f.message}`),
        `${failed} failed, ${warned} warnings. Signed-in and privacy checks still need a person; see docs/LAUNCH_RUNBOOK.md section 9.`].join('\n'));
    return failed ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) process.exitCode = await main(process.argv.slice(2));
