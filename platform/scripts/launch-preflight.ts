/**
 * Offline launch preflight. Reads environment variable NAMES and checks their SHAPE for a production launch.
 * It never prints a value, never opens a connection and never calls a provider. A pass is not launch approval:
 * see docs/LAUNCH_RUNBOOK.md for the steps that only a hosted test can prove.
 *
 *   npm run launch:preflight                          (process environment, plus platform/.env if present)
 *   npm run launch:preflight -- --env-file <path>     (only that file, for a staged production value set)
 *   npm run launch:preflight -- --json
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseEnv } from 'node:util';
import { adminTwoFactorSetting } from '../packages/contracts/src/two-factor';
import { emailVerificationSetting } from '../packages/contracts/src/email';
import { uploadScanningSetting } from '../apps/api/src/config';

export type Environment = Readonly<Record<string, string | undefined>>;
export type FindingState = 'pass' | 'warn' | 'fail';
export interface Finding { key: string; state: FindingState; message: string; }

const SECRET_MIN = 32;
const filled = (v: string | undefined): v is string => !!v && !!v.trim();
const placeholder = (v: string) => /^(test|change.?me|example|replace.?me|secret|password|xxx|todo)/i.test(v) || /^<.*>$/.test(v.trim());
/** Usernames that are database owners or administrators on common hosts, never an application runtime role. */
const ADMIN_USERS = new Set(['postgres', 'neondb_owner', 'root', 'admin', 'cloud_admin', 'superuser', 'rdsadmin', 'azure_superuser']);
const SECRET_LIKE = /SECRET|PASSWORD|TOKEN|PRIVATE|CREDENTIAL|DATABASE|API_KEY/i;

function parseUrl(value: string | undefined): URL | undefined {
    try { return value ? new URL(value) : undefined; } catch { return undefined; }
}
function secretShape(name: string, value: string | undefined, required: boolean, why: string): Finding {
    if (!filled(value)) return { key: name, state: required ? 'fail' : 'warn', message: `${name} is not set. ${why}` };
    if (value.length < SECRET_MIN) return { key: name, state: 'fail', message: `${name} is shorter than ${SECRET_MIN} characters. Generate a new random value.` };
    if (placeholder(value)) return { key: name, state: 'fail', message: `${name} looks like a placeholder or example. Generate a new random value.` };
    return { key: name, state: 'pass', message: `${name} is present and at least ${SECRET_MIN} characters. Randomness cannot be inferred from length.` };
}

/** Pure: the result depends only on `env` and never contains any value from it. */
export function inspectLaunch(env: Environment): Finding[] {
    const out: Finding[] = [];
    const add = (key: string, state: FindingState, message: string) => out.push({ key, state, message });

    add('NODE_ENV', env.NODE_ENV === 'production' ? 'pass' : 'fail', env.NODE_ENV === 'production'
        ? 'NODE_ENV is production, so the runtime role and HTTPS checks run at startup.'
        : 'Set NODE_ENV=production on the deployed server. Without it the startup safety checks are skipped.');

    add('VITE_DATA_MODE', env.VITE_DATA_MODE === 'live' ? 'pass' : 'fail', env.VITE_DATA_MODE === 'live'
        ? 'VITE_DATA_MODE is live. It must also be present at build time, then rebuild.'
        : 'Set VITE_DATA_MODE=live for the build. Otherwise the deployed frontend is the fictional demonstration.');

    const origin = parseUrl(env.APP_ORIGIN);
    if (!filled(env.APP_ORIGIN) || !origin) add('APP_ORIGIN', 'fail', 'APP_ORIGIN is missing or not a valid URL.');
    else if (origin.protocol !== 'https:') add('APP_ORIGIN', 'fail', 'APP_ORIGIN must use https for a launch.');
    else if (origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/') add('APP_ORIGIN', 'fail', 'APP_ORIGIN must be a bare origin: no path, query, fragment or credentials.');
    else if (['localhost', '127.0.0.1', '[::1]', '0.0.0.0'].includes(origin.hostname)) add('APP_ORIGIN', 'fail', 'APP_ORIGIN points at this machine. Use the confirmed hosted name.');
    else add('APP_ORIGIN', 'pass', 'APP_ORIGIN is a canonical https origin.');

    const db = parseUrl(env.DATABASE_URL);
    const migration = parseUrl(env.MIGRATION_DATABASE_URL);
    if (!filled(env.DATABASE_URL)) add('DATABASE_URL', 'fail', 'DATABASE_URL is not set. Use the pooled connection for the restricted reunir_app role.');
    else if (env.DATABASE_URL.startsWith('pglite:')) add('DATABASE_URL', 'fail', 'DATABASE_URL is an embedded development database. Production requires PostgreSQL.');
    else if (!db || !['postgres:', 'postgresql:'].includes(db.protocol)) add('DATABASE_URL', 'fail', 'DATABASE_URL is not a postgres:// or postgresql:// connection string.');
    else {
        const user = decodeURIComponent(db.username).toLowerCase();
        if (!user) add('DATABASE_URL', 'fail', 'DATABASE_URL has no username. Use the reunir_app role explicitly.');
        else if (ADMIN_USERS.has(user) || user.endsWith('_owner')) add('DATABASE_URL', 'fail', 'DATABASE_URL uses an owner or administrative role. Use the restricted reunir_app role.');
        else if (migration && decodeURIComponent(migration.username).toLowerCase() === user) add('DATABASE_URL', 'fail', 'DATABASE_URL uses the same role as MIGRATION_DATABASE_URL. The runtime role must be separate.');
        else if (user !== 'reunir_app') add('DATABASE_URL', 'warn', 'DATABASE_URL does not use reunir_app. db:grant-runtime only grants that role; confirm the equivalent restricted role with its administrator.');
        else add('DATABASE_URL', 'pass', 'DATABASE_URL uses the reunir_app role. Its privileges are checked at startup, not here.');
        if (!db.password) add('DATABASE_URL.password', 'warn', 'DATABASE_URL carries no password. Confirm how the runtime role authenticates.');
        if (['localhost', '127.0.0.1', '[::1]'].includes(db.hostname)) add('DATABASE_URL.host', 'fail', 'DATABASE_URL points at this machine. A hosted runtime needs the hosted database.');
        else if (db.hostname.endsWith('.neon.tech') && !db.hostname.includes('-pooler')) add('DATABASE_URL.host', 'warn', 'DATABASE_URL is a direct Neon host. Serverless functions should use the pooled (-pooler) host.');
    }

    const privileged = ['MIGRATION_DATABASE_URL', 'BOOTSTRAP_PASSWORD', 'DB_RUNTIME_PASSWORD'].filter(k => filled(env[k]));
    add('provisioning-credentials', privileged.length ? 'fail' : 'pass', privileged.length
        ? `Remove from the deployed environment: ${privileged.join(', ')}. They belong only to a one-off local migration or provisioning shell.`
        : 'No migration or provisioning credentials are present.');
    const provisioningNames = ['BOOTSTRAP_EMAIL', 'BOOTSTRAP_NAME'].filter(k => filled(env[k]));
    if (provisioningNames.length) add('provisioning-names', 'warn', `${provisioningNames.join(', ')} are provisioning-only. Remove them from the deployed environment.`);

    add('ALLOW_FICTIONAL_SEED', env.ALLOW_FICTIONAL_SEED === 'yes' ? 'fail' : 'pass', env.ALLOW_FICTIONAL_SEED === 'yes'
        ? 'ALLOW_FICTIONAL_SEED=yes must not be set for a launch.' : 'Fictional seeding is not enabled.');

    const exposed = Object.keys(env).filter(k => k.startsWith('VITE_') && filled(env[k]) && SECRET_LIKE.test(k)).sort();
    add('client-boundary', exposed.length ? 'fail' : 'pass', exposed.length
        ? `These VITE_ names would be compiled into the browser bundle: ${exposed.join(', ')}. Rename them without VITE_.`
        : 'No secret-like VITE_ variables are present.');

    out.push(secretShape('BETTER_AUTH_SECRET', env.BETTER_AUTH_SECRET, true, 'Sessions cannot be signed.'));

    const twoStep = adminTwoFactorSetting(env);
    if (!twoStep) add('ADMIN_TWO_FACTOR', 'fail', 'ADMIN_TWO_FACTOR must be required or optional. The server refuses to start otherwise.');
    else if (twoStep === 'optional') add('ADMIN_TWO_FACTOR', 'warn', 'ADMIN_TWO_FACTOR=optional lets owners and administrators use their tools without two-step sign-in.');
    else add('ADMIN_TWO_FACTOR', 'pass', 'Owners and administrators need two-step sign-in to use their tools.');
    const confirm = emailVerificationSetting(env);
    if (!confirm) add('EMAIL_VERIFICATION', 'fail', 'EMAIL_VERIFICATION must be required or optional. The server refuses to start otherwise.');
    else if (confirm === 'optional') add('EMAIL_VERIFICATION', 'warn', 'EMAIL_VERIFICATION=optional lets people sign in before confirming their email address.');
    else add('EMAIL_VERIFICATION', 'pass', 'People confirm their email address before they can sign in, once mail can be sent.');

    const hasKey = filled(env.RESEND_API_KEY), hasFrom = filled(env.EMAIL_FROM);
    const mail = hasKey && hasFrom;
    if (hasKey !== hasFrom) add('mail-pair', 'fail', 'Set both RESEND_API_KEY and EMAIL_FROM, or neither.');
    else if (!mail) add('mail-pair', 'warn', 'No mail provider is configured. Invitations, password recovery and digests will be unavailable.');
    else add('mail-pair', 'pass', 'A mail provider key and sender are configured. Sender verification is not proven here.');
    if (hasKey && !/^re_[A-Za-z0-9_]{8,}$/.test(env.RESEND_API_KEY!.trim())) add('RESEND_API_KEY', 'warn', 'RESEND_API_KEY does not have the usual re_ shape. Confirm it is a sending key.');
    if (hasFrom && !/^(?:[^<>]*<\s*)?[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+(?:\s*>)?$/.test(env.EMAIL_FROM!.trim())) add('EMAIL_FROM', 'fail', 'EMAIL_FROM is not an address or "Name <address>" form.');
    // Resend's shared test sender needs no domain but delivers only to the Resend account's own address (decision 047).
    else if (hasFrom && /@resend\.dev\s*>?$/i.test(env.EMAIL_FROM!.trim())) add('EMAIL_FROM', 'warn', 'EMAIL_FROM uses the resend.dev test sender. Mail reaches only the Resend account owner, so invitations to anyone else will not arrive. Verify a domain before inviting others.');

    const enc = secretShape('EMAIL_ENCRYPTION_KEY', env.EMAIL_ENCRYPTION_KEY, mail, 'Production mail requires an independent key.');
    out.push(enc.state === 'warn' ? { ...enc, message: 'EMAIL_ENCRYPTION_KEY is not set. Required once mail is configured.' } : enc);

    // The daily retention job needs the scheduler secret whether or not mail is configured.
    out.push(secretShape('CRON_SECRET', env.CRON_SECRET, true, mail ? 'Mail is queued but nothing can drain it, and the retention job cannot run.' : 'The scheduled retention job cannot run, so housekeeping records would never be cleared.'));

    const secrets = (['BETTER_AUTH_SECRET', 'EMAIL_ENCRYPTION_KEY', 'CRON_SECRET'] as const).filter(k => filled(env[k]));
    const reused: string[] = [];
    for (let i = 0; i < secrets.length; i++) for (let j = i + 1; j < secrets.length; j++)
        if (env[secrets[i]] === env[secrets[j]]) reused.push(`${secrets[i]} and ${secrets[j]}`);
    if (reused.length) add('secret-independence', 'fail', `Secrets must be independent; these are identical: ${reused.join('; ')}.`);
    else if (secrets.length > 1) add('secret-independence', 'pass', 'Configured secrets are distinct from one another.');

    const bucket = env.GCS_BUCKET?.trim();
    if (filled(env.GCS_CREDENTIALS_JSON) && !bucket) add('storage-pair', 'fail', 'GCS_CREDENTIALS_JSON is set without GCS_BUCKET.');
    else if (!bucket) add('storage-pair', 'warn', 'No GCS_BUCKET. Uploads, lesson files and covers will be unavailable; text and links still work.');
    else {
        if (!/^[a-z0-9][a-z0-9._-]{1,61}[a-z0-9]$/.test(bucket) || bucket.startsWith('goog')) add('GCS_BUCKET', 'fail', 'GCS_BUCKET is not a valid bucket name (3 to 63 lowercase letters, digits, dots, hyphens, underscores).');
        else add('GCS_BUCKET', 'pass', 'GCS_BUCKET is a valid bucket name. IAM and CORS are not checked here.');
        if (!filled(env.GCS_CREDENTIALS_JSON)) add('GCS_CREDENTIALS_JSON', 'warn', 'No GCS_CREDENTIALS_JSON, so application default credentials are used. Vercel does not provide them; confirm the host does.');
        else {
            let shape = false;
            try { const j = JSON.parse(env.GCS_CREDENTIALS_JSON!); shape = !!j && typeof j === 'object' && typeof j.client_email === 'string' && typeof j.private_key === 'string'; } catch { /* redacted */ }
            add('GCS_CREDENTIALS_JSON', shape ? 'pass' : 'fail', shape ? 'GCS_CREDENTIALS_JSON parses and has a client identity and signing key.' : 'GCS_CREDENTIALS_JSON is not service-account JSON with client_email and private_key.');
        }
    }
    // Virus scanning (decision 023): with a bucket, production refuses to start without a scanner unless it is made optional.
    const scanning = uploadScanningSetting(env), clamHost = filled(env.CLAMAV_HOST), clamPort = env.CLAMAV_PORT?.trim();
    if (!scanning) add('UPLOAD_SCANNING', 'fail', 'UPLOAD_SCANNING must be required or optional. The server refuses to start otherwise.');
    else if (clamPort && !(/^\d+$/.test(clamPort) && Number(clamPort) >= 1 && Number(clamPort) <= 65535)) add('CLAMAV_PORT', 'fail', 'CLAMAV_PORT must be a TCP port number. The server refuses to start otherwise.');
    else if (!bucket) { if (clamHost) add('upload-scanning', 'warn', 'CLAMAV_HOST is set without GCS_BUCKET, so there are no uploads to scan.'); }
    else if (clamHost) add('upload-scanning', 'pass', 'A ClamAV scanner is configured. Uploads wait until the scan worker has checked them, so run npm run scan:worker beside clamd and confirm clamd answers with npm run scan:check from the same network.');
    else if (scanning === 'required') add('upload-scanning', 'fail', 'Uploads must be scanned, but CLAMAV_HOST is not set. The server refuses to start; run clamd and set CLAMAV_HOST, or set UPLOAD_SCANNING=optional deliberately.');
    else add('upload-scanning', 'warn', 'UPLOAD_SCANNING=optional with no scanner: uploads are only checked for type and size.');
    const video = env.LESSON_VIDEO_MAX_MB?.trim();
    if (video && (!/^[0-9]{1,3}$/.test(video) || Number(video) > 500)) add('LESSON_VIDEO_MAX_MB', 'fail', 'LESSON_VIDEO_MAX_MB must be a whole number from 0 to 500. The server refuses to start otherwise.');
    else if (video && Number(video) > 0 && !bucket) add('LESSON_VIDEO_MAX_MB', 'warn', 'LESSON_VIDEO_MAX_MB is set, but without GCS_BUCKET no uploads, video included, are possible.');
    // The scan worker streams each upload to clamd, which refuses streams over its StreamMaxLength (25 MB by default).
    else if (video && Number(video) > 25 && clamHost) add('LESSON_VIDEO_MAX_MB', 'warn', `Lesson video up to ${Number(video)} MB is on and uploads are scanned. Set clamd StreamMaxLength to at least ${Number(video)}M, or large videos wait unscanned and are never served.`);
    else if (video && Number(video) > 0) add('LESSON_VIDEO_MAX_MB', 'pass', 'Lesson video uploads are on. Size the bucket and its budget for videos of this size.');
    // Template placeholders from .env.staging.example that were never replaced. Names only, never values.
    const unfilled = Object.keys(env).filter(k => env[k]?.includes('<fill:')).sort();
    if (unfilled.length) add('unfilled', 'fail', `Replace the <fill: ...> placeholders in: ${unfilled.join(', ')}.`);
    return out;
}

export function formatFindings(findings: Finding[]): string {
    const failed = findings.filter(f => f.state === 'fail').length, warned = findings.filter(f => f.state === 'warn').length;
    return ['REUNIR launch preflight (offline, values redacted)', ...findings.map(f => `[${f.state}] ${f.key}: ${f.message}`),
        `${failed} failed, ${warned} warnings. A clean result is not launch approval; see docs/LAUNCH_RUNBOOK.md.`].join('\n');
}

async function main(argv: string[]): Promise<number> {
    let env: Environment;
    const fileAt = argv.indexOf('--env-file');
    const known = new Set(['--json', '--env-file', '--help']);
    if (argv.some((a, i) => !known.has(a) && (fileAt < 0 || i !== fileAt + 1)) || (fileAt >= 0 && !argv[fileAt + 1])) { console.error('Usage: npm run launch:preflight -- [--env-file <path>] [--json]'); return 2; }
    if (argv.includes('--help')) { console.log('Offline shape check of the launch environment. No values printed, no network. Exit 1 on any failure.\nnpm run launch:preflight -- [--env-file <path>] [--json]'); return 0; }
    const json = argv.includes('--json');
    if (fileAt >= 0) {
        try { env = parseEnv(readFileSync(resolve(argv[fileAt + 1]), 'utf8')); }
        catch { console.error('Could not read or parse the environment file.'); return 2; }
    } else { await import('./env'); env = process.env; }
    const findings = inspectLaunch(env);
    console.log(json ? JSON.stringify({ offline: true, findings }, null, 2) : formatFindings(findings));
    return findings.some(f => f.state === 'fail') ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) process.exitCode = await main(process.argv.slice(2));
