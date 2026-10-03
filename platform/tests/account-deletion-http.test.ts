import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { openDatabase, type Database } from '../packages/db/src/connection';
import { migrate } from '../packages/db/src/migrate';
import { WorkspaceRepository } from '../packages/db/src/repository';
import { grantRuntimeTables } from '../packages/db/src/runtime-role';
import { createSeed, DEMO_ADMIN, DEMO_USER } from '../packages/domain/src/seed';
import { createApp } from '../apps/api/src/app';
import type { PrivateStorage } from '../apps/api/src/storage';

const origin = 'https://reunir.test', PASSWORD = 'correct horse battery staple', SOFIA = 'member_sofia';
let db: Database, repo: WorkspaceRepository, app: ReturnType<typeof createApp>;
let identity: { id: string; name: string } | null = null;
const removed: string[] = [];
const as = (id: string | null) => { identity = id ? { id, name: id } : null; };
const remove = (body: unknown, headers: Record<string, string> = {}, target = app) => target.request('/api/account/delete', { method: 'POST', headers: { origin, 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
const confirm = { password: PASSWORD, confirmation: 'delete my account' };
const accounts = async () => (await db.query<{ id: string }>('SELECT id FROM auth_user ORDER BY id')).rows.map(r => r.id);

before(async () => {
    db = await openDatabase('pglite:memory'); await migrate(db);
    const owner = new WorkspaceRepository(db); await owner.seed(createSeed()); await owner.seed(createSeed('studio-north'));
    for (const [id, email] of [[DEMO_USER, 'alex@example.test'], [DEMO_ADMIN, 'amina@example.test'], [SOFIA, 'sofia@example.test']]) {
        await db.query("INSERT INTO auth_user(id,name,email,email_verified,created_at,updated_at) VALUES($1,$1,$2,true,now(),now())", [id, email]);
        await db.query("INSERT INTO auth_session(id,expires_at,token,created_at,updated_at,user_id) VALUES($1,now()+interval '1 day',$1,now(),now(),$2)", [randomUUID(), id]);
    }
    await db.query("INSERT INTO upload_intents(organization_id,id,user_id,object_key,content_type,size_bytes,original_name,created_at,status) VALUES('org_code_black',$1,$2,'organisations/org_code_black/members/member_alex/notes.pdf','application/pdf',100,'notes.pdf',now(),'ready')", [randomUUID(), DEMO_USER]);
    await db.query('CREATE ROLE reunir_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS');
    await db.transaction(grantRuntimeTables);
    const runtime = Object.create(db) as Database;
    runtime.transaction = fn => db.transaction(async tx => { await tx.query('SET LOCAL ROLE reunir_app'); return fn(tx); });
    repo = new WorkspaceRepository(runtime);
    const storage = { remove: async (key: string) => { removed.push(key); } } as unknown as PrivateStorage;
    // Sessions resolve only while their rows exist, as Better Auth's do; the password check stands in for Better Auth's.
    app = createApp({ repository: repo, origin, storage,
        resolveSession: async () => identity && (await db.query('SELECT 1 FROM auth_session WHERE user_id=$1', [identity.id])).rows.length ? identity : null,
        verifyPassword: async (_headers, password) => password === PASSWORD });
});
after(async () => db?.close());

test('signed-out visitors and other sites never reach the check', async () => {
    as(null);
    assert.equal((await remove(confirm)).status, 401);
    as(DEMO_USER);
    assert.equal((await remove(confirm, { origin: 'https://elsewhere.test' })).status, 403);
    assert.equal((await remove(confirm, { 'content-type': 'text/plain' })).status, 415);
    assert.deepEqual(await accounts(), [DEMO_USER, DEMO_ADMIN, SOFIA]);
});

test('the typed phrase and the current password are both required', async () => {
    as(DEMO_USER);
    const phrase = await remove({ password: PASSWORD, confirmation: 'yes' });
    assert.equal(phrase.status, 400);
    assert.match((await phrase.json()).error.message, /Type “delete my account” to confirm/);
    const wrong = await remove({ ...confirm, password: 'not my password' });
    assert.equal(wrong.status, 403);
    assert.deepEqual((await wrong.json()).error.code, 'WRONG_PASSWORD');
    assert.equal((await remove({ ...confirm, extra: true })).status, 400);
    assert.deepEqual(await accounts(), [DEMO_USER, DEMO_ADMIN, SOFIA]);
});

test('an owner is told why, and nothing changes', async () => {
    as(DEMO_ADMIN);
    const r = await remove(confirm);
    assert.equal(r.status, 409);
    const { error } = await r.json();
    assert.equal(error.code, 'OWNER_CANNOT_DELETE');
    assert.match(error.message, /You own Code Black and Studio North/);
    assert.deepEqual(await accounts(), [DEMO_USER, DEMO_ADMIN, SOFIA]);
});

test('repeated wrong passwords are slowed down', async () => {
    as(SOFIA);
    for (let i = 0; i < 5; i++) assert.equal((await remove({ ...confirm, password: 'guess ' + i })).status, 403);
    const limited = await remove(confirm);
    assert.equal(limited.status, 429, 'even the right password waits once the limit is reached');
    assert.deepEqual(await accounts(), [DEMO_USER, DEMO_ADMIN, SOFIA]);
});

test('a member deletes their account: the session ends, the cookie is cleared and the private file is removed', async () => {
    as(DEMO_USER);
    const r = await remove(confirm);
    assert.equal(r.status, 200);
    const body = await r.json();
    assert.equal(body.deleted, true);
    assert.equal(body.summary.communities, 2);
    assert.equal(body.summary.removed.sessions, 1);
    assert.match(r.headers.get('set-cookie') ?? '', /__Secure-reunir\.session_token=; Path=\/; Max-Age=0; HttpOnly; SameSite=Lax; Secure/);
    assert.equal(r.headers.get('cache-control'), 'no-store');
    assert.deepEqual(removed, ['organisations/org_code_black/members/member_alex/notes.pdf']);
    assert.deepEqual(await accounts(), [DEMO_ADMIN, SOFIA]);
    assert.equal((await app.request('/api/session')).status, 200);
    assert.equal(await (await app.request('/api/session')).json(), null, 'the session no longer resolves');
    assert.equal((await app.request('/api/organisations/code-black/workspace')).status, 401);
    assert.equal((await remove(confirm)).status, 401, 'a second request has no session to act with');
    as(DEMO_ADMIN);
    const seen = await (await app.request('/api/organisations/code-black/workspace')).json();
    assert.deepEqual(seen.members.filter((m: { userId: string }) => m.userId === DEMO_USER).map((m: { name: string; status: string }) => [m.name, m.status]), [['Former member', 'left']]);
});

test('without a password check the route is unavailable rather than unprotected', async () => {
    const bare = createApp({ repository: repo, origin, resolveSession: async () => ({ id: SOFIA, name: SOFIA }) });
    const r = await remove(confirm, {}, bare);
    assert.equal(r.status, 503);
    assert.deepEqual(await accounts(), [DEMO_ADMIN, SOFIA]);
});
