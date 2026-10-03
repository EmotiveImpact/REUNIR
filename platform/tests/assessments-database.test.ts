import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { openDatabase, type Database, type SQL } from '../packages/db/src/connection';
import { migrate } from '../packages/db/src/migrate';
import { WorkspaceRepository, setContext } from '../packages/db/src/repository';
import { grantRuntimeTables } from '../packages/db/src/runtime-role';
import { createSeed, DEMO_ADMIN, DEMO_USER } from '../packages/domain/src/seed';
import { lessonContent } from '../packages/domain/src/authoring';
import { normaliseQuiz } from '../packages/domain/src/assessments';
import { quizFingerprint, type QuizAnswer } from '../packages/contracts/src/assessments';
import { seedBeforeProjectWork } from './helpers/legacy-fixture';

let db: Database, repo: WorkspaceRepository;
const ORG = 'org_code_black', NORTH = 'org_studio_north';
const exec = (cmd: unknown, user = DEMO_USER) => repo.execute('code-black', user, cmd, randomUUID(), 'assessments-db');
const as = <T>(user: string, org: string, fn: (tx: SQL) => Promise<T>) => db.transaction(async tx => { await tx.query('SET LOCAL ROLE reunir_app'); await setContext(tx, org, user); return fn(tx); });
const right: QuizAnswer[] = [
    { questionId: 'q5_feedback', optionIds: ['a'], text: '' },
    { questionId: 'q5_essentials', optionIds: ['a', 'b'], text: '' },
    { questionId: 'q5_outcome', optionIds: [], text: 'useful' },
];
const written: QuizAnswer[] = [{ questionId: 'q6_watch', optionIds: ['a'], text: '' }, { questionId: 'q6_change', optionIds: [], text: 'PRIVATE_WRITTEN_ANSWER: autosave the form.' }];
async function submit(lessonId: string, answers: QuizAnswer[], user = DEMO_USER) {
    const seen = (await repo.snapshot('code-black', user)).lessons.find(l => l.id === lessonId)!.quiz!;
    return exec({ type: 'quiz.attempt.submit', lessonId, fingerprint: quizFingerprint(seen), answers }, user);
}
const rows = (tx: SQL, sql = 'SELECT id,user_id,status FROM quiz_attempts ORDER BY id') => tx.query<{ id: string; user_id: string; status: string }>(sql).then(r => r.rows);
const fails = (promise: Promise<unknown>, pattern: RegExp) => assert.rejects(promise, (e: Error) => pattern.test(e.message));
let alexAttempt = '';

before(async () => {
    db = await openDatabase('pglite:memory'); await migrate(db);
    const owner = new WorkspaceRepository(db); await owner.seed(createSeed()); await owner.seed(createSeed('studio-north'));
    await db.query('CREATE ROLE reunir_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS');
    await db.transaction(grantRuntimeTables);
    const runtime = Object.create(db) as Database;
    runtime.transaction = fn => db.transaction(async tx => { await tx.query('SET LOCAL ROLE reunir_app'); return fn(tx); });
    repo = new WorkspaceRepository(runtime);
});
after(async () => db?.close());

test('0010 upgrade keeps lessons, drafts and history exactly as they were and adds no attempts', async () => {
    const old = await openDatabase('pglite:memory');
    try {
        await migrate(old, '0009'); await seedBeforeProjectWork(old);
        await old.query("INSERT INTO lesson_drafts VALUES('legacy_draft','org_code_black',now(),'track_product','lesson_5','Draft title','Draft summary','Draft body',5,'',2,1,false,'member_amina','member_amina',now(),NULL,NULL)");
        await old.query("INSERT INTO lesson_revisions VALUES('legacy_revision','org_code_black',now(),'track_product','lesson_5','legacy_draft','Old title','Old summary','Old body',5,'',1,'captured','member_amina',NULL,NULL)");
        const read = async (table: string) => (await old.query(`SELECT * FROM ${table} ORDER BY organization_id,id`)).rows;
        const before = { lessons: await read('lessons'), drafts: await read('lesson_drafts'), revisions: await read('lesson_revisions'), completions: await read('completions') };
        await migrate(old); await migrate(old);
        for (const [table, rows] of [['lessons', before.lessons], ['lesson_drafts', before.drafts], ['lesson_revisions', before.revisions]] as const) {
            const now = await read(table);
            assert.deepEqual(now.map(({ quiz, ...row }) => row), rows, table);
            assert(now.every(r => r.quiz === null), table);
        }
        assert.deepEqual(await read('completions'), before.completions);
        assert.equal((await old.query('SELECT count(*)::int AS n FROM quiz_attempts')).rows[0].n, 0);
        assert.equal((await old.query('SELECT version FROM schema_migrations')).rows.length, 21);
    } finally { await old.close(); }
});

test('the restricted runtime role records a scored attempt and a member snapshot carries no keys or other answers', async () => {
    const r = await submit('lesson_5', right);
    const attempt = r.workspace.quizAttempts.find(a => a.userId === DEMO_USER)!;
    alexAttempt = attempt.id;
    assert.deepEqual([attempt.status, attempt.score, attempt.maxScore, attempt.passed], ['scored', 4, 4, true]);
    const stored = (await db.query<{ status: string; score: number; quiz: unknown }>('SELECT status,score,quiz FROM quiz_attempts WHERE id=$1', [attempt.id])).rows[0];
    assert.deepEqual([stored.status, stored.score], ['scored', 4]);
    assert.deepEqual(normaliseQuiz(stored.quiz as never), normaliseQuiz(createSeed().lessons.find(l => l.id === 'lesson_5')!.quiz), 'the attempt keeps the quiz it answered');
    const member = await repo.snapshot('code-black', DEMO_USER);
    assert(!JSON.stringify(member.lessons).includes('acceptedAnswers'), 'lessons reach a member without answer keys');
    assert.deepEqual(member.quizAttempts.map(a => a.userId), [DEMO_USER]);
    assert(member.quizAttempts[0].quiz.questions[2].acceptedAnswers, 'their own passed attempt is unlocked under the reveal rule');
    assert(!JSON.stringify(member).includes('Three of the five steps were lost'), 'another learner’s written answer stays private');
    assert(!JSON.stringify(await repo.snapshot('code-black', DEMO_ADMIN)).includes('Three of the five steps were lost'), 'the snapshot leaves it to the review queue');
    const queue = [...(await repo.page('code-black', DEMO_ADMIN, 'review-waiting')).items, ...(await repo.page('code-black', DEMO_ADMIN, 'review-scored')).items];
    assert(JSON.stringify(queue).includes('Three of the five steps were lost'), 'administrators can review it');
});

test('members read only their own attempts; administrators read their own community’s', async () => {
    await as(DEMO_USER, ORG, async tx => assert.deepEqual((await rows(tx)).map(r => r.user_id), [DEMO_USER]));
    await as('member_sofia', ORG, async tx => assert.deepEqual((await rows(tx)).map(r => r.user_id), ['member_sofia']));
    await as('member_maya', ORG, async tx => assert.equal((await rows(tx)).length, 0, 'moderators are not reviewers'));
    await as(DEMO_ADMIN, ORG, async tx => assert.deepEqual((await rows(tx)).map(r => r.user_id).sort(), [DEMO_USER, 'member_sofia']));
    await as(DEMO_ADMIN, NORTH, async tx => assert.equal((await rows(tx)).length, 0, 'another community sees nothing'));
    assert.equal((await repo.snapshot('studio-north', DEMO_ADMIN)).quizAttempts.length, 0);
});

test('attempts are evidence: the runtime role cannot rewrite answers or the basis of scores, nor delete them', async () => {
    for (const change of ["answers='[]'", "quiz='{}'", 'max_score=1', "user_id='member_sofia'", 'attempt_number=9', "lesson_id='lesson_4'", 'created_at=now()'])
        await fails(as(DEMO_ADMIN, ORG, tx => tx.query(`UPDATE quiz_attempts SET ${change} WHERE id='attempt_sofia'`)), /permission denied/);
    // Row security admits a delete only of the acting member's own attempts while they delete their own account (0015).
    assert.equal(await as(DEMO_ADMIN, ORG, tx => tx.query("DELETE FROM quiz_attempts WHERE id='attempt_sofia' RETURNING id").then(r => r.rows.length)), 0);
    assert.equal(await as(DEMO_USER, ORG, tx => tx.query('DELETE FROM quiz_attempts WHERE id=$1 RETURNING id', [alexAttempt]).then(r => r.rows.length)), 0);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM quiz_attempts WHERE id=$1', [alexAttempt])).rows[0].n, 1);
    assert.equal((await db.query("SELECT count(*)::int AS n FROM quiz_attempts WHERE id='attempt_sofia'")).rows[0].n, 1);
});

test('a member inserts only an unreviewed attempt of their own while active', async () => {
    const insert = (tx: SQL, values: { id: string; user: string; status?: string; reviewer?: string | null; feedback?: string }) => tx.query(
        "INSERT INTO quiz_attempts (id,organization_id,created_at,lesson_id,track_id,user_id,attempt_number,quiz,answers,results,score,max_score,status,passed,feedback,reviewer_id,reviewed_at,version) VALUES ($1,'org_code_black',now(),'lesson_6','track_product',$2,7,'{}','[]','[]',0,4,$3,NULL,$4,$5,CASE WHEN $5::text IS NULL THEN NULL ELSE now() END,1)",
        [values.id, values.user, values.status ?? 'awaiting_review', values.feedback ?? '', values.reviewer ?? null]);
    await fails(as(DEMO_USER, ORG, tx => insert(tx, { id: 'forged_other', user: 'member_sofia' })), /row-level security/);
    await fails(as(DEMO_USER, ORG, tx => insert(tx, { id: 'forged_review', user: DEMO_USER, status: 'reviewed', reviewer: DEMO_ADMIN, feedback: 'Self-awarded' })), /row-level security/);
    await fails(as(DEMO_USER, NORTH, tx => insert(tx, { id: 'forged_tenant', user: DEMO_USER })), /row-level security/);
    await fails(as(DEMO_USER, ORG, tx => tx.query("INSERT INTO quiz_attempts (id,organization_id,created_at,lesson_id,track_id,user_id,attempt_number,quiz,answers,results,score,max_score,status,passed,feedback,reviewer_id,reviewed_at,version) VALUES ('forged_version','org_code_black',now(),'lesson_6','track_product',$1,8,'{}','[]','[]',0,4,'awaiting_review',NULL,'',NULL,NULL,2)", [DEMO_USER])), /row-level security/);
    await db.query("UPDATE members SET status='suspended' WHERE organization_id=$1 AND user_id=$2", [ORG, DEMO_USER]);
    try { await fails(as(DEMO_USER, ORG, tx => insert(tx, { id: 'forged_inactive', user: DEMO_USER })), /row-level security/); }
    finally { await db.query("UPDATE members SET status='active' WHERE organization_id=$1 AND user_id=$2", [ORG, DEMO_USER]); }
    assert.equal((await db.query("SELECT count(*)::int AS n FROM quiz_attempts WHERE id LIKE 'forged_%'")).rows[0].n, 0);
});

test('only an active owner or administrator who is not the learner can write a review, attributed to themselves', async () => {
    const review = (tx: SQL, reviewer = DEMO_ADMIN, id = 'attempt_sofia') => tx.query("UPDATE quiz_attempts SET status='reviewed',feedback='Forged',reviewer_id=$1,reviewed_at=now(),version=version+1 WHERE id=$2 RETURNING id", [reviewer, id]).then(r => r.rows.length);
    const unchanged = async () => assert.equal((await db.query<{ status: string }>("SELECT status FROM quiz_attempts WHERE id='attempt_sofia'")).rows[0].status, 'awaiting_review');
    assert.equal(await as(DEMO_USER, ORG, tx => review(tx, DEMO_USER)), 0, 'a member’s update matches no rows'); await unchanged();
    assert.equal(await as('member_maya', ORG, tx => review(tx, 'member_maya')), 0, 'a moderator’s update matches no rows'); await unchanged();
    assert.equal(await as(DEMO_ADMIN, NORTH, tx => review(tx)), 0, 'another community’s administrator matches no rows'); await unchanged();
    await fails(as(DEMO_ADMIN, ORG, tx => review(tx, 'member_maya')), /row-level security/);
    await fails(as(DEMO_ADMIN, ORG, tx => tx.query("UPDATE quiz_attempts SET status='reviewed',feedback='Skipped ahead',reviewer_id=$1,reviewed_at=now(),version=5 WHERE id='attempt_sofia'", [DEMO_ADMIN])), /row-level security/);
    await fails(as(DEMO_ADMIN, ORG, tx => tx.query("UPDATE quiz_attempts SET score=4,version=2 WHERE id='attempt_sofia'")), /row-level security/);
    await unchanged();
    await db.query("UPDATE members SET status='suspended' WHERE organization_id=$1 AND user_id=$2", [ORG, DEMO_ADMIN]);
    try { assert.equal(await as(DEMO_ADMIN, ORG, tx => review(tx)), 0, 'a suspended administrator matches no rows'); }
    finally { await db.query("UPDATE members SET status='active' WHERE organization_id=$1 AND user_id=$2", [ORG, DEMO_ADMIN]); }
    await unchanged();
    await db.query("UPDATE members SET role='member' WHERE organization_id=$1 AND user_id=$2", [ORG, DEMO_ADMIN]);
    try { assert.equal(await as(DEMO_ADMIN, ORG, tx => review(tx)), 0, 'a demoted administrator matches no rows'); }
    finally { await db.query("UPDATE members SET role='owner' WHERE organization_id=$1 AND user_id=$2", [ORG, DEMO_ADMIN]); }
    await unchanged();
    // The same statement succeeds for the active owner, so every zero above is the policy at work. Roll it back.
    await assert.rejects(db.transaction(async tx => {
        await tx.query('SET LOCAL ROLE reunir_app'); await setContext(tx, ORG, DEMO_ADMIN);
        assert.equal(await review(tx), 1);
        throw new Error('rollback');
    }), /rollback/);
    await unchanged();
});

test('an administrator reviews through the repository; their own attempt stays out of reach', async () => {
    const r = await exec({ type: 'quiz.attempt.review', attemptId: 'attempt_sofia', expectedVersion: 1, marks: [{ questionId: 'q6_change', points: 2 }], feedback: 'Specific and observed. Say how you would test the change.' }, DEMO_ADMIN);
    assert.equal((await repo.page('code-black', DEMO_ADMIN, 'review-reviewed')).items.find(a => a.id === 'attempt_sofia')!.status, 'reviewed');
    assert.equal(r.workspace.summary!.review.waiting, 0);
    const stored = (await db.query<{ status: string; score: number; reviewer_id: string; version: number; answers: QuizAnswer[] }>("SELECT status,score,reviewer_id,version,answers FROM quiz_attempts WHERE id='attempt_sofia'")).rows[0];
    assert.deepEqual([stored.status, stored.score, stored.reviewer_id, stored.version], ['reviewed', 3, DEMO_ADMIN, 2]);
    assert.match(stored.answers[1].text, /^They looked for a way to save/);
    const sofia = await repo.snapshot('code-black', 'member_sofia');
    assert.equal(sofia.quizAttempts[0].feedback, 'Specific and observed. Say how you would test the change.');
    assert(sofia.notifications.some(n => n.title === 'Feedback on your knowledge check' && n.href === '/learn/track_product/lesson_6'));
    await assert.rejects(exec({ type: 'quiz.attempt.review', attemptId: 'attempt_sofia', expectedVersion: 1, marks: [{ questionId: 'q6_change', points: 3 }], feedback: 'Again' }, DEMO_ADMIN), (e: { code?: string }) => e.code === 'STALE_ATTEMPT');
    // The row policy allows exactly one review: SQL that bypasses the domain matches no reviewed row.
    for (const set of ["feedback='Rewritten',reviewer_id=$1,reviewed_at=now(),version=3", "score=0,results='[]',reviewer_id=$1,version=2", "status='awaiting_review',reviewer_id=NULL,reviewed_at=NULL,feedback='',version=1"])
        assert.equal((await as(DEMO_ADMIN, ORG, tx => tx.query(`UPDATE quiz_attempts SET ${set} WHERE id='attempt_sofia' RETURNING id`, set.includes('$1') ? [DEMO_ADMIN] : []))).rows.length, 0, set);
    assert.deepEqual((await db.query("SELECT score,feedback,version FROM quiz_attempts WHERE id='attempt_sofia'")).rows, [{ score: 3, feedback: 'Specific and observed. Say how you would test the change.', version: 2 }]);
    await exec({ type: 'track.enrol', trackId: 'track_product' }, DEMO_ADMIN);
    const own = (await submit('lesson_6', written, DEMO_ADMIN)).workspace.quizAttempts.find(a => a.userId === DEMO_ADMIN)!;
    await assert.rejects(exec({ type: 'quiz.attempt.review', attemptId: own.id, expectedVersion: 1, marks: [{ questionId: 'q6_change', points: 3 }], feedback: 'Mine' }, DEMO_ADMIN), (e: { code?: string }) => e.code === 'SELF_REVIEW');
    assert.equal((await as(DEMO_ADMIN, ORG, tx => tx.query("UPDATE quiz_attempts SET status='reviewed',feedback='Mine',reviewer_id=$1,reviewed_at=now() WHERE id=$2 RETURNING id", [DEMO_ADMIN, own.id]))).rows.length, 0, 'the policy refuses self-review too');
    const admins = (await db.query<{ user_id: string }>("SELECT user_id FROM notifications WHERE organization_id=$1 AND title='A knowledge check needs feedback'", [ORG])).rows.map(r => r.user_id);
    assert(!admins.includes(DEMO_ADMIN), 'nobody is told to review their own answers');
});

test('knowledge checks follow draft, publication and restore through SQL without reaching members early', async () => {
    let r = await exec({ type: 'lesson.draft.create', trackId: 'track_product', lessonId: 'lesson_5' }, DEMO_ADMIN);
    let d = r.workspace.lessonDrafts.find(x => x.lessonId === 'lesson_5')!;
    const quiz = normaliseQuiz(d.quiz)!;
    quiz.questions.push({ id: 'q5_private', kind: 'written', prompt: 'PRIVATE_DRAFT_QUESTION', points: 2, options: [], acceptedAnswers: [], explanation: '' });
    r = await exec({ type: 'lesson.draft.save', draftId: d.id, expectedVersion: d.version, ...lessonContent(d), quiz }, DEMO_ADMIN);
    d = r.workspace.lessonDrafts.find(x => x.id === d.id)!;
    assert(!JSON.stringify(await repo.snapshot('code-black', DEMO_USER)).includes('PRIVATE_DRAFT_QUESTION'));
    await as(DEMO_USER, ORG, async tx => assert.equal((await tx.query('SELECT quiz FROM lesson_drafts')).rows.length, 0));
    r = await exec({ type: 'lesson.draft.publish', draftId: d.id, expectedVersion: d.version }, DEMO_ADMIN);
    assert.equal((await db.query<{ n: number }>("SELECT jsonb_array_length(quiz->'questions') AS n FROM lessons WHERE id='lesson_5' AND organization_id=$1", [ORG])).rows[0].n, 4);
    const revisions = (await db.query<{ kind: string; n: number | null }>("SELECT kind,jsonb_array_length(quiz->'questions') AS n FROM lesson_revisions WHERE lesson_id='lesson_5' ORDER BY sequence")).rows;
    assert.deepEqual(revisions.map(x => [x.kind, x.n]), [['captured', 3], ['published', 4]]);
    await fails(as(DEMO_ADMIN, ORG, tx => tx.query("UPDATE lesson_revisions SET quiz=NULL WHERE lesson_id='lesson_5'")), /permission denied/);
    const seen = (await repo.snapshot('code-black', DEMO_USER)).lessons.find(l => l.id === 'lesson_5')!.quiz!;
    assert.equal(seen.questions.at(-1)!.prompt, 'PRIVATE_DRAFT_QUESTION');
    assert(seen.questions.every(q => q.acceptedAnswers === undefined && q.options.every(o => o.correct === undefined)));
    // The earlier attempt keeps the three-question quiz it answered.
    const kept = (await db.query<{ n: number }>("SELECT jsonb_array_length(quiz->'questions') AS n FROM quiz_attempts WHERE id=$1", [alexAttempt])).rows[0];
    assert.equal(kept.n, 3);
});
