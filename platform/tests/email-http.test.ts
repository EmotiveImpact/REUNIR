import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { openDatabase, type Database } from '../packages/db/src/connection';
import { migrate } from '../packages/db/src/migrate';
import { WorkspaceRepository } from '../packages/db/src/repository';
import { createSeed, DEMO_ADMIN, DEMO_USER } from '../packages/domain/src/seed';
import { MailQueue, type Mail } from '../apps/api/src/mail';
import { InvitationService } from '../apps/api/src/invitations';
import { createApp } from '../apps/api/src/app';
import { createAuth, emailChangeLinkCheck, emailChanger, passwordCheck, sessionResolver } from '../apps/api/src/auth';
import { emailVerificationMode, inspectConfiguration, validateRuntimeConfiguration } from '../apps/api/src/config';
import { EMAIL_CHANGE_SENT, maskEmail } from '../packages/contracts/src/email';

// Real Better Auth through the real API, on an embedded PostgreSQL, with the encrypted outbox captured rather than sent.
// Amina (owner) and Alex (member) start confirmed; Sofia starts unconfirmed, as an account made before Alpha 22 would be.
const origin = 'https://reunir.example.test', secret = 'test_only_email_change_secret_8d2b4c6e1f3a5d7c9b0e';
const PASSWORD = 'Email-change-test-password-42!';
const SOFIA = 'member_sofia';
const people: [string, string, boolean][] = [[DEMO_ADMIN, 'amina@example.test', true], [DEMO_USER, 'alex@example.test', true], [SOFIA, 'sofia@example.test', false]];
let db: Database, mail: MailQueue, required: ReturnType<typeof createApp>, optional: ReturnType<typeof createApp>, noMail: ReturnType<typeof createApp>;
const cookies: Record<string, string> = {};

const jar = (r: Response, previous = '') => {
    const values = new Map(previous.split('; ').filter(Boolean).map(x => [x.split('=')[0], x] as const));
    for (const pair of r.headers.getSetCookie().map(x => x.split(';')[0])) { const [name, value] = [pair.split('=')[0], pair.slice(pair.indexOf('=') + 1)]; if (value) values.set(name, pair); else values.delete(name); }
    return [...values.values()].join('; ');
};
let address = 0;
const headers = (cookie = '') => ({ 'Content-Type': 'application/json', Origin: origin, Cookie: cookie, 'Idempotency-Key': randomUUID(), 'X-Forwarded-For': `203.0.113.${++address % 250 + 1}` });
const post = (path: string, body: unknown, cookie = '', app = required) => app.request(path, { method: 'POST', headers: headers(cookie), body: JSON.stringify(body) });
const get = (path: string, cookie = '', app = required) => app.request(path, { headers: headers(cookie) });
const errorCode = async (r: Response) => (await r.json()).error?.code;
const signIn = async (email: string, app = required) => { const r = await post('/api/auth/sign-in/email', { email, password: PASSWORD }, '', app); return { status: r.status, body: await r.json(), cookie: jar(r) }; };
const session = async (cookie: string) => (await get('/api/session', cookie)).json();
/** Mail waiting in the outbox, opened, newest last. Each call takes what it returns out of the queue. */
async function takeMail(): Promise<Mail[]> {
    const rows = await db.query<{ id: string; payload: string }>("SELECT id,payload FROM email_outbox WHERE status='queued' ORDER BY created_at,id");
    await db.query("DELETE FROM email_outbox WHERE status='queued'");
    return rows.rows.map(r => mail.open(r.payload));
}
const link = (m: Mail) => { const url = m.text.match(/https:\/\/\S+/)?.[0]; assert(url, 'the message carries a link'); return new URL(url); };
const open = (url: URL, cookie = '') => required.request(url.pathname + url.search, { headers: { Origin: origin, Cookie: cookie } });

before(async () => {
    db = await openDatabase('pglite:memory'); await migrate(db);
    const repo = new WorkspaceRepository(db); await repo.seed(createSeed()); await repo.seed(createSeed('studio-north'));
    mail = new MailQueue(db, secret, { send: async () => {} });
    const unsent = new MailQueue(db, secret);
    const auth = createAuth(db, origin, secret, false, mail, 'required'), lenient = createAuth(db, origin, secret, false, mail, 'optional'), plain = createAuth(db, origin, secret, false);
    const hash = await (await auth.$context).password.hash(PASSWORD);
    for (const [id, email, verified] of people) {
        await db.query('INSERT INTO auth_user(id,name,email,email_verified,created_at,updated_at) VALUES($1,$1,$2,$3,now(),now())', [id, email, verified]);
        await db.query("INSERT INTO auth_account(id,account_id,provider_id,user_id,password,created_at,updated_at) VALUES($1,$2,'credential',$2,$3,now(),now())", [randomUUID(), id, hash]);
    }
    const shared = { repository: repo, origin, invitations: new InvitationService(repo, origin, mail) };
    required = createApp({ ...shared, mail, emailVerification: 'required', verifyPassword: passwordCheck(auth), changeEmail: emailChanger(auth), emailChangeLinkValid: emailChangeLinkCheck(auth), authHandler: r => auth.handler(r), resolveSession: sessionResolver(auth) });
    optional = createApp({ ...shared, mail, emailVerification: 'optional', verifyPassword: passwordCheck(lenient), changeEmail: emailChanger(lenient), authHandler: r => lenient.handler(r), resolveSession: sessionResolver(lenient) });
    noMail = createApp({ ...shared, mail: unsent, verifyPassword: passwordCheck(plain), changeEmail: emailChanger(plain), authHandler: r => plain.handler(r), resolveSession: sessionResolver(plain) });
    for (const [id, email, verified] of people) if (verified) { const s = await signIn(email); assert.equal(s.status, 200); cookies[id] = s.cookie; }
});
after(async () => db?.close());

test('the setting defaults to required in production and optional elsewhere, and refuses anything else', () => {
    assert.equal(emailVerificationMode({ NODE_ENV: 'production' }), 'required');
    assert.equal(emailVerificationMode({ NODE_ENV: 'development' }), 'optional');
    assert.equal(emailVerificationMode({ NODE_ENV: 'production', EMAIL_VERIFICATION: 'optional' }), 'optional');
    assert.throws(() => emailVerificationMode({ EMAIL_VERIFICATION: 'always' }), /email-verification/);
    const check = (env: Record<string, string>) => inspectConfiguration(env).find(c => c.key === 'email-verification')!.state;
    assert.equal(check({ NODE_ENV: 'production', RESEND_API_KEY: 'x', EMAIL_FROM: 'y' }), 'pass');
    assert.equal(check({ NODE_ENV: 'production' }), 'blocked', 'required without a sender blocks the pilot checklist');
    assert.equal(check({ NODE_ENV: 'production', EMAIL_VERIFICATION: 'optional' }), 'warning');
    assert.throws(() => validateRuntimeConfiguration({ NODE_ENV: 'test', APP_ORIGIN: 'http://127.0.0.1:5173', BETTER_AUTH_SECRET: secret, DATABASE_URL: 'pglite:memory', EMAIL_VERIFICATION: 'always' }), /email-verification/);
});

test('the server says what it offers, and the session carries the address and whether it is confirmed', async () => {
    const caps = await (await get('/api/account/capabilities')).json();
    assert.deepEqual([caps.emailVerification, caps.emailConfirmation, caps.emailChange], ['required', true, true]);
    const none = await (await get('/api/account/capabilities', '', noMail)).json();
    assert.deepEqual([none.emailVerification, none.emailConfirmation, none.emailChange], ['optional', false, false]);
    const me = await session(cookies[DEMO_USER]);
    assert.equal(me.email, 'alex@example.test');
    assert.equal(me.emailVerified, true);
});

test('when confirmation is required, an unconfirmed address gets a link instead of a session, and the link confirms it', async () => {
    await takeMail();
    const refused = await signIn('sofia@example.test');
    assert.equal(refused.status, 403);
    assert.equal(refused.body.code, 'EMAIL_NOT_VERIFIED');
    assert.equal(refused.cookie, '', 'no session is created');
    const [sent] = await takeMail();
    assert.equal(sent.to, 'sofia@example.test');
    assert.match(sent.subject, /Confirm your email address/);
    const opened = await open(link(sent));
    assert(opened.status < 400, `the link is accepted (${opened.status})`);
    assert.equal((await db.query<{ email_verified: boolean }>('SELECT email_verified FROM auth_user WHERE id=$1', [SOFIA])).rows[0].email_verified, true);
    const after = await signIn('sofia@example.test');
    assert.equal(after.status, 200);
    cookies[SOFIA] = after.cookie;
    assert.equal((await session(after.cookie)).emailVerified, true);
});

test('when confirmation is optional, an unconfirmed address still signs in and can ask for a link', async () => {
    await db.query('UPDATE auth_user SET email_verified=false WHERE id=$1', [SOFIA]);
    const s = await signIn('sofia@example.test', optional);
    assert.equal(s.status, 200);
    await takeMail();
    const r = await post('/api/auth/send-verification-email', { email: 'sofia@example.test', callbackURL: origin + '/#/account?email=confirmed' }, s.cookie, optional);
    assert.equal(r.status, 200);
    const [sent] = await takeMail();
    assert.equal(sent.to, 'sofia@example.test');
    assert.equal(link(sent).searchParams.get('callbackURL'), origin + '/#/account?email=confirmed');
    await open(link(sent));
    assert.equal((await db.query<{ email_verified: boolean }>('SELECT email_verified FROM auth_user WHERE id=$1', [SOFIA])).rows[0].email_verified, true);
});

test('changing the address needs the password, and the provider route cannot be used to skip it', async () => {
    assert.equal((await post('/api/auth/change-email', { newEmail: 'skip@example.test' }, cookies[DEMO_USER])).status, 404);
    assert.equal(await errorCode(await post('/api/account/email', { newEmail: 'alex.new@example.test', password: 'not-the-password-123' }, cookies[DEMO_USER])), 'WRONG_PASSWORD');
    assert.equal(await errorCode(await post('/api/account/email', { newEmail: 'not an address', password: PASSWORD }, cookies[DEMO_USER])), 'VALIDATION');
    assert.equal(await errorCode(await post('/api/account/email', { newEmail: 'ALEX@example.test', password: PASSWORD }, cookies[DEMO_USER])), 'SAME_EMAIL');
    assert.equal((await post('/api/account/email', { newEmail: 'alex.new@example.test', password: PASSWORD })).status, 401);
    assert.equal(await errorCode(await post('/api/account/email', { newEmail: 'alex.new@example.test', password: PASSWORD }, cookies[DEMO_USER], noMail)), 'EMAIL_UNAVAILABLE');
    assert.equal((await db.query<{ email: string }>('SELECT email FROM auth_user WHERE id=$1', [DEMO_USER])).rows[0].email, 'alex@example.test');
});

test('the address changes only when the link sent to the new address is opened, and the old address is told', async () => {
    await takeMail();
    const r = await post('/api/account/email', { newEmail: 'Alex.New@Example.test', password: PASSWORD }, cookies[DEMO_USER]);
    assert.equal(r.status, 200);
    assert.equal((await r.json()).message, EMAIL_CHANGE_SENT);
    const sent = await takeMail();
    const confirmation = sent.find(m => m.to === 'alex.new@example.test'), notice = sent.find(m => m.to === 'alex@example.test');
    assert(confirmation && notice, 'one link to the new address and one notice to the current one');
    assert(notice.text.includes(maskEmail('alex.new@example.test')) && !notice.text.includes('alex.new@example.test'), 'the notice names the new address only in part');
    assert(!/https:\/\//.test(notice.text), 'the notice carries no link');
    assert.equal((await db.query<{ email: string }>('SELECT email FROM auth_user WHERE id=$1', [DEMO_USER])).rows[0].email, 'alex@example.test', 'nothing changes yet');
    assert.equal((await signIn('alex@example.test')).status, 200);
    const opened = await open(link(confirmation), cookies[DEMO_USER]);
    assert(opened.status < 400, `the link is accepted (${opened.status})`);
    const row = (await db.query<{ email: string; email_verified: boolean }>('SELECT email,email_verified FROM auth_user WHERE id=$1', [DEMO_USER])).rows[0];
    assert.deepEqual([row.email, row.email_verified], ['alex.new@example.test', true]);
    assert.equal((await signIn('alex@example.test')).status, 401);
    const fresh = await signIn('alex.new@example.test');
    assert.equal(fresh.status, 200);
    cookies[DEMO_USER] = fresh.cookie;
    assert.equal((await session(fresh.cookie)).email, 'alex.new@example.test');
});

test('a session older than a day can still change the address: typing the password is the fresh proof', async () => {
    await db.query("UPDATE auth_session SET created_at=now() - interval '3 days' WHERE user_id=$1", [DEMO_ADMIN]);
    assert.equal((await session(cookies[DEMO_ADMIN])).id, DEMO_ADMIN, 'the session itself is still valid');
    await takeMail();
    assert.equal(await errorCode(await post('/api/account/email', { newEmail: 'amina.next@example.test', password: 'wrong-password-123' }, cookies[DEMO_ADMIN])), 'WRONG_PASSWORD');
    const r = await post('/api/account/email', { newEmail: 'amina.next@example.test', password: PASSWORD }, cookies[DEMO_ADMIN]);
    assert.equal(r.status, 200, 'not refused for the age of the session');
    assert((await takeMail()).some(m => m.to === 'amina.next@example.test'));
});

test('changing the password cancels a change link asked for before it, and the address stays', async () => {
    await takeMail();
    assert.equal((await post('/api/account/email', { newEmail: 'amina.taken.over@example.test', password: PASSWORD }, cookies[DEMO_ADMIN])).status, 200);
    const pending = (await takeMail()).find(m => m.to === 'amina.taken.over@example.test')!;
    await new Promise(r => setTimeout(r, 1100));
    const before = (await db.query<{ updated_at: Date }>("SELECT updated_at FROM auth_account WHERE user_id=$1 AND provider_id='credential'", [DEMO_ADMIN])).rows[0].updated_at;
    await db.query("UPDATE auth_session SET created_at=now() WHERE user_id=$1", [DEMO_ADMIN]);
    const changed = await post('/api/auth/change-password', { currentPassword: PASSWORD, newPassword: PASSWORD }, cookies[DEMO_ADMIN]);
    assert.equal(changed.status, 200, 'the owner changes the password');
    const after = (await db.query<{ updated_at: Date }>("SELECT updated_at FROM auth_account WHERE user_id=$1 AND provider_id='credential'", [DEMO_ADMIN])).rows[0].updated_at;
    assert(new Date(after).getTime() > new Date(before).getTime(), 'the password change is recorded');
    const opened = await open(link(pending));
    assert.equal(opened.status, 302);
    assert.equal(opened.headers.get('location'), origin + '/#/account?email=refused');
    assert.equal((await db.query<{ email: string }>('SELECT email FROM auth_user WHERE id=$1', [DEMO_ADMIN])).rows[0].email, 'amina@example.test', 'the address did not change');
    assert(!opened.headers.getSetCookie().some(c => c.includes('session_token=') && !c.includes('session_token=;')), 'no session is created for whoever opened it');
    await post('/api/account/email', { newEmail: 'amina.later@example.test', password: PASSWORD }, cookies[DEMO_ADMIN]);
    const later = (await takeMail()).find(m => m.to === 'amina.later@example.test')!;
    assert.notEqual((await open(link(later), cookies[DEMO_ADMIN])).headers.get('location'), origin + '/#/account?email=refused', 'a link asked for afterwards still works');
    assert.equal((await db.query<{ email: string }>('SELECT email FROM auth_user WHERE id=$1', [DEMO_ADMIN])).rows[0].email, 'amina.later@example.test');
    cookies[DEMO_ADMIN] = (await signIn('amina.later@example.test')).cookie;
});

test('asking for an address someone else already has answers the same way and sends that person nothing', async () => {
    await takeMail();
    const r = await post('/api/account/email', { newEmail: 'amina.later@example.test', password: PASSWORD }, cookies[DEMO_USER]);
    assert.equal(r.status, 200);
    assert.equal((await r.json()).message, EMAIL_CHANGE_SENT);
    const sent = await takeMail();
    assert(!sent.some(m => m.to === 'amina.later@example.test'), 'the other account gets no link');
    assert.equal((await db.query<{ email: string }>('SELECT email FROM auth_user WHERE id=$1', [DEMO_ADMIN])).rows[0].email, 'amina.later@example.test');
});

test('five attempts in fifteen minutes are allowed per account', async () => {
    const who = cookies[SOFIA];
    for (let i = 0; i < 5; i++) await post('/api/account/email', { newEmail: `sofia${i}@example.test`, password: 'wrong-password-123' }, who);
    assert.equal(await errorCode(await post('/api/account/email', { newEmail: 'sofia9@example.test', password: PASSWORD }, who)), 'RATE_LIMITED');
});

test('accepting an invitation confirms the invited address', async () => {
    const invited = 'newcomer@example.test';
    const created = await (await post('/api/organisations/code-black/invitations', { email: invited }, cookies[DEMO_ADMIN], optional)).json();
    const token = new URL(created.url.replace('/#/', '/')).searchParams.get('token')!;
    const id = randomUUID();
    await db.query('INSERT INTO auth_user(id,name,email,email_verified,created_at,updated_at) VALUES($1,$2,$3,false,now(),now())', [id, 'Newcomer', invited]);
    await new InvitationService(new WorkspaceRepository(db), origin, mail).accept(token, id);
    assert.equal((await db.query<{ email_verified: boolean }>('SELECT email_verified FROM auth_user WHERE id=$1', [id])).rows[0].email_verified, true);
});
