import type { PilotCheck } from '../../../packages/contracts/src/operations';
import { adminTwoFactorSetting } from '../../../packages/contracts/src/two-factor';
import { emailVerificationSetting } from '../../../packages/contracts/src/email';
/** Whether every upload must be scanned. When unset, required in production and optional elsewhere. Null when invalid. */
export function uploadScanningSetting(env: Readonly<Record<string, string | undefined>>): 'required' | 'optional' | null {
    const raw = env.UPLOAD_SCANNING?.trim();
    if (!raw) return env.NODE_ENV === 'production' ? 'required' : 'optional';
    return raw === 'required' || raw === 'optional' ? raw : null;
}
export type Environment = Readonly<Record<string, string | undefined>>;
const filled = (v: string | undefined): boolean => !!v?.trim();
const safeSecret = (value: string | undefined): boolean => !!value && value.length >= 32 && !/^(test|change.?me|example|replace.?me)/i.test(value);
/** Pure inspection: never returns environment values, URLs, credentials or email addresses. */
export function inspectConfiguration(env: Environment): PilotCheck[] {
    const checks: PilotCheck[] = [];
    const production = env.NODE_ENV === 'production';
    let canonical = false, https = false;
    try {
        const u = new URL(env.APP_ORIGIN || '');
        canonical = ['http:', 'https:'].includes(u.protocol) && !u.username && !u.password && !u.search && !u.hash && u.pathname === '/';
        https = u.protocol === 'https:';
    } catch { /* Report a redacted error. */ }
    checks.push({key:'origin', title:'Application origin',state:canonical && (!production || https) ? 'pass' : 'blocked',detail:canonical && (!production || https) ? 'One canonical application origin is configured.' : 'Set a canonical APP_ORIGIN. Production requires HTTPS, without a path, query or credentials.'});
    checks.push({key:'auth-secret',title:'Session secret',state:safeSecret(env.BETTER_AUTH_SECRET) ? 'pass' : 'blocked',detail:safeSecret(env.BETTER_AUTH_SECRET) ? 'A non-placeholder session secret is present. Entropy is not inferred from length.' : 'Generate an independent random BETTER_AUTH_SECRET of at least 32 characters.'});
    let databaseValid = false;
    try {
        const value=env.DATABASE_URL || '';
        databaseValid = value.startsWith('pglite:') ? !production : ['postgres:','postgresql:'].includes(new URL(value).protocol);
    } catch { /* Invalid connection configuration stays private. */ }
    checks.push({key:'database-config',title:'Database configuration',state:databaseValid ? 'pass' : 'blocked',detail:databaseValid ? 'A supported database connection is configured. Access is checked separately.' : 'Configure PostgreSQL. Embedded development databases are forbidden in production.'});
    checks.push({key:'client-mode',title:'Live-mode declaration',state:env.VITE_DATA_MODE === 'live' ? 'pass' : 'blocked',detail:env.VITE_DATA_MODE === 'live' ? 'This runtime declares live mode. The deployed frontend must also be built and browser-tested in live mode.' : 'The frontend is in demonstration mode or has not declared its data mode.',action:'Set VITE_DATA_MODE=live at build time for a connected pilot, then rebuild.'});
    const dangerous = ['MIGRATION_DATABASE_URL','BOOTSTRAP_PASSWORD','DB_RUNTIME_PASSWORD'].filter(k=>filled(env[k]));
    checks.push({key:'privileged-config',title:'Administrative credentials separated',state:production && dangerous.length ? 'blocked' : 'pass',detail:production && dangerous.length ? 'Administrative provisioning credentials are present on the application runtime. Remove them.' : 'No production migration or bootstrap credentials were detected in this runtime.'});
    const exposed = Object.entries(env).some(([k,v])=>k.startsWith('VITE_') && filled(v) && /SECRET|PASSWORD|TOKEN|PRIVATE|CREDENTIAL|DATABASE|API_KEY/i.test(k));
    checks.push({key:'client-secrets',title:'Client environment boundary',state:exposed ? 'blocked' : 'pass',detail:exposed ? 'A secret-like VITE_ environment variable would be exposed to the browser. Remove it before building.' : 'No secret-like client-prefixed environment names were detected. Source and bundle scans remain required.'});
    checks.push({key:'fictional-seed',title:'Production content safety',state:production && env.ALLOW_FICTIONAL_SEED === 'yes' ? 'blocked' : 'pass',detail:production && env.ALLOW_FICTIONAL_SEED === 'yes' ? 'Fictional seeding is enabled in production configuration.' : 'Production fictional-data seeding is not enabled.'});
    const email=filled(env.RESEND_API_KEY) && filled(env.EMAIL_FROM);
    checks.push({key:'email-config',title:'Transactional email',state:email ? 'pass' : 'blocked',detail:email ? 'A provider and sender are configured. Sender verification and inbox delivery are not yet proven.' : 'Invitation and recovery delivery need both RESEND_API_KEY and EMAIL_FROM.'});
    const independent = safeSecret(env.EMAIL_ENCRYPTION_KEY) && env.EMAIL_ENCRYPTION_KEY !== env.BETTER_AUTH_SECRET;
    checks.push({key:'email-encryption',title:'Independent mail encryption key',state:independent ? 'pass' : 'blocked',detail:independent ? 'A separate encryption key is configured for pending email.' : 'Use a stable random EMAIL_ENCRYPTION_KEY, different from the session secret.'});
    const cron=safeSecret(env.CRON_SECRET);
    checks.push({key:'worker-auth',title:'Worker authentication',state:cron ? 'pass' : 'blocked',detail:cron ? 'The worker has an authentication secret. A schedule has not been inferred.' : 'Configure a random CRON_SECRET before scheduling the worker.'});
    const twoStep=adminTwoFactorSetting(env);
    checks.push({key:'admin-two-factor',title:'Two-step sign-in for administrators',state:twoStep===null ? 'blocked' : production && twoStep==='optional' ? 'warning' : 'pass',detail:twoStep===null ? 'ADMIN_TWO_FACTOR must be required or optional.' : twoStep==='required' ? 'Owners and administrators must turn on two-step sign-in before using their tools.' : production ? 'Two-step sign-in is optional for owners and administrators. Production normally requires it.' : 'Two-step sign-in is optional for owners and administrators outside production.'});
    const confirm=emailVerificationSetting(env);
    checks.push({key:'email-verification',title:'Email confirmation',state:confirm===null||(confirm==='required'&&!email) ? 'blocked' : production && confirm==='optional' ? 'warning' : 'pass',detail:confirm===null ? 'EMAIL_VERIFICATION must be required or optional.' : confirm==='required' ? (email ? 'People confirm their email address by a link before they can sign in. Invitations confirm it as they are accepted.' : 'Confirmation is required, but no email sender is configured, so the server asks for no confirmation until one is. Configure email, or set EMAIL_VERIFICATION=optional deliberately.') : production ? 'Unconfirmed email addresses can sign in. Production normally requires confirmation.' : 'Unconfirmed email addresses can sign in outside production.'});
    const scanning=uploadScanningSetting(env), bucket=filled(env.GCS_BUCKET), scanner=filled(env.CLAMAV_HOST);
    const port=env.CLAMAV_PORT?.trim(), portValid=!port || (/^\d+$/.test(port) && Number(port)>=1 && Number(port)<=65535);
    checks.push({key:'upload-scanning',title:'Virus scanning of uploads',
        state:scanning===null || !portValid ? 'blocked' : !bucket ? 'pass' : scanner ? 'unverified' : scanning==='required' ? 'blocked' : production ? 'warning' : 'pass',
        detail:scanning===null ? 'UPLOAD_SCANNING must be required or optional.'
            : !portValid ? 'CLAMAV_PORT must be a TCP port number.'
            : !bucket ? 'No attachment bucket is configured, so there are no uploads to scan.'
            : scanner ? 'A ClamAV scanner is configured. Every upload is scanned before it is used; confirm it answers with npm run scan:check.'
            : scanning==='required' ? 'Uploads must be scanned, but no scanner is configured. Set CLAMAV_HOST to a clamd service, or UPLOAD_SCANNING=optional.'
            : production ? 'Uploads are only checked for type and size. Production normally scans them with ClamAV.' : 'Uploads are not scanned outside production unless CLAMAV_HOST is set.'});
    checks.push({key:'storage',title:'Attachments',state:filled(env.GCS_BUCKET) ? 'unverified' : 'warning',detail:filled(env.GCS_BUCKET) ? 'A bucket name is configured, but IAM and attachment delivery require separate verification.' : 'No attachment bucket is configured. Text and link-based pilot features still work.'});
    return checks;
}
/** Reject unsafe runtime configurations, while allowing a server without optional email/storage. */
export function validateRuntimeConfiguration(env: Environment): void {
    const fatal = new Set(['origin','auth-secret','database-config','client-secrets','privileged-config','fictional-seed','admin-two-factor','upload-scanning']);
    // Requiring confirmation without a sender is not fatal: the server then asks for no confirmation (see bootstrap), and the
    // pilot checklist stays blocked until email is configured. An unreadable setting is fatal.
    if (emailVerificationSetting(env) === null) fatal.add('email-verification');
    if (env.NODE_ENV === 'production' && (env.RESEND_API_KEY || env.EMAIL_FROM)) fatal.add('email-encryption');
    if(env.CRON_SECRET)fatal.add('worker-auth');
    const blocked = inspectConfiguration(env).filter(c=>fatal.has(c.key) && c.state==='blocked');
    if(blocked.length)throw new Error('Unsafe REUNIR runtime configuration: '+blocked.map(c=>c.key).join(', ')+'. Run npm run pilot:check for redacted guidance.');
}
/** The validated ADMIN_TWO_FACTOR setting. Throws on anything but required or optional. */
export function adminTwoFactorMode(env: Environment) {
    const mode = adminTwoFactorSetting(env);
    if (!mode) throw new Error('Unsafe REUNIR runtime configuration: admin-two-factor. Set ADMIN_TWO_FACTOR to required or optional.');
    return mode;
}
/** The validated EMAIL_VERIFICATION setting. Throws on anything but required or optional. */
export function emailVerificationMode(env: Environment) {
    const mode = emailVerificationSetting(env);
    if (!mode) throw new Error('Unsafe REUNIR runtime configuration: email-verification. Set EMAIL_VERIFICATION to required or optional.');
    return mode;
}
