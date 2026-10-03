import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase, type Database } from '../packages/db/src/connection';
import { migrate } from '../packages/db/src/migrate';
import { WorkspaceRepository } from '../packages/db/src/repository';
import { createSeed, DEMO_ADMIN, DEMO_USER } from '../packages/domain/src/seed';
import { createApp } from '../apps/api/src/app';

const origin = 'https://reunir.test', base = '/api/organisations/code-black/pages';
let db: Database, app: ReturnType<typeof createApp>;
let identity: { id: string; name: string } | null = { id: DEMO_USER, name: 'Alex' };
const as = (id: string | null) => { identity = id ? { id, name: id } : null; };
const get = async (path: string) => { const r = await app.request(base + path); return { status: r.status, body: await r.json() }; };

before(async () => {
    db = await openDatabase('pglite:memory'); await migrate(db);
    const repo = new WorkspaceRepository(db); await repo.seed(createSeed()); await repo.seed(createSeed('studio-north'));
    for (let i = 0; i < 45; i++) await db.query("INSERT INTO notifications(id,organization_id,created_at,user_id,title,body,href,read_at) VALUES($1,'org_code_black',$2,$3,'A notice','Body','/home',NULL)", [`n_${i}`, new Date(Date.UTC(2026, 8, 1, 0, i)).toISOString(), DEMO_USER]);
    for (let i = 0; i < 6; i++) await db.query("INSERT INTO audit(id,organization_id,created_at,actor_id,action,object_id,metadata) VALUES($1,'org_code_black',now(),$2,'test.action','x','{}')", [`audit_${i}`, DEMO_ADMIN]);
    app = createApp({ repository: repo, origin, resolveSession: async () => identity });
});
after(async () => db?.close());

test('pages of notices follow the cursor and respect the limit', async () => {
    as(DEMO_USER);
    const first = await get('/notifications?limit=10');
    assert.equal(first.status, 200);
    assert.equal(first.body.items.length, 10);
    assert(first.body.total >= 45);
    const next = await get(`/notifications?limit=10&cursor=${first.body.nextCursor}`);
    assert.equal(next.body.items.length, 10);
    assert(!next.body.items.some((n: { id: string }) => first.body.items.some((m: { id: string }) => m.id === n.id)));
    assert(JSON.stringify([first.body, next.body]).indexOf('member_sofia') < 0, 'only the person’s own notices');
});

test('bad lists, cursors and limits are refused; signing in and membership are required', async () => {
    as(DEMO_USER);
    assert.equal((await get('/everything')).status, 404);
    assert.equal((await get('/notifications?cursor=not-ours')).body.error.code, 'INVALID_CURSOR');
    assert.equal((await get('/notifications?limit=500')).status, 400);
    assert.equal((await get('/notifications?limit=abc')).status, 400);
    assert.equal((await get('/audit')).status, 403, 'members do not read the audit trail');
    as(DEMO_ADMIN);
    assert.equal((await get('/audit?limit=5')).body.items.length, 5);
    as(null);
    assert.equal((await get('/notifications')).status, 401);
    as('stranger');
    assert.equal((await get('/notifications')).status, 404);
});
