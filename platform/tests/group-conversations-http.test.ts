import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { openDatabase, type Database } from '../packages/db/src/connection';
import { migrate } from '../packages/db/src/migrate';
import { WorkspaceRepository } from '../packages/db/src/repository';
import { grantRuntimeTables } from '../packages/db/src/runtime-role';
import { createSeed, DEMO_ADMIN, DEMO_USER } from '../packages/domain/src/seed';
import { createApp } from '../apps/api/src/app';

// The group routes (Alpha 24) through the API, as the restricted runtime role.
const origin = 'https://reunir.test', THEO = 'member_theo', SOFIA = 'member_sofia', JORDAN = 'member_jordan';
let db: Database, app: ReturnType<typeof createApp>, group = '';
let identity: { id: string; name: string } | null = null;
const as = (id: string | null) => { identity = id ? { id, name: id } : null; };
const post = (path: string, body: unknown, headers: Record<string, string> = {}) => app.request('/api/organisations/code-black/' + path, { method: 'POST', headers: { origin, 'content-type': 'application/json', 'idempotency-key': randomUUID(), ...headers }, body: JSON.stringify(body) });
const get = (path: string) => app.request('/api/organisations/code-black/' + path, { headers: { origin } });
const code = async (r: Response) => (await r.json()).error.code;

before(async () => {
    db = await openDatabase('pglite:memory'); await migrate(db);
    const seeded = new WorkspaceRepository(db); await seeded.seed(createSeed()); await seeded.seed(createSeed('studio-north'));
    await db.query('CREATE ROLE reunir_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS');
    await db.transaction(grantRuntimeTables);
    const runtime = Object.create(db) as Database;
    runtime.transaction = fn => db.transaction(async tx => { await tx.query('SET LOCAL ROLE reunir_app'); return fn(tx); });
    app = createApp({ repository: new WorkspaceRepository(runtime), origin, resolveSession: async () => identity });
});
after(async () => db?.close());

test('signed-out visitors and other sites cannot start a group', async () => {
    as(null);
    assert.equal((await post('conversation-groups', { title: 'Crew', userIds: [THEO, SOFIA] })).status, 401);
    as(DEMO_USER);
    assert.equal((await post('conversation-groups', { title: 'Crew', userIds: [THEO, SOFIA] }, { origin: 'https://elsewhere.test' })).status, 403);
});

test('a group is started with a name and at least two others, and extra fields are refused', async () => {
    as(DEMO_USER);
    assert.equal(await code(await post('conversation-groups', { title: 'Crew', userIds: [THEO] })), 'VALIDATION');
    assert.equal(await code(await post('conversation-groups', { title: 'Crew', userIds: [THEO, SOFIA], createdBy: DEMO_ADMIN })), 'VALIDATION');
    const r = await post('conversation-groups', { title: 'Crew', userIds: [THEO, SOFIA] });
    assert.equal(r.status, 201); group = (await r.json()).id;
    const seen = await (await get(`conversations/${group}`)).json();
    assert.deepEqual({ kind: seen.kind, title: seen.title, people: seen.participantIds.length }, { kind: 'group', title: 'Crew', people: 3 });
});

test('the group routes send, add, rename, remove and leave for the people in it only', async () => {
    as(THEO);
    assert.equal((await post(`conversations/${group}/messages`, { body: 'Hello, crew.' })).status, 201);
    as(JORDAN);
    assert.equal((await get(`conversations/${group}/messages`)).status, 404);
    assert.equal((await post(`conversations/${group}/title`, { title: 'Mine now' })).status, 404);
    assert.equal((await post(`conversations/${group}/participants`, { userIds: [JORDAN] })).status, 404);
    as(THEO);
    assert.deepEqual(await (await post(`conversations/${group}/participants`, { userIds: [JORDAN] })).json(), { ok: true, added: 1 });
    assert.equal((await post(`conversations/${group}/title`, { title: 'Thursday critique' })).status, 200);
    assert.equal(await code(await post(`conversations/${group}/participants/${JORDAN}/remove`, {})), 'FORBIDDEN');
    as(JORDAN);
    assert.deepEqual((await (await get(`conversations/${group}/messages`)).json()).items, []);
    as(DEMO_USER);
    assert.equal((await post(`conversations/${group}/participants/${JORDAN}/remove`, {})).status, 200);
    as(SOFIA);
    assert.equal((await post(`conversations/${group}/leave`, {})).status, 200);
    assert.equal((await get(`conversations/${group}`)).status, 404);
    as(DEMO_USER);
    assert.deepEqual((await (await get(`conversations/${group}`)).json()).participantIds, [DEMO_USER, THEO]);
});

test('group actions on a direct thread are refused', async () => {
    as(DEMO_USER);
    const direct = (await (await post('conversations', { userId: DEMO_ADMIN })).json()).id;
    assert.equal(await code(await post(`conversations/${direct}/leave`, {})), 'NOT_A_GROUP');
    assert.equal(await code(await post(`conversations/${direct}/title`, { title: 'Renamed' })), 'NOT_A_GROUP');
});
