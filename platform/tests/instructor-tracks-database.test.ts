import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { openDatabase, type Database, type SQL } from '../packages/db/src/connection';
import { migrate } from '../packages/db/src/migrate';
import { WorkspaceRepository, setContext } from '../packages/db/src/repository';
import { grantRuntimeTables } from '../packages/db/src/runtime-role';
import { createSeed, DEMO_ADMIN, DEMO_USER } from '../packages/domain/src/seed';

const ORG = 'org_code_black', IDRIS = 'member_idris', MAYA = 'member_maya';
let db: Database, repo: WorkspaceRepository, started = '';
const exec = (cmd: unknown, user = DEMO_ADMIN) => repo.execute('code-black', user, cmd, randomUUID(), 'instructor-tracks-db');
async function probe(user: string, fn: (tx: SQL) => Promise<unknown>) {
    try { await db.transaction(async tx => { await tx.query('SET LOCAL ROLE reunir_app'); await setContext(tx, ORG, user); await fn(tx); throw new Error('rollback'); }); }
    catch (e) { if ((e as Error).message !== 'rollback') throw e; }
}
const track = (tx: SQL, id: string, author: string, published: boolean) => tx.query("INSERT INTO tracks(id,organization_id,created_at,space_id,title,summary,description,category,level,colour,cover,author_id,published) VALUES($1,$2,now(),NULL,'t','s','d','c','All levels','violet','custom',$3,$4)", [id, ORG, author, published]);
const grant = (tx: SQL, trackId: string, user: string, by = user, role = 'instructor') => tx.query("INSERT INTO track_instructors(id,organization_id,created_at,track_id,user_id,granted_by,role) VALUES($1,$2,now(),$3,$4,$5,$6)", [randomUUID(), ORG, trackId, user, by, role]);

before(async () => {
    db = await openDatabase('pglite:memory'); await migrate(db);
    const owner = new WorkspaceRepository(db); await owner.seed(createSeed()); await owner.seed(createSeed('studio-north'));
    await db.query('CREATE ROLE reunir_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS');
    await db.transaction(grantRuntimeTables);
    const runtime = Object.create(db) as Database;
    runtime.transaction = fn => db.transaction(async tx => { await tx.query('SET LOCAL ROLE reunir_app'); return fn(tx); });
    repo = new WorkspaceRepository(runtime);
    started = (await exec({ type: 'track.create', title: 'Interviews', summary: 'Listening.', description: 'Five lessons.', category: 'Product building' }, IDRIS)).objectId!;
});
after(async () => db?.close());

test('through the restricted role, an instructor starts an unpublished track with their own grant', async () => {
    assert.deepEqual((await db.query('SELECT published,author_id FROM tracks WHERE id=$1', [started])).rows, [{ published: false, author_id: IDRIS }]);
    assert.deepEqual((await db.query('SELECT user_id,granted_by,role,lesson_ids FROM track_instructors WHERE track_id=$1', [started])).rows, [{ user_id: IDRIS, granted_by: IDRIS, role: 'instructor', lesson_ids: null }]);
    assert((await repo.snapshot('code-black', IDRIS)).tracks.some(t => t.id === started));
    assert(!(await repo.snapshot('code-black', DEMO_USER)).tracks.some(t => t.id === started));
    await assert.rejects(() => exec({ type: 'track.create', title: 'x', summary: 'x', description: 'x', category: 'x' }, DEMO_USER), { code: 'TRACK_STARTER_REQUIRED' });
    await exec({ type: 'track.publish', trackId: started });
    assert.equal((await db.query<{ published: boolean }>('SELECT published FROM tracks WHERE id=$1', [started])).rows[0].published, true);
});

test('forced RLS admits a self-grant only on a new unpublished track the instructor wrote', async () => {
    await probe(IDRIS, async tx => { await track(tx, 't_own', IDRIS, false); await grant(tx, 't_own', IDRIS); });
    for (const [why, setup] of [
        ['a published track', (tx: SQL) => track(tx, 't_x', IDRIS, true)],
        ['someone else’s track', (tx: SQL) => track(tx, 't_x', MAYA, false)],
        ['a track that already has a grant', (tx: SQL) => track(tx, 't_x', IDRIS, false)],
    ] as const) {
        await assert.rejects(() => probe(IDRIS, async tx => {
            await setup(tx);
            if (why === 'a track that already has a grant') { await tx.query('RESET ROLE'); await grant(tx, 't_x', MAYA, DEMO_ADMIN); await tx.query('SET LOCAL ROLE reunir_app'); }
            await grant(tx, 't_x', IDRIS);
        }), /row-level security/, why);
    }
    // A member who teaches nothing, and a contributor, cannot grant themselves anything.
    await assert.rejects(() => probe(DEMO_USER, async tx => { await track(tx, 't_x', DEMO_USER, false); await grant(tx, 't_x', DEMO_USER); }), /row-level security/);
    await assert.rejects(() => probe(IDRIS, async tx => { await track(tx, 't_x', IDRIS, false); await grant(tx, 't_x', IDRIS, IDRIS, 'contributor'); }), /row-level security/);
});

test('suspension ends the right to start a track', async () => {
    await db.query("UPDATE members SET status='suspended' WHERE organization_id=$1 AND user_id=$2", [ORG, IDRIS]);
    try { await assert.rejects(() => probe(IDRIS, async tx => { await track(tx, 't_x', IDRIS, false); await grant(tx, 't_x', IDRIS); })); }
    finally { await db.query("UPDATE members SET status='active' WHERE organization_id=$1 AND user_id=$2", [ORG, IDRIS]); }
});
