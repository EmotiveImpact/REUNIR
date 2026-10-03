import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { openDatabase, type Database } from '../packages/db/src/connection';
import { migrate } from '../packages/db/src/migrate';
import { WorkspaceRepository } from '../packages/db/src/repository';
import { createSeed, DEMO_ADMIN, DEMO_USER } from '../packages/domain/src/seed';
import { createApp } from '../apps/api/src/app';
import { FakeBucket } from './helpers/fake-bucket';

const origin = 'https://reunir.test', base = '/api/organisations/code-black';
let db: Database, app: ReturnType<typeof createApp>;
let identity: { id: string; name: string } | null = null;
const as = (id: string) => { identity = { id, name: id }; };
const command = (body: unknown) => app.request(base + '/commands', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, 'Idempotency-Key': randomUUID() }, body: JSON.stringify(body) });
const code = async (r: Response) => (await r.json()).error?.code;
const workspace = async () => (await app.request(base + '/workspace')).json();

before(async () => {
    db = await openDatabase('pglite:memory'); await migrate(db);
    const repo = new WorkspaceRepository(db); await repo.seed(createSeed()); await repo.seed(createSeed('studio-north'));
    app = createApp({ repository: repo, origin, resolveSession: async () => identity, storage: new FakeBucket() });
});
after(async () => db?.close());

test('members are refused curation; their workspace never carries drafts or team-only items', async () => {
    as(DEMO_USER);
    const refused = await command({ type: 'collection.save', title: 'Mine' });
    assert.equal(refused.status, 403);
    assert.equal(await code(refused), 'CURATOR_REQUIRED');
    assert.equal((await command({ type: 'collection.save', title: 'Mine', featured: true })).status, 400, 'unknown fields are refused');
    const raw = JSON.stringify(await workspace());
    for (const secret of ['Feedback that helps', 'collected_team_notes', 'Team only']) assert(!raw.includes(secret), secret);
    assert(raw.includes('Start here'));
});

test('a moderator curates through the command endpoint, and members see the result once published', async () => {
    as('member_maya');
    const created = await command({ type: 'collection.save', title: 'Worth an evening' });
    assert.equal(created.status, 200);
    const id = (await created.json()).objectId;
    assert.equal(await code(await command({ type: 'collection.item.add', collectionId: id, kind: 'post', targetId: 'post_private' })), 'NOT_FOUND', 'not in the private studio');
    assert.equal((await command({ type: 'collection.item.add', collectionId: id, kind: 'track', targetId: 'track_story', note: 'A calm start.' })).status, 200);
    as(DEMO_USER);
    assert(!(await workspace()).collections.some((c: { id: string }) => c.id === id), 'still a draft');
    as('member_maya');
    assert.equal((await command({ type: 'collection.publish', collectionId: id, published: true })).status, 200);
    as(DEMO_USER);
    const ws = await workspace();
    assert(ws.collections.some((c: { id: string }) => c.id === id));
    assert.deepEqual(ws.collectionItems.filter((i: { collectionId: string }) => i.collectionId === id).map((i: { note: string }) => i.note), ['A calm start.']);
    as(DEMO_ADMIN);
    assert(!(await (await app.request('/api/organisations/studio-north/workspace')).json()).collections.some((c: { id: string }) => c.id === id), 'another community never sees it');
});
