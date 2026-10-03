import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { openDatabase, type Database, type SQL } from '../packages/db/src/connection';
import { migrate } from '../packages/db/src/migrate';
import { WorkspaceRepository, setContext } from '../packages/db/src/repository';
import { grantRuntimeTables } from '../packages/db/src/runtime-role';
import { createSeed, DEMO_ADMIN } from '../packages/domain/src/seed';

const ORG = 'org_code_black', MAYA = 'member_maya';
let db: Database, repo: WorkspaceRepository, sixDraft = '', fiveDraft = '';
const exec = (cmd: unknown, user = DEMO_ADMIN) => repo.execute('code-black', user, cmd, randomUUID(), 'lesson-grants-db');
/** Runs as the restricted runtime role inside a transaction that is always rolled back. */
async function probe(user: string, fn: (tx: SQL) => Promise<unknown>) {
    try { await db.transaction(async tx => { await tx.query('SET LOCAL ROLE reunir_app'); await setContext(tx, ORG, user); await fn(tx); throw new Error('rollback'); }); }
    catch (e) { if ((e as Error).message !== 'rollback') throw e; }
}
const ids = (tx: SQL, sql: string) => tx.query<{ id: string }>(sql).then(r => r.rows.map(x => x.id).sort());

before(async () => {
    db = await openDatabase('pglite:memory'); await migrate(db);
    const owner = new WorkspaceRepository(db); await owner.seed(createSeed()); await owner.seed(createSeed('studio-north'));
    await db.query('CREATE ROLE reunir_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS');
    await db.transaction(grantRuntimeTables);
    const runtime = Object.create(db) as Database;
    runtime.transaction = fn => db.transaction(async tx => { await tx.query('SET LOCAL ROLE reunir_app'); return fn(tx); });
    repo = new WorkspaceRepository(runtime);
    await exec({ type: 'track.instructor.add', trackId: 'track_product', userId: MAYA, lessonIds: ['lesson_6'] });
    sixDraft = (await exec({ type: 'lesson.draft.create', trackId: 'track_product', lessonId: 'lesson_6' }, MAYA)).objectId!;
    fiveDraft = (await exec({ type: 'lesson.draft.create', trackId: 'track_product', lessonId: 'lesson_5' })).objectId!;
});
after(async () => db?.close());

test('the grant stores its lessons, and every existing grant keeps the whole track', async () => {
    assert.deepEqual((await db.query("SELECT user_id,lesson_ids FROM track_instructors ORDER BY user_id")).rows, [{ user_id: 'member_idris', lesson_ids: null }, { user_id: MAYA, lesson_ids: ['lesson_6'] }]);
    await assert.rejects(() => db.query("UPDATE track_instructors SET lesson_ids='[]'::jsonb WHERE user_id=$1", [MAYA]), /check constraint/);
});

test('through the restricted role, a lesson grant drafts its lesson and is refused the rest', async () => {
    assert(sixDraft && fiveDraft);
    await assert.rejects(() => exec({ type: 'lesson.draft.create', trackId: 'track_product', lessonId: 'lesson_5' }, MAYA), { code: 'LESSON_NOT_GRANTED' });
    await assert.rejects(() => exec({ type: 'lesson.draft.create', trackId: 'track_product' }, MAYA), { code: 'LESSON_NOT_GRANTED' });
    const snap = await repo.snapshot('code-black', MAYA);
    assert.deepEqual(snap.lessonDrafts.map(d => d.id), [sixDraft]);
});

test('forced RLS scopes drafts, history and attempts to the granted lessons', async () => {
    await probe(MAYA, async tx => {
        assert.deepEqual(await ids(tx, 'SELECT id FROM lesson_drafts'), [sixDraft]);
        assert((await tx.query<{ lesson_id: string }>('SELECT lesson_id FROM lesson_revisions')).rows.every(r => r.lesson_id === 'lesson_6'));
        assert.equal((await tx.query("UPDATE lesson_drafts SET title='Forged' WHERE id=$1 RETURNING id", [fiveDraft])).rows.length, 0);
        assert.deepEqual(await ids(tx, 'SELECT id FROM quiz_attempts'), ['attempt_sofia']);
    });
    // A draft of a new lesson has no lesson, so only a whole-track grant could write it.
    const newLesson = (tx: SQL) => tx.query("INSERT INTO lesson_drafts(id,organization_id,created_at,track_id,lesson_id,title,summary,body,minutes,resource_url,version,published_version,archived,created_by,updated_by,updated_at) VALUES('d_new',$1,now(),'track_product',NULL,'x','x','x',5,'',1,NULL,false,$2,$2,now())", [ORG, MAYA]);
    await assert.rejects(() => probe(MAYA, newLesson), /row-level security/);
    await probe('member_idris', newLesson);
});

test('an attempt on another lesson is neither read nor reviewed', async () => {
    await exec({ type: 'track.instructor.add', trackId: 'track_product', userId: MAYA, lessonIds: ['lesson_5'] });
    await probe(MAYA, async tx => {
        assert.deepEqual(await ids(tx, 'SELECT id FROM quiz_attempts'), []);
        assert.equal((await tx.query("UPDATE quiz_attempts SET status='reviewed',reviewer_id=$1,reviewed_at=now(),feedback='x',score=3,version=2 WHERE id='attempt_sofia' RETURNING id", [MAYA])).rows.length, 0);
    });
    await probe('member_idris', async tx => assert.deepEqual(await ids(tx, 'SELECT id FROM quiz_attempts'), ['attempt_sofia'], 'positive control'));
});
