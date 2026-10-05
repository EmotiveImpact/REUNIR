import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { inspectLaunch, type Finding } from '../scripts/launch-preflight';
import { fillSecrets, GENERATED_SECRETS, newSecret } from '../scripts/launch-secrets';
import { checkOrigin, inspectSmoke, observe, SMOKE_PATHS, type Observations } from '../scripts/launch-smoke';
import { RELEASE_VERSION } from '../packages/contracts/src/operations';

const example = readFileSync(resolve(import.meta.dirname, '../.env.staging.example'), 'utf8');
const state = (f: Finding[], key: string) => f.find(x => x.key === key)?.state;
const fails = (f: Finding[]) => f.filter(x => x.state === 'fail').map(x => x.key);

test('the staging template carries no value or provisioning credential and fails until filled', () => {
    const env = parseEnv(example);
    for (const name of ['MIGRATION_DATABASE_URL', 'DB_RUNTIME_PASSWORD', 'BOOTSTRAP_PASSWORD', 'BOOTSTRAP_EMAIL', 'ALLOW_FICTIONAL_SEED']) assert.equal(env[name], undefined, name);
    for (const name of GENERATED_SECRETS) assert.equal(env[name], '', name);
    const f = inspectLaunch(env);
    assert.equal(state(f, 'unfilled'), 'fail');
    assert.match(f.find(x => x.key === 'unfilled')!.message, /APP_ORIGIN, DATABASE_URL, EMAIL_FROM, RESEND_API_KEY/);
    assert.equal(state(f, 'BETTER_AUTH_SECRET'), 'fail');
});

test('the staging template passes the preflight once secrets are generated and placeholders replaced', () => {
    const filled = fillSecrets(example).text
        .replace('<fill: https://staging-hostname>', 'https://ferven-staging.example.test')
        .replace(/<fill: postgresql:[^>]+>/, 'postgresql://reunir_app:fakeRuntimePass9Q@ep-quiet-sky-123456-pooler.eu-central-1.aws.neon.tech/reunir?sslmode=require')
        .replace('<fill: re_...>', 're_fakeKey_7HqP2mWx9Ld')
        .replace('<fill: pilot@mail.your-domain>', '<pilot@mail.example.test>');
    const f = inspectLaunch(parseEnv(filled));
    assert.deepEqual(fails(f), []);
    // Uploads are deliberately off for the first round, so the only warning is the missing bucket.
    assert.deepEqual(f.filter(x => x.state === 'warn').map(x => x.key), ['storage-pair']);
});

test('generated secrets fill only empty values, are independent and keep everything else', () => {
    let n = 0;
    const text = '# keep me\nBETTER_AUTH_SECRET=\nCRON_SECRET="already-set-value"\nAPP_ORIGIN=https://x.example.test\n';
    const r = fillSecrets(text, () => `generated_${++n}`);
    assert.deepEqual(r.filled, ['BETTER_AUTH_SECRET', 'EMAIL_ENCRYPTION_KEY']);
    assert.deepEqual(r.kept, ['CRON_SECRET']);
    assert.equal(r.text, '# keep me\nBETTER_AUTH_SECRET=generated_1\nCRON_SECRET="already-set-value"\nAPP_ORIGIN=https://x.example.test\nEMAIL_ENCRYPTION_KEY=generated_2\n');
    assert.deepEqual(fillSecrets(r.text).filled, []);
    const a = newSecret(), b = newSecret();
    assert.notEqual(a, b);
    assert.match(a, /^[A-Za-z0-9_-]{64}$/);
});

const headers = (extra: Record<string, string> = {}) => new Headers({
    'content-type': 'text/html; charset=utf-8', 'strict-transport-security': 'max-age=31536000', 'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY', 'referrer-policy': 'no-referrer', 'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=()', ...extra,
});
const ok = (body: unknown, status = 200) => ({ status, headers: new Headers({ 'content-type': 'application/json' }), body: JSON.stringify(body) });
const healthy: Observations = {
    '/': { status: 200, headers: headers(), body: '<!doctype html>' },
    '/api/health/live': ok({ status: 'ok', version: RELEASE_VERSION }),
    '/api/health': ok({ status: 'ok', version: RELEASE_VERSION, mode: 'live', database: 'postgres', storage: 'not-configured' }),
    '/api/internal/mail': ok({ error: { code: 'FORBIDDEN' } }, 403),
    '/api/internal/digests': ok({ error: { code: 'FORBIDDEN' } }, 403),
    '/api/internal/retention': ok({ error: { code: 'FORBIDDEN' } }, 403),
};

test('a healthy staging deployment passes the smoke check, warning only about storage and CSP', () => {
    const f = inspectSmoke(healthy, RELEASE_VERSION);
    assert.deepEqual(fails(f), []);
    assert.deepEqual(f.filter(x => x.state === 'warn').map(x => x.key), ['storage', 'Content-Security-Policy']);
});

test('the smoke check fails an open scheduler route, a demonstration API, a refused start and missing headers', () => {
    assert.deepEqual(fails(inspectSmoke({ ...healthy, '/api/internal/mail': ok({ sent: 0, failed: 0 }) }, RELEASE_VERSION)), ['/api/internal/mail']);
    assert.deepEqual(fails(inspectSmoke({ ...healthy, '/api/health': ok({ status: 'ok', mode: 'live', database: 'pglite' }) }, RELEASE_VERSION)), ['/api/health']);
    const refused = inspectSmoke({ ...healthy, '/api/health': ok({ error: { code: 'NOT_CONFIGURED' } }, 503) }, RELEASE_VERSION);
    assert.match(refused.find(x => x.key === '/api/health')!.message, /function log/);
    const bare = inspectSmoke({ ...healthy, '/': { status: 200, headers: new Headers({ 'content-type': 'text/html' }), body: '' } }, RELEASE_VERSION);
    assert.deepEqual(fails(bare), ['Strict-Transport-Security', 'X-Content-Type-Options', 'X-Frame-Options', 'Referrer-Policy', 'Permissions-Policy']);
    assert.equal(state(inspectSmoke(healthy, '9.9.9'), '/api/health/live'), 'warn');
    assert.deepEqual(fails(inspectSmoke({}, RELEASE_VERSION)), ['/api/health/live', '/api/health', '/api/internal/mail', '/api/internal/digests', '/api/internal/retention', '/']);
});

test('the smoke check sends only credential-free GETs and never echoes a response body', async () => {
    const seen: { url: string; init: RequestInit }[] = [];
    const secretBody = 'SECRET_BODY_MARKER_51b3';
    const observed = await observe('https://ferven-staging.example.test', async (url, init) => {
        seen.push({ url, init });
        return new Response(JSON.stringify({ status: 'nope', detail: secretBody }), { status: 500 });
    });
    assert.deepEqual(seen.map(s => new URL(s.url).pathname), [...SMOKE_PATHS]);
    for (const { init } of seen) {
        assert.equal(init.method, 'GET');
        assert.equal(init.credentials, 'omit');
        assert.equal(init.redirect, 'manual');
        assert.equal(new Headers(init.headers).get('authorization'), null);
    }
    assert.ok(!JSON.stringify(inspectSmoke(observed, RELEASE_VERSION)).includes(secretBody));
});

test('the smoke check accepts only a bare https origin, or a local one when asked', () => {
    assert.equal(checkOrigin('https://ferven-staging.example.test', false), 'https://ferven-staging.example.test');
    assert.equal(checkOrigin('http://ferven-staging.example.test', false), undefined);
    assert.equal(checkOrigin('https://ferven-staging.example.test/app', false), undefined);
    assert.equal(checkOrigin('https://user:pass@ferven-staging.example.test', false), undefined);
    assert.equal(checkOrigin('http://127.0.0.1:8787', false), undefined);
    assert.equal(checkOrigin('http://127.0.0.1:8787', true), 'http://127.0.0.1:8787');
    assert.equal(checkOrigin(undefined, false), undefined);
});

test('the scan host publishes no port and keeps its values out of git and the image', () => {
    const dir = resolve(import.meta.dirname, '../deploy/scan-host');
    const compose = readFileSync(resolve(dir, 'compose.yaml'), 'utf8');
    assert.doesNotMatch(compose, /^\s*(ports|expose|network_mode):/m);
    assert.match(compose, /env_file: scan\.env/);
    assert.match(compose, /CLAMAV_HOST: clamd/);
    assert.match(compose, /scripts\/scan-worker\.ts/);
    const example = parseEnv(readFileSync(resolve(dir, 'scan.env.example'), 'utf8'));
    assert.deepEqual(Object.keys(example).sort(), ['DATABASE_URL', 'GCS_BUCKET', 'GCS_CREDENTIALS_JSON']);
    assert.ok(Object.values(example).every(v => v?.includes('<fill:')));
    assert.match(readFileSync(resolve(import.meta.dirname, '../.dockerignore'), 'utf8'), /^deploy\/scan-host\/scan\.env$/m);
    assert.match(readFileSync(resolve(import.meta.dirname, '../../.gitignore'), 'utf8'), /^\/platform\/deploy\/scan-host\/scan\.env$/m);
});
