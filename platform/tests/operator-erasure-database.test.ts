import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { openDatabase, type Database, type SQL } from '../packages/db/src/connection';
import { migrate } from '../packages/db/src/migrate';
import { WorkspaceRepository, setContext } from '../packages/db/src/repository';
import { grantRuntimeTables } from '../packages/db/src/runtime-role';
import { createSeed, DEMO_ADMIN, DEMO_USER } from '../packages/domain/src/seed';
import { quizFingerprint } from '../packages/contracts/src/assessments';

const ORG = 'org_code_black', SOFIA = 'member_sofia';
let db: Database, runtime: WorkspaceRepository, operator: WorkspaceRepository;
/** A repository whose transactions run as the given role, as a hosted connection for that role would. */
function as(role: string) {
    const scoped = Object.create(db) as Database;
    scoped.transaction = fn => db.transaction(async tx => { await tx.query(`SET LOCAL ROLE ${role}`); return fn(tx); });
    return new WorkspaceRepository(scoped);
}
const count = async (sql: string, params: unknown[] = []) => (await db.query<{ n: number }>(sql, params)).rows[0].n;

before(async () => {
    db = await openDatabase('pglite:memory'); await migrate(db);
    const owner = new WorkspaceRepository(db); await owner.seed(createSeed()); await owner.seed(createSeed('studio-north'));
    await db.query('CREATE ROLE reunir_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS');
    await db.transaction(grantRuntimeTables);
    // A stand-in for a hosted migration role: full table privileges but no superuser and no row-security bypass.
    await db.query('CREATE ROLE reunir_operator NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS');
    await db.query('GRANT USAGE ON SCHEMA public TO reunir_operator');
    await db.query('GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO reunir_operator');
    runtime = as('reunir_app'); operator = as('reunir_operator');
    // Sofia's seeded answer is reviewed, which sends her a feedback notice; Alex answers too, and must keep his.
    await runtime.execute('code-black', DEMO_ADMIN, { type: 'quiz.attempt.review', attemptId: 'attempt_sofia', expectedVersion: 1, marks: [{ questionId: 'q6_change', points: 2 }], feedback: 'Specific and observed.' }, randomUUID(), 'erasure-test');
    const seen = (await runtime.snapshot('code-black', DEMO_USER)).lessons.find(l => l.id === 'lesson_5')!.quiz!;
    await runtime.execute('code-black', DEMO_USER, { type: 'quiz.attempt.submit', lessonId: 'lesson_5', fingerprint: quizFingerprint(seen), answers: [{ questionId: 'q5_feedback', optionIds: ['a'] }, { questionId: 'q5_essentials', optionIds: ['a'] }, { questionId: 'q5_outcome', text: 'useful' }] }, randomUUID(), 'erasure-test');
});
after(async () => db?.close());

test('0014 upgrade adds one delete policy and changes no rows', async () => {
    const old = await openDatabase('pglite:memory');
    try {
        await migrate(old, '0013'); await new WorkspaceRepository(old).seed(createSeed());
        const read = async (table: string) => (await old.query(`SELECT * FROM ${table} ORDER BY organization_id,id`)).rows;
        const before = { quiz_attempts: await read('quiz_attempts'), notifications: await read('notifications'), audit: await read('audit') };
        await migrate(old); await migrate(old);
        for (const table of ['quiz_attempts', 'notifications', 'audit'] as const) assert.deepEqual(await read(table), before[table], table);
        assert.deepEqual((await old.query("SELECT policyname,permissive FROM pg_policies WHERE tablename='quiz_attempts' AND cmd='DELETE' ORDER BY policyname")).rows, [
            { policyname: 'attempt_account_erasure', permissive: 'PERMISSIVE' }, { policyname: 'attempt_erasure', permissive: 'PERMISSIVE' }, { policyname: 'attempt_runtime_deletion', permissive: 'RESTRICTIVE' }]);
        assert.equal((await old.query('SELECT version FROM schema_migrations')).rows.length, 19);
    } finally { await old.close(); }
});

test('a dry run counts what would be erased and changes nothing', async () => {
    const before = await count('SELECT count(*)::int AS n FROM quiz_attempts');
    assert.deepEqual(await operator.eraseLearnerAnswers('code-black', DEMO_ADMIN, SOFIA, 'request 41', false), { attempts: 1, notifications: 1, applied: false });
    assert.equal(await count('SELECT count(*)::int AS n FROM quiz_attempts'), before);
});

test('only an active owner may authorise; references, members and communities are checked', async () => {
    await assert.rejects(() => operator.eraseLearnerAnswers('code-black', DEMO_USER, SOFIA, 'request 41', true), { code: 'OWNER_REQUIRED' });
    await db.query("UPDATE members SET role='admin' WHERE organization_id=$1 AND user_id='member_maya'", [ORG]);
    try { await assert.rejects(() => operator.eraseLearnerAnswers('code-black', 'member_maya', SOFIA, 'request 41', true), { code: 'OWNER_REQUIRED' }, 'administrators are not enough'); }
    finally { await db.query("UPDATE members SET role='moderator' WHERE organization_id=$1 AND user_id='member_maya'", [ORG]); }
    await assert.rejects(() => operator.eraseLearnerAnswers('code-black', DEMO_ADMIN, 'nobody_here', 'request 41', true), { code: 'NOT_FOUND' });
    await assert.rejects(() => operator.eraseLearnerAnswers('code-black', DEMO_ADMIN, SOFIA, 'x', true), { code: 'VALIDATION' });
    await assert.rejects(() => operator.eraseLearnerAnswers('code-black', DEMO_ADMIN, SOFIA, "request'; DROP TABLE audit;--", true), { code: 'VALIDATION' });
    await assert.rejects(() => operator.eraseLearnerAnswers('no-such-community', DEMO_ADMIN, SOFIA, 'request 41', true), { code: 'NOT_FOUND' });
    await db.query("UPDATE members SET status='suspended' WHERE organization_id=$1 AND user_id=$2", [ORG, DEMO_ADMIN]);
    try { await assert.rejects(() => operator.eraseLearnerAnswers('code-black', DEMO_ADMIN, SOFIA, 'request 41', true), { code: 'NOT_FOUND' }, 'a suspended owner authorises nothing'); }
    finally { await db.query("UPDATE members SET status='active' WHERE organization_id=$1 AND user_id=$2", [ORG, DEMO_ADMIN]); }
    assert.equal(await count('SELECT count(*)::int AS n FROM quiz_attempts WHERE user_id=$1', [SOFIA]), 1, 'nothing was erased by a refused request');
});

test('the runtime role can never erase another member’s attempts, and the operator deletes nothing without naming the member', async () => {
    const tx = (role: string, fn: (sql: SQL) => Promise<unknown>) => db.transaction(async sql => { await sql.query(`SET LOCAL ROLE ${role}`); await setContext(sql, ORG, DEMO_ADMIN); return fn(sql); });
    // Since 0015 the runtime role may delete only its own attempts while deleting its own account; the operator
    // erasure policy stays out of its reach, even for an active owner naming a subject.
    assert.equal(await tx('reunir_app', sql => sql.query("SELECT set_config('app.erasure_subject',$1,true)", [SOFIA]).then(() => sql.query('DELETE FROM quiz_attempts WHERE user_id=$1 RETURNING id', [SOFIA])).then(r => r.rows.length)), 0);
    assert.equal(await tx('reunir_app', sql => sql.query("SELECT set_config('app.account_deletion',$1,true)", [SOFIA]).then(() => sql.query('DELETE FROM quiz_attempts WHERE user_id=$1 RETURNING id', [SOFIA])).then(r => r.rows.length)), 0);
    assert.equal(await tx('reunir_operator', sql => sql.query('DELETE FROM quiz_attempts WHERE user_id=$1 RETURNING id', [SOFIA]).then(r => r.rows.length)), 0);
    assert.equal(await count('SELECT count(*)::int AS n FROM quiz_attempts WHERE user_id=$1', [SOFIA]), 1);
});

test('without row-security bypass, an active owner erases one member’s answers and feedback notices, recording counts only', async () => {
    const revision = await count('SELECT revision::int AS n FROM organisations WHERE id=$1', [ORG]);
    const others = await count('SELECT count(*)::int AS n FROM quiz_attempts WHERE user_id<>$1', [SOFIA]);
    assert.deepEqual(await operator.eraseLearnerAnswers('code-black', DEMO_ADMIN, SOFIA, 'request 41', true), { attempts: 1, notifications: 1, applied: true });
    assert.equal(await count('SELECT count(*)::int AS n FROM quiz_attempts WHERE user_id=$1', [SOFIA]), 0);
    assert.equal(await count("SELECT count(*)::int AS n FROM notifications WHERE user_id=$1 AND title='Feedback on your knowledge check'", [SOFIA]), 0);
    assert.equal(await count('SELECT count(*)::int AS n FROM quiz_attempts WHERE user_id<>$1', [SOFIA]), others, 'other members keep their answers');
    assert.equal(await count('SELECT revision::int AS n FROM organisations WHERE id=$1', [ORG]), revision + 1);
    const audit = (await db.query<{ actor_id: string; object_id: string; metadata: Record<string, unknown> }>("SELECT actor_id,object_id,metadata FROM audit WHERE action='learner.answers.erased'")).rows;
    assert.deepEqual(audit, [{ actor_id: DEMO_ADMIN, object_id: SOFIA, metadata: { reference: 'request 41', attempts: 1, notifications: 1 } }]);
    assert(!JSON.stringify(audit).includes('Specific and observed'), 'the audit keeps no answer or feedback text');
    assert.deepEqual((await runtime.snapshot('code-black', SOFIA)).quizAttempts, []);
    assert.equal((await runtime.snapshot('code-black', DEMO_USER)).quizAttempts.length, 1);
});

test('unused cover uploads are listed for an owner and removed only while still unused', async () => {
    const insert = (id: string, purpose: string, status: string, age: string, cover = "NULL") => db.query(`INSERT INTO upload_intents(organization_id,id,user_id,object_key,content_type,size_bytes,original_name,created_at,status,purpose,completed_at,generation,cover_track_id) VALUES($1,$2,$3,$4,'image/png',10,'c',now() - interval '${age}',$5,$6,${status === 'ready' ? 'now()' : 'NULL'},${status === 'ready' ? "'1'" : 'NULL'},${cover})`, [ORG, id, DEMO_ADMIN, `k-${id}`, status, purpose]);
    await insert('old_cover', 'cover_image', 'ready', '2 hours', "'track_story'");
    await insert('shown_cover', 'cover_image', 'ready', '2 hours', "'track_story'");
    await insert('fresh_cover', 'cover_image', 'pending', '5 minutes', "'track_story'");
    await insert('bad_cover', 'cover_image', 'rejected', '5 minutes', "'track_story'");
    await insert('old_library', 'cover_library', 'ready', '2 hours');
    await db.query(`UPDATE tracks SET cover_image='{"fileId":"shown_cover","contentType":"image/png","sizeBytes":10,"focusX":50,"focusY":50}'::jsonb WHERE organization_id=$1 AND id='track_story'`, [ORG]);
    await assert.rejects(() => operator.staleCoverUploads('code-black', DEMO_USER), { code: 'OWNER_REQUIRED' });
    const stale = await operator.staleCoverUploads('code-black', DEMO_ADMIN);
    assert.deepEqual(stale.map(u => u.id).sort(), ['bad_cover', 'old_cover', 'old_library'], 'the shown cover, a fresh upload and listed library pictures stay');
    assert.deepEqual(stale.find(u => u.id === 'old_cover')!.objectKey, 'k-old_cover');
    // Between listing and removal the old cover is chosen again, so it must survive.
    await db.query(`UPDATE tracks SET cover_image='{"fileId":"old_cover","contentType":"image/png","sizeBytes":10,"focusX":50,"focusY":50}'::jsonb WHERE organization_id=$1 AND id='track_story'`, [ORG]);
    const removed = await operator.removeStaleCoverUploads('code-black', DEMO_ADMIN, ['bad_cover', 'old_cover', 'old_library', 'library_mountain']);
    assert.deepEqual(removed.sort(), ['bad_cover', 'old_library'], 'a library item ID is not an upload, and a cover chosen again is kept');
    assert.equal(await count("SELECT count(*)::int AS n FROM upload_intents WHERE id IN ('old_cover','shown_cover','fresh_cover','file_cover_mountain')"), 4, 'the cover chosen again, one not requested, a fresh upload and a listed picture all remain');
    assert.equal(await count("SELECT count(*)::int AS n FROM audit WHERE action='cover.uploads.pruned'"), 1);
});
