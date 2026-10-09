import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { openDatabase, type Database } from '../packages/db/src/connection';
import { migrate } from '../packages/db/src/migrate';
import { WorkspaceRepository } from '../packages/db/src/repository';
import { grantRuntimeTables } from '../packages/db/src/runtime-role';
import { createSeed, DEMO_ADMIN, DEMO_USER } from '../packages/domain/src/seed';
import { createApp } from '../apps/api/src/app';

// Alpha 58: the account routes a suspended member appeals through, and the reporter's own message reports (decision 058).
const origin = 'https://reunir.test', SOFIA = 'member_sofia';
let db: Database, repo: WorkspaceRepository, app: ReturnType<typeof createApp>;
let identity: { id: string; name: string } | null = null;
const as = (id: string | null) => { identity = id ? { id, name: id } : null; };
const get = (path: string) => app.request(path, { headers: { origin } });
const post = (path: string, body: unknown) => app.request(path, { method: 'POST', headers: { origin, 'content-type': 'application/json', 'idempotency-key': randomUUID() }, body: JSON.stringify(body) });

before(async () => {
    db = await openDatabase('pglite:memory'); await migrate(db);
    const owner = new WorkspaceRepository(db); await owner.seed(createSeed()); await owner.seed(createSeed('studio-north'));
    await db.query('CREATE ROLE reunir_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS');
    await db.transaction(grantRuntimeTables);
    const runtime = Object.create(db) as Database;
    runtime.transaction = fn => db.transaction(async tx => { await tx.query('SET LOCAL ROLE reunir_app'); return fn(tx); });
    repo = new WorkspaceRepository(runtime);
    app = createApp({ repository: repo, origin, resolveSession: async () => identity });
    await repo.execute('code-black', DEMO_ADMIN, { type: 'member.status', memberId: SOFIA, status: 'suspended', reason: 'A note for the audit trail.' }, randomUUID(), 'http');
});
after(async () => db?.close());

test('a suspended member reaches only their own standing, and appeals and withdraws through their account', async () => {
    as(null);
    assert.equal((await get('/api/account/suspensions')).status, 401);
    as(DEMO_USER);
    assert.deepEqual(await (await get('/api/account/suspensions')).json(), [], 'nothing for someone not suspended');
    as(SOFIA);
    assert.equal((await get('/api/organisations/code-black/workspace')).status, 404, 'the community stays closed to them');
    const [standing] = await (await get('/api/account/suspensions')).json() as { slug: string; canAppeal: boolean; decidable: boolean }[];
    assert.deepEqual([standing.slug, standing.canAppeal, standing.decidable], ['code-black', true, false], 'the only owner suspended them, so nobody can decide yet');
    assert.equal((await post('/api/account/suspensions/code-black/appeal', { reason: '' })).status, 400);
    assert.equal((await post('/api/account/suspensions/code-black/appeal', { reason: 'Please look again.', extra: true })).status, 400);
    const sent = await post('/api/account/suspensions/code-black/appeal', { reason: 'Please look again.' });
    assert.equal(sent.status, 201);
    const body = await sent.json() as { objectId: string; message: string; standing: { appeals: { status: string }[] } };
    assert.match(body.message, /Nobody can decide it yet/);
    assert.deepEqual(body.standing.appeals.map(a => a.status), ['pending']);
    assert.equal((await post('/api/account/suspensions/code-black/appeal', { reason: 'Again.' })).status, 409);
    assert.equal((await post('/api/account/suspensions/studio-north/appeal', { reason: 'Not suspended here.' })).status, 404);
    as(DEMO_USER);
    assert.equal((await post(`/api/account/suspensions/code-black/appeals/${body.objectId}/withdraw`, {})).status, 404, 'only the suspended appellant');
    as(SOFIA);
    const withdrawn = await post(`/api/account/suspensions/code-black/appeals/${body.objectId}/withdraw`, {});
    assert.equal(withdrawn.status, 200);
    assert.equal(((await withdrawn.json()) as { standing: { canAppeal: boolean } }).standing.canAppeal, true);
});

test('any member lists only their own message reports, and a second look needs a closed report', async () => {
    as(DEMO_USER);
    assert.deepEqual(await (await get('/api/organisations/code-black/message-reports/mine')).json(), []);
    assert.equal((await post('/api/organisations/code-black/message-reports/missing/second-look', { reason: 'Please look again.' })).status, 404);
    assert.equal((await post('/api/organisations/code-black/message-reports/missing/second-look', { reason: 'No' })).status, 400);
});
