import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase, type Database } from '../packages/db/src/connection';
import { migrate } from '../packages/db/src/migrate';
import { WorkspaceRepository } from '../packages/db/src/repository';
import { grantRuntimeTables } from '../packages/db/src/runtime-role';
import { createSeed, DEMO_ADMIN, DEMO_USER } from '../packages/domain/src/seed';
import { USAGE_PER_MINUTE } from '../packages/contracts/src/usage';
import { createApp } from '../apps/api/src/app';

// Alpha 60: the usage routes (decision 060).
const origin = 'https://reunir.test';
let db: Database, app: ReturnType<typeof createApp>;
let identity: { id: string; name: string } | null = null;
const as = (id: string | null) => { identity = id ? { id, name: id } : null; };
const get = (path: string) => app.request(path, { headers: { origin } });
const post = (path: string, body: unknown) => app.request(path, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body) });
const total = async () => (await db.query<{ n: number }>("SELECT coalesce(sum(count),0)::int AS n FROM usage_counts WHERE organization_id='org_code_black'")).rows[0].n;

before(async () => {
    db = await openDatabase('pglite:memory'); await migrate(db);
    const owner = new WorkspaceRepository(db); await owner.seed(createSeed()); await owner.seed(createSeed('studio-north'));
    await db.query('CREATE ROLE reunir_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS');
    await db.transaction(grantRuntimeTables);
    const runtime = Object.create(db) as Database;
    runtime.transaction = fn => db.transaction(async tx => { await tx.query('SET LOCAL ROLE reunir_app'); return fn(tx); });
    app = createApp({ repository: new WorkspaceRepository(runtime), origin, resolveSession: async () => identity });
    // Both fictional communities share their people; Alex is not an active member of Studio North here.
    await db.query("UPDATE members SET status='suspended' WHERE organization_id='org_studio_north' AND user_id=$1", [DEMO_USER]);
});
after(async () => db?.close());

test('a signed-in member counts a visit with nothing but the part of the community', async () => {
    as(null);
    assert.equal((await post('/api/organisations/code-black/usage', { area: 'projects' })).status, 401);
    as(DEMO_USER);
    const counted = await post('/api/organisations/code-black/usage', { area: 'projects' });
    assert.equal(counted.status, 200);
    assert.deepEqual(await counted.json(), { counted: true });
    assert.equal((await post('/api/organisations/code-black/usage', { area: 'admin' })).status, 400);
    assert.equal((await post('/api/organisations/code-black/usage', { area: 'projects', path: '/projects/p1' })).status, 400);
    assert.equal((await post('/api/organisations/studio-north/usage', { area: 'projects' })).status, 404);
    assert.equal(await total(), 1);
});

test('a burst beyond the limit is dropped quietly rather than refused', async () => {
    as('member_jordan');
    let dropped = 0;
    for (let i = 0; i < USAGE_PER_MINUTE + 3; i++) {
        const r = await post('/api/organisations/code-black/usage', { area: 'home' });
        assert.equal(r.status, 200);
        if (!(await r.json() as { counted: boolean }).counted) dropped++;
    }
    assert.equal(dropped, 3);
});

test('only owners and administrators read the weekly report', async () => {
    as(DEMO_USER);
    assert.equal((await get('/api/organisations/code-black/usage')).status, 403);
    as(DEMO_ADMIN);
    const r = await get('/api/organisations/code-black/usage');
    assert.equal(r.status, 200);
    const body = await r.json() as { weeks: string[]; areas: { area: string; counts: (number | null)[] }[] };
    assert.equal(body.areas.find(a => a.area === 'home')!.counts.at(-1), USAGE_PER_MINUTE);
    assert.equal(body.areas.find(a => a.area === 'projects')!.counts.at(-1), null, 'one visit shows as fewer than five');
    assert.equal(JSON.stringify(body).includes('member_'), false, 'no person appears anywhere in it');
});
