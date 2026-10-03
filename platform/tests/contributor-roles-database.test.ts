import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { openDatabase, type Database, type SQL } from '../packages/db/src/connection';
import { migrate } from '../packages/db/src/migrate';
import { WorkspaceRepository, setContext } from '../packages/db/src/repository';
import { grantRuntimeTables } from '../packages/db/src/runtime-role';
import { createSeed, DEMO_ADMIN } from '../packages/domain/src/seed';
import { seedBeforeProjectWork } from './helpers/legacy-fixture';

const ORG = 'org_code_black', MAYA = 'member_maya', IDRIS = 'member_idris';
let db: Database, repo: WorkspaceRepository, mayaDraft = '';
const exec = (cmd: unknown, user = DEMO_ADMIN) => repo.execute('code-black', user, cmd, randomUUID(), 'contributor-db');
/** Runs as the restricted runtime role inside a transaction that is always rolled back. */
async function probe(user: string, fn: (tx: SQL) => Promise<unknown>) {
    try { await db.transaction(async tx => { await tx.query('SET LOCAL ROLE reunir_app'); await setContext(tx, ORG, user); await fn(tx); throw new Error('rollback'); }); }
    catch (e) { if ((e as Error).message !== 'rollback') throw e; }
}
const revision = (tx: SQL, kind: string) => tx.query("INSERT INTO lesson_revisions(id,organization_id,created_at,track_id,lesson_id,draft_id,sequence,kind,actor_id,title,summary,body,minutes,resource_url) VALUES($1,$2,now(),'track_product','lesson_4',$3,99,$4,$5,'x','x','x',5,'')", [`rev_${kind}`, ORG, mayaDraft, kind, MAYA]);

before(async () => {
    db = await openDatabase('pglite:memory'); await migrate(db);
    const owner = new WorkspaceRepository(db); await owner.seed(createSeed()); await owner.seed(createSeed('studio-north'));
    await db.query('CREATE ROLE reunir_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS');
    await db.transaction(grantRuntimeTables);
    const runtime = Object.create(db) as Database;
    runtime.transaction = fn => db.transaction(async tx => { await tx.query('SET LOCAL ROLE reunir_app'); return fn(tx); });
    repo = new WorkspaceRepository(runtime);
    await exec({ type: 'track.instructor.add', trackId: 'track_product', userId: MAYA, role: 'contributor' });
    mayaDraft = (await exec({ type: 'lesson.draft.create', trackId: 'track_product', lessonId: 'lesson_4' }, MAYA)).objectId!;
});
after(async () => db?.close());

test('the upgrade keeps every existing grant as an instructor’s', async () => {
    const old = await openDatabase('pglite:memory');
    try {
        await migrate(old, '0022'); await seedBeforeProjectWork(old);
        await old.query("INSERT INTO track_instructors(id,organization_id,created_at,track_id,user_id,granted_by) VALUES('g_old',$1,now(),'track_product',$2,$3)", [ORG, IDRIS, DEMO_ADMIN]);
        await migrate(old);
        assert.deepEqual((await old.query('SELECT user_id,role FROM track_instructors')).rows, [{ user_id: IDRIS, role: 'instructor' }]);
        await assert.rejects(() => old.query("INSERT INTO track_instructors(id,organization_id,created_at,track_id,user_id,granted_by,role) VALUES('g_x',$1,now(),'track_story',$2,$3,'owner')", [ORG, MAYA, DEMO_ADMIN]), /check constraint/);
    } finally { await old.close(); }
});

test('through the restricted role, a contributor drafts and is refused publication', async () => {
    assert(mayaDraft);
    assert.deepEqual((await db.query("SELECT role,granted_by FROM track_instructors WHERE user_id=$1", [MAYA])).rows, [{ role: 'contributor', granted_by: DEMO_ADMIN }]);
    assert.deepEqual((await db.query("SELECT kind FROM lesson_revisions WHERE lesson_id='lesson_4'")).rows, [{ kind: 'captured' }], 'the contributor recorded the captured baseline');
    await assert.rejects(() => exec({ type: 'lesson.draft.publish', draftId: mayaDraft, expectedVersion: 1 }, MAYA), { code: 'INSTRUCTOR_REQUIRED' });
    const snap = await repo.snapshot('code-black', MAYA);
    assert.deepEqual(snap.lessonDrafts.map(d => d.id), [mayaDraft]);
    assert(!snap.quizAttempts.some(a => a.id === 'attempt_sofia'));
});

test('forced RLS keeps published revisions and attempts from a contributor', async () => {
    await probe(MAYA, async tx => assert.equal((await tx.query("UPDATE lesson_drafts SET title='Allowed' WHERE id=$1 RETURNING id", [mayaDraft])).rows.length, 1, 'drafts stay writable'));
    await probe(MAYA, tx => revision(tx, 'captured'));
    await assert.rejects(() => probe(MAYA, tx => revision(tx, 'published')), /row-level security/);
    await probe(IDRIS, tx => revision(tx, 'published'));
    await probe(MAYA, async tx => {
        assert.equal((await tx.query("SELECT id FROM quiz_attempts WHERE id='attempt_sofia'")).rows.length, 0);
        assert.equal((await tx.query("UPDATE quiz_attempts SET status='reviewed',reviewer_id=$1,reviewed_at=now(),feedback='x',score=3,version=2 WHERE id='attempt_sofia' RETURNING id", [MAYA])).rows.length, 0);
    });
    await probe(IDRIS, async tx => assert.equal((await tx.query("SELECT id FROM quiz_attempts WHERE id='attempt_sofia'")).rows.length, 1, 'positive control'));
});

test('a role change replaces the row, and the runtime role still cannot rewrite one', async () => {
    const before = (await db.query<{ id: string }>('SELECT id FROM track_instructors WHERE user_id=$1', [MAYA])).rows[0].id;
    await exec({ type: 'track.instructor.add', trackId: 'track_product', userId: MAYA, role: 'instructor' });
    const after = (await db.query<{ id: string; role: string }>('SELECT id,role FROM track_instructors WHERE user_id=$1', [MAYA])).rows;
    assert.equal(after.length, 1); assert.notEqual(after[0].id, before); assert.equal(after[0].role, 'instructor');
    await assert.rejects(() => probe(DEMO_ADMIN, tx => tx.query("UPDATE track_instructors SET role='contributor'")), /permission denied/);
    await exec({ type: 'track.instructor.add', trackId: 'track_product', userId: MAYA, role: 'contributor' });
});
