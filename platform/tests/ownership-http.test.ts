import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { openDatabase, type Database } from '../packages/db/src/connection';
import { migrate } from '../packages/db/src/migrate';
import { WorkspaceRepository } from '../packages/db/src/repository';
import { grantRuntimeTables } from '../packages/db/src/runtime-role';
import { createSeed, DEMO_ADMIN, DEMO_USER } from '../packages/domain/src/seed';
import { createApp } from '../apps/api/src/app';

const origin = 'https://reunir.test', PASSWORD = 'correct horse battery staple', MAYA = 'member_maya', SOFIA = 'member_sofia';
let db: Database, repo: WorkspaceRepository, app: ReturnType<typeof createApp>;
let identity: { id: string; name: string } | null = null;
const as = (id: string | null) => { identity = id ? { id, name: id } : null; };
const post = (path: string, body: unknown, headers: Record<string, string> = {}, target = app) => target.request(path, { method: 'POST', headers: { origin, 'content-type': 'application/json', 'idempotency-key': randomUUID(), ...headers }, body: JSON.stringify(body) });
const handOver = (body: unknown, slug = 'code-black', headers: Record<string, string> = {}, target = app) => post(`/api/organisations/${slug}/ownership`, body, headers, target);
const toMaya = { memberId: MAYA, password: PASSWORD, confirmation: 'Code Black' };
const owner = async (org = 'org_code_black') => (await db.query<{ user_id: string }>("SELECT user_id FROM members WHERE organization_id=$1 AND role='owner'", [org])).rows.map(r => r.user_id);
const code = async (r: Response) => (await r.json()).error.code;

before(async () => {
    db = await openDatabase('pglite:memory'); await migrate(db);
    const seeded = new WorkspaceRepository(db); await seeded.seed(createSeed()); await seeded.seed(createSeed('studio-north'));
    for (const [id, email] of [[DEMO_USER, 'alex@example.test'], [DEMO_ADMIN, 'amina@example.test'], [MAYA, 'maya@example.test']])
        await db.query("INSERT INTO auth_user(id,name,email,email_verified,created_at,updated_at) VALUES($1,$1,$2,true,now(),now())", [id, email]);
    await db.query('CREATE ROLE reunir_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS');
    await db.transaction(grantRuntimeTables);
    const runtime = Object.create(db) as Database;
    runtime.transaction = fn => db.transaction(async tx => { await tx.query('SET LOCAL ROLE reunir_app'); return fn(tx); });
    repo = new WorkspaceRepository(runtime);
    app = createApp({ repository: repo, origin, resolveSession: async () => identity, verifyPassword: async (_headers, password) => password === PASSWORD });
    await repo.execute('code-black', DEMO_ADMIN, { type: 'member.role', memberId: MAYA, role: 'admin' }, randomUUID(), 'ownership-http');
});
after(async () => db?.close());

test('signed-out visitors and other sites never reach the check', async () => {
    as(null);
    assert.equal((await handOver(toMaya)).status, 401);
    as(DEMO_ADMIN);
    assert.equal((await handOver(toMaya, 'code-black', { origin: 'https://elsewhere.test' })).status, 403);
    assert.equal((await handOver(toMaya, 'code-black', { 'content-type': 'text/plain' })).status, 415);
    assert.deepEqual(await owner(), [DEMO_ADMIN]);
});

test('the password, the typed name and a well-formed request are all required', async () => {
    as(DEMO_ADMIN);
    const wrong = await handOver({ ...toMaya, password: 'not my password' });
    assert.equal(wrong.status, 403);
    assert.equal(await code(wrong), 'WRONG_PASSWORD');
    const name = await handOver({ ...toMaya, confirmation: 'Code' });
    assert.equal(name.status, 400);
    assert.equal(await code(name), 'CONFIRMATION_REQUIRED');
    assert.equal((await handOver({ ...toMaya, role: 'owner' })).status, 400);
    assert.equal((await handOver({ memberId: MAYA, confirmation: 'Code Black' })).status, 400);
    assert.deepEqual(await owner(), [DEMO_ADMIN]);
});

test('members and the workspace command route cannot take ownership', async () => {
    as(MAYA);
    const r = await handOver({ memberId: MAYA, password: PASSWORD, confirmation: 'Code Black' });
    assert.equal(r.status, 403);
    assert.equal(await code(r), 'OWNER_REQUIRED');
    as(DEMO_ADMIN);
    assert.equal((await post('/api/organisations/code-black/commands', { type: 'member.role', memberId: MAYA, role: 'owner' })).status, 400);
    assert.equal((await post('/api/organisations/code-black/commands', { type: 'member.owner.transfer', memberId: MAYA })).status, 400);
    as(DEMO_USER);
    assert.equal((await handOver({ memberId: DEMO_USER, password: PASSWORD, confirmation: 'Code Black' })).status, 403);
    assert.deepEqual(await owner(), [DEMO_ADMIN]);
});

test('the owner hands Code Black to Maya, and can then no longer act as owner', async () => {
    as(DEMO_ADMIN);
    const r = await handOver(toMaya);
    assert.equal(r.status, 200);
    const body = await r.json();
    assert.equal(body.message, 'Maya Bennett now owns Code Black. You are an administrator.');
    assert.equal(body.workspace.members.find((m: { userId: string }) => m.userId === DEMO_ADMIN).role, 'admin');
    assert.deepEqual(await owner(), [MAYA]);
    assert.deepEqual(await owner('org_studio_north'), [DEMO_ADMIN]);
    await assert.rejects(repo.transferOwnership('code-black', DEMO_ADMIN, MAYA, 'Code Black', 'again'), (e: { code?: string }) => e.code === 'OWNER_REQUIRED');
    assert.equal(await code(await handOver(toMaya)), 'RATE_LIMITED', 'five attempts in fifteen minutes, successful ones included');
});

test('repeated attempts are slowed down', async () => {
    as(SOFIA);
    for (let i = 0; i < 5; i++) assert.equal((await handOver({ memberId: DEMO_ADMIN, password: 'guess ' + i, confirmation: 'Code Black' })).status, 403);
    const limited = await handOver({ memberId: DEMO_ADMIN, password: PASSWORD, confirmation: 'Code Black' });
    assert.equal(limited.status, 429, 'even the right password waits once the limit is reached');
    assert.deepEqual(await owner(), [MAYA]);
});

test('without a password check the route is unavailable rather than unprotected', async () => {
    const bare = createApp({ repository: repo, origin, resolveSession: async () => ({ id: MAYA, name: MAYA }) });
    const r = await handOver({ memberId: DEMO_ADMIN, password: PASSWORD, confirmation: 'Code Black' }, 'code-black', {}, bare);
    assert.equal(r.status, 503);
    assert.deepEqual(await owner(), [MAYA]);
});
