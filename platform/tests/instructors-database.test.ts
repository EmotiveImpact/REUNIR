import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { openDatabase, type Database, type SQL } from '../packages/db/src/connection';
import { migrate } from '../packages/db/src/migrate';
import { WorkspaceRepository, setContext } from '../packages/db/src/repository';
import { grantRuntimeTables } from '../packages/db/src/runtime-role';
import { createSeed, DEMO_ADMIN, DEMO_USER } from '../packages/domain/src/seed';
import { seedBeforeProjectWork } from './helpers/legacy-fixture';
import { MIGRATION_COUNT } from './helpers/migrations';

const ORG = 'org_code_black', IDRIS = 'member_idris';
let db: Database, repo: WorkspaceRepository;
const exec = (cmd: unknown, user = DEMO_ADMIN) => repo.execute('code-black', user, cmd, randomUUID(), 'instructors-db');
const as = <T>(user: string, org: string, fn: (tx: SQL) => Promise<T>) => db.transaction(async tx => { await tx.query('SET LOCAL ROLE reunir_app'); await setContext(tx, org, user); return fn(tx); });
const ids = (tx: SQL, sql: string) => tx.query<{ id: string }>(sql).then(r => r.rows.map(x => x.id).sort());
/** Runs inside a transaction that is always rolled back, so probes leave no rows behind. */
async function probe(user: string, fn: (tx: SQL) => Promise<unknown>) {
    try { await db.transaction(async tx => { await tx.query('SET LOCAL ROLE reunir_app'); await setContext(tx, ORG, user); await fn(tx); throw new Error('rollback'); }); }
    catch (e) { if ((e as Error).message !== 'rollback') throw e; }
}
let productDraft = '', storyDraft = '';

before(async () => {
    db = await openDatabase('pglite:memory'); await migrate(db);
    const owner = new WorkspaceRepository(db); await owner.seed(createSeed()); await owner.seed(createSeed('studio-north'));
    await db.query('CREATE ROLE reunir_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS');
    await db.transaction(grantRuntimeTables);
    const runtime = Object.create(db) as Database;
    runtime.transaction = fn => db.transaction(async tx => { await tx.query('SET LOCAL ROLE reunir_app'); return fn(tx); });
    repo = new WorkspaceRepository(runtime);
    productDraft = (await exec({ type: 'lesson.draft.create', trackId: 'track_product' }, IDRIS)).objectId!;
    storyDraft = (await exec({ type: 'lesson.draft.create', trackId: 'track_story' })).objectId!;
});
after(async () => db?.close());

test('0012 upgrade keeps every track, draft and attempt as it was and grants nobody anything', async () => {
    const old = await openDatabase('pglite:memory');
    try {
        await migrate(old, '0011'); await seedBeforeProjectWork(old);
        const read = async (table: string) => (await old.query(`SELECT * FROM ${table} ORDER BY organization_id,id`)).rows;
        const before = { tracks: await read('tracks'), lessons: await read('lessons'), members: await read('members') };
        await migrate(old); await migrate(old);
        for (const table of ['tracks', 'lessons', 'members'] as const) assert.deepEqual(await read(table), before[table], table);
        assert.deepEqual(await read('track_instructors'), []);
        assert.equal((await old.query('SELECT version FROM schema_migrations')).rows.length, MIGRATION_COUNT);
    } finally { await old.close(); }
});

test('through the restricted role, an instructor authors their own track and is refused another', async () => {
    assert(productDraft && storyDraft);
    await assert.rejects(() => exec({ type: 'lesson.draft.create', trackId: 'track_story' }, IDRIS), { code: 'NOT_FOUND' });
    const snap = await repo.snapshot('code-black', IDRIS);
    assert.deepEqual(snap.lessonDrafts.map(d => d.trackId), ['track_product']);
    await assert.rejects(() => exec({ type: 'lesson.draft.create', trackId: 'track_product' }, DEMO_USER), { code: 'AUTHOR_REQUIRED' });
});

test('forced RLS limits an instructor to their own track’s drafts, history and attempts', async () => {
    await as(IDRIS, ORG, async tx => {
        assert.deepEqual(await ids(tx, 'SELECT id FROM lesson_drafts'), [productDraft]);
        assert((await tx.query<{ track_id: string }>('SELECT track_id FROM lesson_revisions')).rows.every(r => r.track_id === 'track_product'));
        assert.deepEqual(await ids(tx, 'SELECT id FROM quiz_attempts'), ['attempt_sofia']);
    });
    await as(DEMO_USER, ORG, async tx => assert.deepEqual(await ids(tx, 'SELECT id FROM lesson_drafts'), [], 'members see no drafts'));
    await as(DEMO_ADMIN, ORG, async tx => assert.deepEqual(await ids(tx, 'SELECT id FROM lesson_drafts'), [productDraft, storyDraft].sort()));
    await as(IDRIS, 'org_studio_north', async tx => assert.deepEqual(await ids(tx, 'SELECT id FROM lesson_drafts'), []));
    // Writing another track's draft is refused by the database itself, not only by the domain.
    await probe(IDRIS, async tx => assert.equal((await tx.query("UPDATE lesson_drafts SET title='Forged' WHERE id=$1 RETURNING id", [storyDraft])).rows.length, 0));
    const draftRow = (tx: SQL, track: string) => tx.query("INSERT INTO lesson_drafts(id,organization_id,created_at,track_id,lesson_id,title,summary,body,minutes,resource_url,version,published_version,archived,created_by,updated_by,updated_at) VALUES($1,$2,now(),$3,NULL,'x','x','x',5,'',1,NULL,false,$4,$4,now())", [`d_${track}`, ORG, track, IDRIS]);
    await assert.rejects(() => probe(IDRIS, tx => draftRow(tx, 'track_story')), /row-level security/);
    await probe(IDRIS, tx => draftRow(tx, 'track_product'));
    await probe(IDRIS, async tx => assert.equal((await tx.query("UPDATE lesson_drafts SET title='Allowed' WHERE id=$1 RETURNING id", [productDraft])).rows.length, 1, 'positive controls'));
});

test('an instructor reviews an attempt on their track once, and only someone else’s', async () => {
    const review = (tx: SQL, reviewer: string) => tx.query("UPDATE quiz_attempts SET status='reviewed',reviewer_id=$1,reviewed_at=now(),feedback='Marked',score=3,version=2 WHERE id='attempt_sofia' RETURNING id", [reviewer]).then(r => r.rows.length);
    await probe(DEMO_USER, async tx => assert.equal(await review(tx, DEMO_USER), 0, 'a member’s update matches no rows'));
    await probe(IDRIS, async tx => assert.equal(await review(tx, IDRIS), 1, 'the instructor may review'));
    await assert.rejects(() => probe(IDRIS, tx => review(tx, DEMO_ADMIN)), /row-level security/, 'only in their own name');
    await exec({ type: 'quiz.attempt.review', attemptId: 'attempt_sofia', expectedVersion: 1, marks: [{ questionId: 'q6_change', points: 2 }], feedback: 'Observed and specific.' }, IDRIS);
    assert.deepEqual((await db.query("SELECT status,reviewer_id FROM quiz_attempts WHERE id='attempt_sofia'")).rows, [{ status: 'reviewed', reviewer_id: IDRIS }]);
    await probe(IDRIS, async tx => assert.equal(await review(tx, IDRIS), 0, 'a finished review cannot be rewritten'));
});

test('only an active owner or administrator grants or revokes, in their own name', async () => {
    const grant = (tx: SQL, by: string) => tx.query("INSERT INTO track_instructors(id,organization_id,created_at,track_id,user_id,granted_by) VALUES('g_probe',$1,now(),'track_story','member_maya',$2)", [ORG, by]);
    await assert.rejects(() => probe(IDRIS, tx => grant(tx, IDRIS)), /row-level security/, 'instructors cannot grant');
    await assert.rejects(() => probe(DEMO_USER, tx => grant(tx, DEMO_USER)), /row-level security/);
    await assert.rejects(() => probe(DEMO_ADMIN, tx => grant(tx, IDRIS)), /row-level security/, 'never in someone else’s name');
    await probe(DEMO_ADMIN, tx => grant(tx, DEMO_ADMIN));
    await probe(IDRIS, async tx => assert.equal((await tx.query("DELETE FROM track_instructors WHERE user_id=$1 RETURNING id", [IDRIS])).rows.length, 0, 'an instructor cannot revoke'));
    await exec({ type: 'track.instructor.add', trackId: 'track_story', userId: 'member_maya' });
    assert.deepEqual((await db.query("SELECT track_id,granted_by FROM track_instructors WHERE user_id='member_maya'")).rows, [{ track_id: 'track_story', granted_by: DEMO_ADMIN }]);
    await exec({ type: 'track.instructor.remove', trackId: 'track_story', userId: 'member_maya' });
    assert.equal((await db.query("SELECT id FROM track_instructors WHERE user_id='member_maya'")).rows.length, 0);
});

test('suspension ends database access for an instructor at once', async () => {
    await db.query("UPDATE members SET status='suspended' WHERE organization_id=$1 AND user_id=$2", [ORG, IDRIS]);
    try {
        await as(IDRIS, ORG, async tx => {
            assert.deepEqual(await ids(tx, 'SELECT id FROM lesson_drafts'), []);
            assert.deepEqual(await ids(tx, "SELECT id FROM quiz_attempts WHERE user_id<>'member_idris'"), []);
        });
    } finally { await db.query("UPDATE members SET status='active' WHERE organization_id=$1 AND user_id=$2", [ORG, IDRIS]); }
});

test('lesson files of a draft are readable by the track’s instructor and no other member', async () => {
    const insert = (id: string, track: string) => db.query("INSERT INTO upload_intents(organization_id,id,user_id,object_key,content_type,size_bytes,original_name,created_at,status,purpose,track_id,completed_at,generation) VALUES($1,$2,$3,$4,'application/pdf',10,'f.pdf',now(),'ready','lesson_resource',$5,now(),'1')", [ORG, id, DEMO_ADMIN, `k-${id}`, track]);
    await insert('file_product', 'track_product'); await insert('file_story', 'track_story');
    const files = (user: string) => as(user, ORG, tx => ids(tx, "SELECT id FROM upload_intents WHERE id IN ('file_product','file_story')"));
    assert.deepEqual(await files(IDRIS), ['file_product']);
    assert.deepEqual(await files(DEMO_USER), []);
    assert.deepEqual(await files(DEMO_ADMIN), ['file_product', 'file_story']);
});

test('runtime grants allow adding and revoking grants, never rewriting them', async () => {
    const can = async (privilege: string) => (await db.query<{ ok: boolean }>("SELECT has_table_privilege('reunir_app','track_instructors',$1) AS ok", [privilege])).rows[0].ok;
    assert.deepEqual([await can('SELECT'), await can('INSERT'), await can('DELETE'), await can('UPDATE')], [true, true, true, false]);
});
