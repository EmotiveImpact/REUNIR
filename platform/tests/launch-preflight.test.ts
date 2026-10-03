import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inspectLaunch, formatFindings, type Environment, type Finding } from '../scripts/launch-preflight';

// Distinctive fake values so any leak into the output is detectable. None of these is a real credential.
const AUTH = 'fake_auth_0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a';
const ENC = 'fake_enc_1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f';
const CRON = 'fake_cron_9z8y7x6w5v4u3t2s1r0q9p8o7n6m5l4k3j';
const DBPASS = 'fakeDbPassZ8Q2w7Lr';
const KEY = 're_fakeKey_7HqP2mWx9Ld';
const FROM = 'Ferven <pilot@mail.example.test>';
const PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\\nFAKEKEYMATERIALxyz\\n-----END PRIVATE KEY-----\\n';
const GCS_JSON = JSON.stringify({ type: 'service_account', client_email: 'uploader@fake-project.iam.gserviceaccount.test', private_key: PRIVATE_KEY });
const good: Environment = {
    NODE_ENV: 'production', VITE_DATA_MODE: 'live', APP_ORIGIN: 'https://staging.ferven.example.test',
    DATABASE_URL: `postgresql://reunir_app:${DBPASS}@ep-quiet-sky-123456-pooler.eu-central-1.aws.neon.tech/reunir?sslmode=require`,
    BETTER_AUTH_SECRET: AUTH, EMAIL_ENCRYPTION_KEY: ENC, CRON_SECRET: CRON, RESEND_API_KEY: KEY, EMAIL_FROM: FROM,
    GCS_BUCKET: 'ferven-staging-uploads', GCS_CREDENTIALS_JSON: GCS_JSON, CLAMAV_HOST: 'clamav.internal',
};
const state = (f: Finding[], key: string) => f.find(x => x.key === key)?.state;
const failures = (env: Environment) => inspectLaunch(env).filter(f => f.state === 'fail').map(f => f.key);

test('a complete staging environment has no failures or warnings', () => {
    const f = inspectLaunch(good);
    assert.deepEqual(f.filter(x => x.state !== 'pass'), []);
});

test('origin must be canonical https and not local', () => {
    assert.deepEqual(failures({ ...good, APP_ORIGIN: 'http://staging.ferven.example.test' }), ['APP_ORIGIN']);
    assert.deepEqual(failures({ ...good, APP_ORIGIN: 'https://staging.ferven.example.test/app' }), ['APP_ORIGIN']);
    assert.deepEqual(failures({ ...good, APP_ORIGIN: 'https://localhost' }), ['APP_ORIGIN']);
    assert.deepEqual(failures({ ...good, APP_ORIGIN: 'not a url' }), ['APP_ORIGIN']);
    assert.deepEqual(failures({ ...good, APP_ORIGIN: undefined }), ['APP_ORIGIN']);
});

test('production and live mode are required', () => {
    assert.deepEqual(failures({ ...good, NODE_ENV: 'development' }), ['NODE_ENV']);
    assert.deepEqual(failures({ ...good, VITE_DATA_MODE: 'demo' }), ['VITE_DATA_MODE']);
});

test('runtime database must be postgres under a restricted role', () => {
    const url = (user: string, host = 'ep-quiet-sky-123456-pooler.eu-central-1.aws.neon.tech') => `postgresql://${user}:${DBPASS}@${host}/reunir`;
    for (const owner of ['neondb_owner', 'postgres', 'reunir_owner'])
        assert.deepEqual(failures({ ...good, DATABASE_URL: url(owner) }), ['DATABASE_URL'], owner);
    assert.deepEqual(failures({ ...good, DATABASE_URL: 'pglite:.local/reunir' }), ['DATABASE_URL']);
    assert.deepEqual(failures({ ...good, DATABASE_URL: 'mysql://reunir_app@host/db' }), ['DATABASE_URL']);
    assert.deepEqual(failures({ ...good, DATABASE_URL: '' }), ['DATABASE_URL']);
    assert.equal(state(inspectLaunch({ ...good, DATABASE_URL: url('pilot_runtime') }), 'DATABASE_URL'), 'warn');
    assert.equal(state(inspectLaunch({ ...good, DATABASE_URL: url('reunir_app', 'ep-quiet-sky-123456.eu-central-1.aws.neon.tech') }), 'DATABASE_URL.host'), 'warn');
    assert.deepEqual(failures({ ...good, DATABASE_URL: url('reunir_app', 'localhost') }), ['DATABASE_URL.host']);
});

test('migration and provisioning credentials must be absent from the runtime', () => {
    const f = failures({ ...good, MIGRATION_DATABASE_URL: `postgresql://neondb_owner:${DBPASS}@ep-quiet-sky-123456.eu-central-1.aws.neon.tech/reunir`, DB_RUNTIME_PASSWORD: DBPASS, BOOTSTRAP_PASSWORD: 'fake-bootstrap-pass-123' });
    assert.deepEqual(f, ['provisioning-credentials']);
    assert.ok(failures({ ...good, MIGRATION_DATABASE_URL: good.DATABASE_URL }).includes('DATABASE_URL'));
    assert.equal(state(inspectLaunch({ ...good, BOOTSTRAP_EMAIL: 'owner@example.test' }), 'provisioning-names'), 'warn');
    assert.deepEqual(failures({ ...good, ALLOW_FICTIONAL_SEED: 'yes' }), ['ALLOW_FICTIONAL_SEED']);
});

test('secret-like VITE_ variables are refused', () => {
    assert.deepEqual(failures({ ...good, VITE_CRON_SECRET: CRON }), ['client-boundary']);
});

test('secrets need length, no placeholders and independence', () => {
    assert.deepEqual(failures({ ...good, BETTER_AUTH_SECRET: 'short' }), ['BETTER_AUTH_SECRET']);
    assert.deepEqual(failures({ ...good, BETTER_AUTH_SECRET: '<generate: openssl rand -base64 48 and paste here>' }), ['BETTER_AUTH_SECRET']);
    assert.deepEqual(failures({ ...good, BETTER_AUTH_SECRET: undefined }), ['BETTER_AUTH_SECRET']);
    assert.deepEqual(failures({ ...good, EMAIL_ENCRYPTION_KEY: AUTH }), ['secret-independence']);
    assert.deepEqual(failures({ ...good, CRON_SECRET: ENC }), ['secret-independence']);
});

test('mail requires its pair, an independent key and a scheduler secret', () => {
    assert.deepEqual(failures({ ...good, EMAIL_FROM: undefined }), ['mail-pair']);
    assert.deepEqual(failures({ ...good, EMAIL_ENCRYPTION_KEY: undefined }), ['EMAIL_ENCRYPTION_KEY']);
    assert.deepEqual(failures({ ...good, CRON_SECRET: undefined }), ['CRON_SECRET']);
    assert.deepEqual(failures({ ...good, EMAIL_FROM: 'not an address' }), ['EMAIL_FROM']);
    const noMail = inspectLaunch({ ...good, RESEND_API_KEY: undefined, EMAIL_FROM: undefined, EMAIL_ENCRYPTION_KEY: undefined, CRON_SECRET: undefined });
    assert.deepEqual(noMail.filter(f => f.state === 'fail').map(f => f.key), ['CRON_SECRET'], 'the retention job needs the scheduler secret even without mail');
    assert.equal(state(noMail, 'mail-pair'), 'warn');
    assert.deepEqual(inspectLaunch({ ...good, RESEND_API_KEY: undefined, EMAIL_FROM: undefined, EMAIL_ENCRYPTION_KEY: undefined }).filter(f => f.state === 'fail'), []);
    // A configured but weak scheduler secret is fatal at startup, so it fails here even without mail.
    assert.ok(failures({ ...good, RESEND_API_KEY: undefined, EMAIL_FROM: undefined, CRON_SECRET: 'weak' }).includes('CRON_SECRET'));
});

test('owners and administrators need two-step sign-in unless the launch says otherwise', () => {
    assert.equal(state(inspectLaunch(good), 'ADMIN_TWO_FACTOR'), 'pass', 'unset means required in production');
    assert.equal(state(inspectLaunch({ ...good, ADMIN_TWO_FACTOR: 'required' }), 'ADMIN_TWO_FACTOR'), 'pass');
    assert.equal(state(inspectLaunch({ ...good, ADMIN_TWO_FACTOR: 'optional' }), 'ADMIN_TWO_FACTOR'), 'warn');
    assert(failures({ ...good, ADMIN_TWO_FACTOR: 'sometimes' }).includes('ADMIN_TWO_FACTOR'));
});

test('people confirm their email address unless the launch says otherwise', () => {
    assert.equal(state(inspectLaunch(good), 'EMAIL_VERIFICATION'), 'pass', 'unset means required in production');
    assert.equal(state(inspectLaunch({ ...good, EMAIL_VERIFICATION: 'optional' }), 'EMAIL_VERIFICATION'), 'warn');
    assert(failures({ ...good, EMAIL_VERIFICATION: 'later' }).includes('EMAIL_VERIFICATION'));
});

test('storage variables are paired and shaped', () => {
    assert.deepEqual(failures({ ...good, GCS_BUCKET: undefined }), ['storage-pair']);
    assert.equal(state(inspectLaunch({ ...good, GCS_BUCKET: undefined, GCS_CREDENTIALS_JSON: undefined }), 'storage-pair'), 'warn');
    assert.deepEqual(failures({ ...good, GCS_BUCKET: 'Bad_Bucket!' }), ['GCS_BUCKET']);
    assert.deepEqual(failures({ ...good, GCS_CREDENTIALS_JSON: '{not json' }), ['GCS_CREDENTIALS_JSON']);
    assert.equal(state(inspectLaunch({ ...good, GCS_CREDENTIALS_JSON: undefined }), 'GCS_CREDENTIALS_JSON'), 'warn');
});

test('uploads are scanned unless the launch says otherwise', () => {
    assert.equal(state(inspectLaunch(good), 'upload-scanning'), 'pass');
    assert.deepEqual(failures({ ...good, CLAMAV_HOST: undefined }), ['upload-scanning'], 'unset means required in production');
    assert.equal(state(inspectLaunch({ ...good, CLAMAV_HOST: undefined, UPLOAD_SCANNING: 'optional' }), 'upload-scanning'), 'warn');
    assert.deepEqual(failures({ ...good, UPLOAD_SCANNING: 'later' }), ['UPLOAD_SCANNING']);
    assert.deepEqual(failures({ ...good, CLAMAV_PORT: 'clam' }), ['CLAMAV_PORT']);
    assert.equal(state(inspectLaunch({ ...good, GCS_BUCKET: undefined, GCS_CREDENTIALS_JSON: undefined }), 'upload-scanning'), 'warn', 'a scanner without a bucket has nothing to scan');
    assert(!JSON.stringify(inspectLaunch(good)).includes('clamav.internal'), 'the host is never printed');
});

test('no secret or credential value ever appears in the output', () => {
    const values = [AUTH, ENC, CRON, DBPASS, KEY, 'pilot@mail.example.test', 'FAKEKEYMATERIALxyz', 'uploader@fake-project', 'fake-bootstrap-pass-123', 'ep-quiet-sky-123456'];
    const variants: Environment[] = [
        good,
        { ...good, EMAIL_ENCRYPTION_KEY: AUTH, CRON_SECRET: AUTH },
        { ...good, MIGRATION_DATABASE_URL: good.DATABASE_URL, DB_RUNTIME_PASSWORD: DBPASS, BOOTSTRAP_PASSWORD: 'fake-bootstrap-pass-123' },
        { ...good, VITE_BETTER_AUTH_SECRET: AUTH, VITE_DATABASE_URL: good.DATABASE_URL },
        { ...good, DATABASE_URL: `postgresql://neondb_owner:${DBPASS}@ep-quiet-sky-123456.eu-central-1.aws.neon.tech/reunir` },
        { ...good, GCS_CREDENTIALS_JSON: GCS_JSON.slice(0, 40), GCS_BUCKET: undefined },
        { ...good, EMAIL_FROM: 'pilot@mail.example.test bad', RESEND_API_KEY: 'x' + KEY },
        { ...good, BETTER_AUTH_SECRET: AUTH.slice(0, 10) },
    ];
    for (const env of variants) {
        const findings = inspectLaunch(env);
        const text = formatFindings(findings) + JSON.stringify(findings);
        for (const v of values) assert.ok(!text.includes(v), 'leaked a value fragment');
    }
});

test('the checker is pure and does not read process.env', () => {
    const before = JSON.stringify(process.env);
    const a = inspectLaunch(good), b = inspectLaunch(good);
    assert.deepEqual(a, b);
    assert.equal(JSON.stringify(process.env), before);
    assert.ok(inspectLaunch({}).some(f => f.key === 'DATABASE_URL' && f.state === 'fail'));
});
