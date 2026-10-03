import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { openDatabase, type Database } from '../packages/db/src/connection';
import { migrate } from '../packages/db/src/migrate';
import { WorkspaceRepository, setContext } from '../packages/db/src/repository';
import { grantRuntimeTables } from '../packages/db/src/runtime-role';
import { createSeed, DEMO_ADMIN, DEMO_USER } from '../packages/domain/src/seed';
import { MailQueue } from '../apps/api/src/mail';
import { InvitationService } from '../apps/api/src/invitations';
import { createApp } from '../apps/api/src/app';
import { createAuth, passwordCheck, sessionResolver } from '../apps/api/src/auth';
import { adminTwoFactorMode } from '../apps/api/src/config';
import { setupKey } from '../packages/contracts/src/two-factor';
import { base32Decode, totpCode } from './helpers/totp';

// Real Better Auth with its two-factor plugin, through the real API, on an embedded PostgreSQL. Seeded people get real
// credential accounts so the community's owner (Amina), a moderator (Maya) and members (Alex, Sofia) can sign in.
const origin = 'https://reunir.example.test', secret = 'test_only_two_factor_secret_5c1f0e8a9b7d4c3e2f1a';
const PASSWORD = 'Two-step-test-password-123!';
const SOFIA = 'member_sofia', MAYA = 'member_maya';
const people: [string, string][] = [[DEMO_ADMIN, 'amina@example.test'], [DEMO_USER, 'alex@example.test'], [SOFIA, 'sofia@example.test'], [MAYA, 'maya@example.test']];
let db: Database, repo: WorkspaceRepository, auth: ReturnType<typeof createAuth>;
let required: ReturnType<typeof createApp>, optional: ReturnType<typeof createApp>;
let totpURI = '', backupCodes: string[] = [];
const cookies: Record<string, string> = {};

const jar = (r: Response, previous = '') => {
    const set = r.headers.getSetCookie().map(x => x.split(';')[0]);
    const values = new Map(previous.split('; ').filter(Boolean).map(x => [x.split('=')[0], x] as const));
    for (const pair of set) { const [name, value] = [pair.split('=')[0], pair.slice(pair.indexOf('=') + 1)]; if (value) values.set(name, pair); else values.delete(name); }
    return [...values.values()].join('; ');
};
// Better Auth limits each address per path (three two-step attempts in ten seconds); each request here comes from its own.
let address = 0;
const headers = (cookie = '') => ({ 'Content-Type': 'application/json', Origin: origin, Cookie: cookie, 'Idempotency-Key': randomUUID(), 'X-Forwarded-For': `198.51.100.${++address % 250 + 1}` });
const post = (path: string, body: unknown, cookie = '', app = required) => app.request(path, { method: 'POST', headers: headers(cookie), body: JSON.stringify(body) });
const get = (path: string, cookie = '', app = required) => app.request(path, { headers: headers(cookie) });
const command = (who: string, body: unknown, app = required) => post('/api/organisations/code-black/commands', body, cookies[who], app);
const errorCode = async (r: Response) => (await r.json()).error?.code;
const newSpace = (name: string) => ({ type: 'space.create', name, description: 'A space made while checking two-step sign-in.', visibility: 'members', kind: 'discussion' });
const session = async (cookie: string) => (await get('/api/session', cookie)).json();
async function signIn(email: string) {
    const r = await post('/api/auth/sign-in/email', { email, password: PASSWORD });
    return { response: r, body: await r.json(), cookie: jar(r) };
}

before(async () => {
    db = await openDatabase('pglite:memory'); await migrate(db);
    repo = new WorkspaceRepository(db); await repo.seed(createSeed()); await repo.seed(createSeed('studio-north'));
    auth = createAuth(db, origin, secret, false);
    const hash = await (await auth.$context).password.hash(PASSWORD);
    for (const [id, email] of people) {
        await db.query('INSERT INTO auth_user(id,name,email,email_verified,created_at,updated_at) VALUES($1,$1,$2,true,now(),now())', [id, email]);
        await db.query("INSERT INTO auth_account(id,account_id,provider_id,user_id,password,created_at,updated_at) VALUES($1,$2,'credential',$2,$3,now(),now())", [randomUUID(), id, hash]);
    }
    const mail = new MailQueue(db, secret, { send: async () => {} });
    const invitations = new InvitationService(repo, origin, mail);
    const shared = { repository: repo, origin, mail, invitations, verifyPassword: passwordCheck(auth), authHandler: (r: Request) => auth.handler(r), resolveSession: sessionResolver(auth) };
    required = createApp({ ...shared, adminTwoFactor: 'required' });
    optional = createApp({ ...shared, adminTwoFactor: 'optional' });
    for (const [id, email] of people) { const s = await signIn(email); assert.equal(s.response.status, 200); cookies[id] = s.cookie; }
    await db.query('CREATE ROLE reunir_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS');
    await db.transaction(grantRuntimeTables);
});
after(async () => db?.close());

test('the setting defaults to required in production and optional elsewhere, and refuses anything else', () => {
    assert.equal(adminTwoFactorMode({ NODE_ENV: 'production' }), 'required');
    assert.equal(adminTwoFactorMode({ NODE_ENV: 'development' }), 'optional');
    assert.equal(adminTwoFactorMode({ NODE_ENV: 'production', ADMIN_TWO_FACTOR: 'optional' }), 'optional');
    assert.equal(adminTwoFactorMode({ ADMIN_TWO_FACTOR: 'required' }), 'required');
    assert.throws(() => adminTwoFactorMode({ ADMIN_TWO_FACTOR: 'yes' }), /admin-two-factor/);
});

test('the server says what it requires, and the session says whether two-step sign-in is on', async () => {
    const caps = await (await get('/api/account/capabilities')).json();
    assert.equal(caps.adminTwoFactor, 'required');
    assert.equal(caps.twoStepSignIn, true);
    assert.equal((await (await get('/api/account/capabilities', '', optional)).json()).adminTwoFactor, 'optional');
    const me = await session(cookies[DEMO_ADMIN]);
    assert.equal(me.id, DEMO_ADMIN);
    assert.equal(me.twoFactorEnabled, false);
    assert.equal(me.memberships.find((m: { slug: string }) => m.slug === 'code-black').role, 'owner');
});

test('when required, an owner without two-step sign-in keeps reads and member actions but not owner tools', async () => {
    const refused = await command(DEMO_ADMIN, newSpace('Owner without two-step'));
    assert.equal(refused.status, 403);
    const body = await refused.json();
    assert.equal(body.error.code, 'TWO_FACTOR_REQUIRED');
    assert.match(body.error.message, /Turn it on from Your account/);
    const spaces = (await (await get('/api/organisations/code-black/workspace', cookies[DEMO_ADMIN])).json()).spaces;
    assert(!spaces.some((s: { name: string }) => s.name === 'Owner without two-step'), 'nothing was written');
    assert.equal((await command(DEMO_ADMIN, { type: 'post.create', spaceId: 'space_general', kind: 'update', title: '', body: 'An ordinary post still works.' })).status, 200);
    for (const [path, body] of [['/api/organisations/code-black/invitations', { email: 'someone@example.test' }], ['/api/organisations/code-black/ownership', { memberId: SOFIA, password: PASSWORD, confirmation: 'Code Black' }], ['/api/organisations/code-black/cover-library/item_x/remove', {}], ['/api/organisations/code-black/cover-library/library_mountain/details', { label: 'Renamed', tags: [] }]] as const) {
        const r = await post(path, body, cookies[DEMO_ADMIN]);
        assert.equal(r.status, 403, path);
        assert.equal(await errorCode(r), 'TWO_FACTOR_REQUIRED', path);
    }
    assert.equal(await errorCode(await get('/api/organisations/code-black/pilot-status', cookies[DEMO_ADMIN])), 'TWO_FACTOR_REQUIRED');
});

test('optional mode lets the same owner act, and members and moderators are never asked', async () => {
    assert.equal((await command(DEMO_ADMIN, newSpace('Owner in optional mode'), optional)).status, 200);
    // Promote Sofia so an administrator who is not the owner can be checked too.
    assert.equal((await command(DEMO_ADMIN, { type: 'member.role', memberId: SOFIA, role: 'admin' }, optional)).status, 200);
    assert.equal((await command(DEMO_USER, { type: 'post.create', spaceId: 'space_general', kind: 'update', title: '', body: 'A member is never asked for two-step sign-in.' })).status, 200);
    const memberRefused = await command(DEMO_USER, newSpace('A member tries'));
    assert.equal(memberRefused.status, 403);
    assert.equal(await errorCode(memberRefused), 'FORBIDDEN', 'a member is refused for their role, not for two-step sign-in');
    assert.equal(await errorCode(await post('/api/organisations/code-black/invitations', { email: 'other@example.test' }, cookies[DEMO_USER])), 'FORBIDDEN');
    assert.equal((await command(MAYA, { type: 'post.moderate', postId: 'post_common', hidden: true })).status, 200, 'a moderator moderates');
    // An administrator without two-step sign-in may still do what a moderator can, but not what only administrators can.
    assert.equal((await command(SOFIA, { type: 'post.moderate', postId: 'post_common', hidden: false })).status, 200);
    assert.equal(await errorCode(await command(SOFIA, newSpace('Administrator without two-step'))), 'TWO_FACTOR_REQUIRED');
    assert.equal(await errorCode(await post('/api/organisations/code-black/invitations', { email: 'third@example.test' }, cookies[SOFIA])), 'TWO_FACTOR_REQUIRED');
});

test('turning it on needs the password, shows a setup link once, and takes effect only after a correct code', async () => {
    const wrong = await post('/api/auth/two-factor/enable', { password: 'not the password at all' }, cookies[DEMO_ADMIN]);
    assert.equal(wrong.status, 400);
    const r = await post('/api/auth/two-factor/enable', { password: PASSWORD }, cookies[DEMO_ADMIN]);
    assert.equal(r.status, 200);
    const body = await r.json();
    totpURI = body.totpURI; backupCodes = body.backupCodes;
    assert.match(totpURI, /^otpauth:\/\/totp\/REUNIR:amina%40example\.test\?secret=[A-Z2-7]+&issuer=REUNIR&digits=6&period=30$/);
    assert.match(setupKey(totpURI), /^([A-Z2-7]{4} )+[A-Z2-7]{1,4}$/);
    assert.equal(backupCodes.length, 10);
    assert(backupCodes.every(c => /^[A-Za-z0-9]{5}-[A-Za-z0-9]{5}$/.test(c)));
    assert.equal((await session(cookies[DEMO_ADMIN])).twoFactorEnabled, false, 'not on until a code confirms it');
    const bad = await post('/api/auth/two-factor/verify-totp', { code: totpCode(totpURI, Date.now() + 10 * 60_000) }, cookies[DEMO_ADMIN]);
    assert.equal(bad.status, 401);
    const ok = await post('/api/auth/two-factor/verify-totp', { code: totpCode(totpURI) }, cookies[DEMO_ADMIN]);
    assert.equal(ok.status, 200);
    cookies[DEMO_ADMIN] = jar(ok, cookies[DEMO_ADMIN]);
    assert.equal((await session(cookies[DEMO_ADMIN])).twoFactorEnabled, true);
    assert.equal((await command(DEMO_ADMIN, newSpace('Owner with two-step'))).status, 200);
    assert.equal((await post('/api/organisations/code-black/invitations', { email: 'welcome@example.test' }, cookies[DEMO_ADMIN])).status, 201);
});

test('the secret and backup codes are stored encrypted and never reach a workspace', async () => {
    const row = (await db.query<{ secret: string; backup_codes: string; verified: boolean }>('SELECT secret,backup_codes,verified FROM auth_two_factor WHERE user_id=$1', [DEMO_ADMIN])).rows[0];
    const plain = base32Decode(new URL(totpURI).searchParams.get('secret')!).toString('utf8');
    assert.equal(row.verified, true);
    assert(!row.secret.includes(plain));
    for (const code of backupCodes) assert(!row.backup_codes.includes(code));
    const text = JSON.stringify(await (await get('/api/organisations/code-black/workspace', cookies[DEMO_ADMIN])).json());
    for (const marker of [row.secret, row.backup_codes, plain, ...backupCodes, 'two_factor', 'twoFactor', 'backupCodes']) assert(!text.includes(marker), marker.slice(0, 12));
    const me = JSON.stringify(await session(cookies[DEMO_ADMIN]));
    for (const marker of [row.secret, plain, ...backupCodes]) assert(!me.includes(marker));
});

test('signing in then asks for the second step, and a wrong code opens nothing', async () => {
    const first = await signIn('amina@example.test');
    assert.equal(first.response.status, 200);
    assert.equal(first.body.twoFactorRedirect, true);
    assert.deepEqual(first.body.twoFactorMethods, ['totp']);
    assert.equal(await session(first.cookie), null, 'no session before the second step');
    assert.equal((await get('/api/organisations/code-black/workspace', first.cookie)).status, 401);
    const wrong = await post('/api/auth/two-factor/verify-totp', { code: totpCode(totpURI, Date.now() + 10 * 60_000) }, first.cookie);
    assert.equal(wrong.status, 401);
    const right = await post('/api/auth/two-factor/verify-totp', { code: totpCode(totpURI) }, jar(wrong, first.cookie));
    assert.equal(right.status, 200);
    const signedIn = jar(right, first.cookie);
    const me = await session(signedIn);
    assert.equal(me.id, DEMO_ADMIN);
    assert.equal(me.twoFactorEnabled, true);
    assert.equal((await get('/api/organisations/code-black/workspace', signedIn)).status, 200);
    // The second step cannot be skipped by asking for it without the first.
    assert.equal((await post('/api/auth/two-factor/verify-totp', { code: totpCode(totpURI) })).status, 401);
});

test('a backup code works once', async () => {
    const first = await signIn('amina@example.test');
    const used = await post('/api/auth/two-factor/verify-backup-code', { code: backupCodes[0] }, first.cookie);
    assert.equal(used.status, 200);
    assert.equal((await session(jar(used, first.cookie))).id, DEMO_ADMIN);
    const again = await signIn('amina@example.test');
    assert.equal((await post('/api/auth/two-factor/verify-backup-code', { code: backupCodes[0] }, again.cookie)).status, 401);
    const next = await signIn('amina@example.test');
    const second = await post('/api/auth/two-factor/verify-backup-code', { code: backupCodes[1] }, next.cookie);
    assert.equal(second.status, 200);
});

test('new backup codes need the password and replace the old ones', async () => {
    assert.equal((await post('/api/auth/two-factor/generate-backup-codes', { password: 'not the password at all' }, cookies[DEMO_ADMIN])).status >= 400, true);
    const r = await post('/api/auth/two-factor/generate-backup-codes', { password: PASSWORD }, cookies[DEMO_ADMIN]);
    assert.equal(r.status, 200);
    const fresh: string[] = (await r.json()).backupCodes;
    assert.equal(fresh.length, 10);
    const old = await signIn('amina@example.test');
    assert.equal((await post('/api/auth/two-factor/verify-backup-code', { code: backupCodes[2] }, old.cookie)).status, 401);
    const renewed = await signIn('amina@example.test');
    assert.equal((await post('/api/auth/two-factor/verify-backup-code', { code: fresh[0] }, renewed.cookie)).status, 200);
});

test('turning it off needs the password; then sign-in is one step and owner tools are withheld again', async () => {
    assert.equal((await post('/api/auth/two-factor/disable', { password: 'not the password at all' }, cookies[DEMO_ADMIN])).status, 400);
    const off = await post('/api/auth/two-factor/disable', { password: PASSWORD }, cookies[DEMO_ADMIN]);
    assert.equal(off.status, 200);
    cookies[DEMO_ADMIN] = jar(off, cookies[DEMO_ADMIN]);
    assert.equal((await session(cookies[DEMO_ADMIN])).twoFactorEnabled, false);
    assert.equal((await db.query('SELECT 1 FROM auth_two_factor WHERE user_id=$1', [DEMO_ADMIN])).rows.length, 0);
    const plain = await signIn('amina@example.test');
    assert.equal(plain.body.twoFactorRedirect, undefined);
    assert.equal((await session(plain.cookie)).id, DEMO_ADMIN);
    assert.equal(await errorCode(await command(DEMO_ADMIN, newSpace('Owner after turning it off'))), 'TWO_FACTOR_REQUIRED');
});

test('the restricted runtime role can use the two-step table, and deleting an account removes its row', async () => {
    for (const action of ['SELECT', 'INSERT', 'UPDATE', 'DELETE'])
        assert.equal((await db.query<{ ok: boolean }>("SELECT has_table_privilege('reunir_app','auth_two_factor',$1) AS ok", [action])).rows[0].ok, true, action);
    await db.transaction(async tx => {
        await tx.query('SET LOCAL ROLE reunir_app'); await setContext(tx, '', DEMO_USER);
        await tx.query("INSERT INTO auth_two_factor(id,secret,backup_codes,user_id,verified) VALUES('tf_alex','sealed','sealed',$1,true)", [DEMO_USER]);
        await tx.query("UPDATE auth_user SET two_factor_enabled=true WHERE id=$1", [DEMO_USER]);
        assert.equal((await tx.query("SELECT count(*)::int AS n FROM auth_two_factor WHERE user_id=$1", [DEMO_USER])).rows[0].n, 1);
        await tx.query("UPDATE auth_two_factor SET failed_verification_count=1 WHERE id='tf_alex'");
    });
    const scratch = 'two_step_scratch';
    await db.query("INSERT INTO auth_user(id,name,email,email_verified,created_at,updated_at) VALUES($1,'Scratch','scratch@example.test',true,now(),now())", [scratch]);
    await db.query("INSERT INTO auth_two_factor(id,secret,backup_codes,user_id) VALUES('tf_scratch','sealed','sealed',$1)", [scratch]);
    await db.transaction(async tx => { await tx.query('SET LOCAL ROLE reunir_app'); await tx.query('DELETE FROM auth_user WHERE id=$1', [scratch]); });
    assert.equal((await db.query("SELECT count(*)::int AS n FROM auth_two_factor WHERE id='tf_scratch'")).rows[0].n, 0);
});
