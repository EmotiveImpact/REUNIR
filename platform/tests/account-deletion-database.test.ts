import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { openDatabase, type Database, type SQL } from '../packages/db/src/connection';
import { migrate } from '../packages/db/src/migrate';
import { WorkspaceRepository, setContext } from '../packages/db/src/repository';
import { MessagingRepository } from '../packages/db/src/messaging';
import { grantRuntimeTables } from '../packages/db/src/runtime-role';
import { createSeed, DEMO_ADMIN, DEMO_USER } from '../packages/domain/src/seed';
import { quizFingerprint } from '../packages/contracts/src/assessments';
import { FORMER_MEMBER } from '../packages/contracts/src/account';
import { MailQueue } from '../apps/api/src/mail';

const ORG = 'org_code_black', NORTH = 'org_studio_north', RIVERSIDE = 'org_riverside', SOFIA = 'member_sofia', IDRIS = 'member_idris';
const ALEX_EMAIL = 'alex@example.test';
let db: Database, runtime: WorkspaceRepository, messaging: MessagingRepository, mail: MailQueue;
let thread = '', privateFile = '', invitation = '', unjoined = '', othersInvitation = '';
/** Statements as the restricted runtime role, with forced row security, as the API runs them. */
const asRuntime = <T>(organizationId: string, userId: string, fn: (sql: SQL) => Promise<T>, mark?: string) => db.transaction(async sql => {
    await sql.query('SET LOCAL ROLE reunir_app'); await setContext(sql, organizationId, userId);
    if (mark !== undefined) await sql.query("SELECT set_config('app.account_deletion',$1,true)", [mark]);
    return fn(sql);
});
const count = async (query: string, params: unknown[] = []) => (await db.query<{ n: number }>(query, params)).rows[0].n;
const mine = (table: string, column = 'user_id', user = DEMO_USER) => count(`SELECT count(*)::int AS n FROM ${table} WHERE ${column}=$1`, [user]);
const run = (user: string, cmd: unknown, slug = 'code-black') => runtime.execute(slug, user, cmd, randomUUID(), 'account-deletion-test');
const PERSONAL = ['notification_preferences', 'member_goals', 'bookmarks', 'notifications', 'reactions', 'rsvps', 'enrolments', 'completions', 'path_enrolments', 'quiz_attempts', 'reputation', 'space_members', 'track_instructors', 'contribution_credits', 'message_receipts', 'member_blocks', 'command_receipts'];

async function person(id: string, name: string, email: string) {
    const now = new Date().toISOString();
    await db.query('INSERT INTO auth_user(id,name,email,email_verified,created_at,updated_at) VALUES($1,$2,$3,true,$4,$4)', [id, name, email, now]);
    await db.query("INSERT INTO auth_account(id,account_id,provider_id,user_id,password,created_at,updated_at) VALUES($1,$2,'credential',$2,'not-a-real-hash',$3,$3)", [randomUUID(), id, now]);
    for (const n of [1, 2]) await db.query("INSERT INTO auth_session(id,expires_at,token,created_at,updated_at,user_id) VALUES($1,now()+interval '1 day',$2,$3,$3,$4)", [randomUUID(), `${id}-session-${n}`, now, id]);
    await db.query("INSERT INTO auth_verification(id,identifier,value,expires_at,created_at,updated_at) VALUES($1,$2,$3,now()+interval '30 minutes',$4,$4)", [randomUUID(), `reset-password:${id}-token`, id, now]);
}

before(async () => {
    db = await openDatabase('pglite:memory'); await migrate(db);
    const owner = new WorkspaceRepository(db); await owner.seed(createSeed()); await owner.seed(createSeed('studio-north'));
    await db.query('CREATE ROLE reunir_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS');
    await db.transaction(grantRuntimeTables);
    const scoped = Object.create(db) as Database;
    scoped.transaction = fn => db.transaction(async tx => { await tx.query('SET LOCAL ROLE reunir_app'); return fn(tx); });
    runtime = new WorkspaceRepository(scoped); messaging = new MessagingRepository(runtime);
    mail = new MailQueue(db, 'account_deletion_test_secret_5a4b3c2d1e0f9a8b7c');
    await person(DEMO_USER, 'Alex Morgan', ALEX_EMAIL); await person(DEMO_ADMIN, 'Amina Okafor', 'amina@example.test'); await person(SOFIA, 'Sofia Chen', 'sofia@example.test');
    // Alex's activity through the API's own paths: an answer, a saved post, a reply, a post, private access, a grant,
    // proof on one claimed task, a conversation, a block and a private file. Alex is suspended in the second community.
    const seen = (await runtime.snapshot('code-black', DEMO_USER)).lessons.find(l => l.id === 'lesson_5')!.quiz!;
    await run(DEMO_USER, { type: 'quiz.attempt.submit', lessonId: 'lesson_5', fingerprint: quizFingerprint(seen), answers: [{ questionId: 'q5_feedback', optionIds: ['a'] }, { questionId: 'q5_essentials', optionIds: ['a'] }, { questionId: 'q5_outcome', text: 'useful' }] });
    await run(DEMO_USER, { type: 'post.bookmark', postId: 'post_welcome' });
    await run(DEMO_USER, { type: 'notification.preferences.save', muted: ['events'], digest: 'weekly' });
    const eventId = (await run(DEMO_ADMIN, { type: 'event.create', title: 'Open studio, November', summary: 'Bring what you are working on.', startsAt: new Date(Date.now() + 14 * 864e5).toISOString(), duration: 60, format: 'critique', location: 'Online' })).objectId!;
    await run(DEMO_USER, { type: 'event.rsvp', eventId });
    await run(DEMO_USER, { type: 'post.comment', postId: 'post_welcome', body: 'Thank you. Glad to be here.' });
    await run(DEMO_USER, { type: 'post.create', spaceId: 'space_general', kind: 'question', title: 'Who has tested a first-run flow?', body: 'Looking for two people to try a first version this week.' });
    await run(DEMO_ADMIN, { type: 'space.access', spaceId: 'space_studio', userId: DEMO_USER, granted: true });
    await run(DEMO_ADMIN, { type: 'track.instructor.add', trackId: 'track_product', userId: DEMO_USER });
    const version = async (id: string) => (await runtime.snapshot('code-black', DEMO_USER)).projectTasks.find(t => t.id === id)!.version;
    await run(DEMO_USER, { type: 'task.move', taskId: 'task_test', expectedVersion: await version('task_test'), workState: 'doing' });
    await run(DEMO_USER, { type: 'task.submit', taskId: 'task_test', expectedVersion: await version('task_test'), body: 'Observed three first-run sessions and recorded where people hesitated.' });
    // Idris credits Alex on his contribution, and Alex accepts.
    const idrisWork = (await run(IDRIS, { type: 'contribution.submit', projectId: 'project_common', title: 'Built the profile flow', body: 'Built and tested the discovery flow with Alex.' })).objectId!;
    const creditId = (await run(IDRIS, { type: 'credit.invite', contributionId: idrisWork, userId: DEMO_USER, role: 'co-author' })).objectId!;
    await run(DEMO_USER, { type: 'credit.respond', creditId, decision: 'accepted' });
    thread = (await messaging.start('code-black', DEMO_USER, DEMO_ADMIN)).id;
    await messaging.send('code-black', DEMO_USER, thread, 'Thanks for the welcome. I am working towards a first release.', 'alex-message-1');
    const reply = await messaging.send('code-black', DEMO_ADMIN, thread, 'Lovely. Tell me what would help.', 'amina-message-1');
    await messaging.read('code-black', DEMO_USER, thread, reply.id); await messaging.read('code-black', DEMO_ADMIN, thread, reply.id);
    await messaging.block('code-black', DEMO_USER, 'member_theo', true);
    privateFile = `organisations/${ORG}/members/${DEMO_USER}/cv.pdf`;
    await runtime.createUploadIntent('code-black', DEMO_USER, { id: randomUUID(), objectKey: privateFile, contentType: 'application/pdf', sizeBytes: 2048, originalName: 'cv.pdf' });
    invitation = randomUUID();
    await db.query("INSERT INTO invitations(id,organization_id,email,token_hash,created_by,expires_at,status,accepted_by,accepted_at) VALUES($1,$2,$3,$4,$5,now()+interval '7 days','accepted',$6,now())", [invitation, ORG, ALEX_EMAIL, 'a'.repeat(64), DEMO_ADMIN, DEMO_USER]);
    await mail.enqueue({ to: ALEX_EMAIL, subject: 'Your invitation to Code Black on REUNIR', text: 'Join your community.' }, db, ORG, invitation);
    // A pending invitation to a community Alex never joined, and one to someone else there: only Alex's goes.
    await db.query("INSERT INTO organisations(id,slug,name,tagline,accent,created_at) VALUES($1,'riverside','Riverside','A third community.','blue',now())", [RIVERSIDE]);
    unjoined = randomUUID(); othersInvitation = randomUUID();
    await db.query("INSERT INTO invitations(id,organization_id,email,token_hash,created_by,expires_at) VALUES($1,$2,$3,$4,$5,now()+interval '7 days'),($6,$2,'sofia@example.test',$7,$5,now()+interval '7 days')", [unjoined, RIVERSIDE, ALEX_EMAIL, 'b'.repeat(64), DEMO_ADMIN, othersInvitation, 'c'.repeat(64)]);
    await mail.enqueue({ to: ALEX_EMAIL, subject: 'Your invitation to Riverside on REUNIR', text: 'Join your community.' }, db, RIVERSIDE, unjoined);
    await mail.enqueue({ to: 'Alex@Example.test', subject: 'Reset your REUNIR password', text: 'A reset link.' });
    await mail.enqueue({ to: 'sofia@example.test', subject: 'Reset your REUNIR password', text: 'A reset link.' });
    await db.query("INSERT INTO request_limits(key,count,window_start) VALUES($1,3,now())", [`member:${DEMO_USER}`]);
    await db.query("UPDATE members SET status='suspended',suspended_by=$3,suspended_at=now() WHERE organization_id=$1 AND user_id=$2", [NORTH, DEMO_USER, DEMO_ADMIN]);
    // Alex appeals the suspension there (0049); the appeal is theirs, and goes with the account.
    await runtime.appealSuspension('studio-north', DEMO_USER, { reason: 'Please look again.' }, 'account-deletion-test');
});
after(async () => db?.close());

test('row security admits only the person’s own rows, and only while their own deletion is under way', async () => {
    const attempts = (user: string, mark?: string, who = DEMO_USER) => asRuntime(ORG, who, sql => sql.query('DELETE FROM quiz_attempts WHERE user_id=$1 RETURNING id', [user]).then(r => r.rows.length), mark);
    assert.equal(await attempts(DEMO_USER), 0, 'no mark, no deletion');
    assert.equal(await attempts(DEMO_USER, SOFIA), 0, 'the mark must name the acting person');
    assert.equal(await attempts(SOFIA, DEMO_USER), 0, 'never another member’s answers');
    assert.equal(await asRuntime(ORG, DEMO_USER, sql => sql.query('DELETE FROM track_instructors WHERE user_id=$1 RETURNING id', [IDRIS]).then(r => r.rows.length), DEMO_USER), 0, 'never another instructor’s grant');
    // The operator erasure policy from 0014 stays with the migration role, even for an owner naming a subject.
    assert.equal(await asRuntime(ORG, DEMO_ADMIN, async sql => { await sql.query("SELECT set_config('app.erasure_subject',$1,true)", [SOFIA]); return (await sql.query('DELETE FROM quiz_attempts WHERE user_id=$1 RETURNING id', [SOFIA])).rows.length; }), 0);
    assert.equal(await mine('quiz_attempts', 'user_id', SOFIA), 1);
    // With the mark, the person's own answers are admitted (rolled back here; the deletion below does it for real).
    await assert.rejects(() => asRuntime(ORG, DEMO_USER, async sql => { assert.equal((await sql.query('DELETE FROM quiz_attempts WHERE user_id=$1 RETURNING id', [DEMO_USER])).rows.length, 1); throw new Error('roll back'); }, DEMO_USER), /roll back/);
    assert.equal(await mine('quiz_attempts'), 1);
    // A suspended membership is visible to its own person (0049, so they can appeal it), and never someone else's.
    const memberships = (mark?: string) => asRuntime('', DEMO_USER, sql => sql.query<{ organization_id: string }>('SELECT organization_id FROM members WHERE user_id IN ($1,$2) ORDER BY organization_id', [DEMO_USER, SOFIA]).then(r => r.rows.map(x => x.organization_id)), mark);
    assert.deepEqual(await memberships(), [ORG, NORTH]);
    assert.deepEqual(await memberships(DEMO_USER), [ORG, NORTH]);
    // Where the person is suspended, their own claimed tasks are visible and releasable only with the mark (0018), and
    // never anyone else's tasks or an unassigned one that the transaction has not named.
    const tasks = (mark?: string, released = '') => asRuntime(NORTH, DEMO_USER, async sql => { await sql.query("SELECT set_config('app.released_tasks',$1,true)", [released]); return (await sql.query<{ id: string }>('SELECT id FROM project_tasks ORDER BY id')).rows.map(r => r.id); }, mark);
    assert.deepEqual(await tasks(), [], 'suspension closes the project work');
    assert.deepEqual(await tasks(SOFIA), [], 'the mark must name the acting person');
    assert.deepEqual(await tasks(DEMO_USER), ['task_notes', 'task_test']);
    assert.equal(await count("SELECT count(*)::int AS n FROM project_tasks WHERE organization_id=$1 AND assignee_id IS NULL AND NOT archived", [NORTH]) > 0, true, 'the fixture has unassigned tasks there');
    // Only the tasks the deletion itself names become readable once unassigned, so the release can complete; the update
    // policy still admits only the person's own claimed tasks.
    assert.deepEqual(await tasks(DEMO_USER, 'task_empty'), ['task_empty', 'task_notes', 'task_test']);
    await asRuntime(NORTH, DEMO_USER, async sql => { await sql.query("SELECT set_config('app.released_tasks','task_empty',true)"); await sql.query("UPDATE project_tasks SET title='Changed' WHERE id='task_empty'"); }, DEMO_USER);
    assert.equal(await count("SELECT count(*)::int AS n FROM project_tasks WHERE organization_id=$1 AND id='task_empty' AND title='Changed'", [NORTH]), 0, 'an unassigned task cannot be changed');
    await assert.rejects(() => asRuntime(NORTH, DEMO_USER, sql => sql.query("UPDATE project_tasks SET assignee_id=NULL,work_state='doing' WHERE id='task_notes'"), DEMO_USER), /row-level security/, 'released tasks go back to do');
    // Invitations to the person's own address in a community they never joined, only with the mark.
    const invitations = (mark?: string, who = DEMO_USER) => asRuntime('', who, sql => sql.query<{ id: string }>('SELECT id FROM invitations ORDER BY id').then(r => r.rows.map(x => x.id)), mark);
    assert.deepEqual(await invitations(), []);
    assert.deepEqual(await invitations(SOFIA), [], 'the mark must name the acting person');
    assert.deepEqual(await invitations(DEMO_USER), [invitation, unjoined].sort());
    assert.equal(await asRuntime('', SOFIA, sql => sql.query('DELETE FROM invitations WHERE id=$1 RETURNING id', [unjoined]).then(r => r.rows.length), SOFIA), 0, 'never someone else’s invitation');
});

test('an owner cannot delete their account, and nothing changes', async () => {
    await assert.rejects(() => runtime.deleteAccount(DEMO_ADMIN), { code: 'OWNER_CANNOT_DELETE', message: /You own Code Black and Studio North/ });
    assert.equal(await count('SELECT count(*)::int AS n FROM auth_user WHERE id=$1', [DEMO_ADMIN]), 1);
    assert.equal(await count("SELECT count(*)::int AS n FROM members WHERE user_id=$1 AND name='Amina Okafor' AND status='active'", [DEMO_ADMIN]), 2);
});

test('deleting an account scrubs every membership, keeps shared work as Former member and removes private records', async () => {
    const kept = { posts: await mine('posts', 'author_id'), comments: await mine('comments', 'author_id'), contributions: await mine('contributions'), team: await mine('project_members'), messages: await mine('messages', 'sender_id') };
    assert(Object.values(kept).every(n => n > 0), 'the fixture has shared work to keep');
    assert(await mine('quiz_attempts') && await mine('track_instructors') && await mine('member_blocks') && await mine('message_receipts'));
    const revisions = await db.query<{ id: string; revision: number }>('SELECT id,revision::int FROM organisations WHERE id<>$1 ORDER BY id', [RIVERSIDE]);
    const { summary, files } = await runtime.deleteAccount(DEMO_USER, (sql, email) => mail.forget(email, sql));
    assert.equal(summary.communities, 2);
    assert.deepEqual(files, [privateFile], 'the private file is returned for removal from storage after commit');
    assert.equal(summary.releasedTasks, 3, 'one where Alex is active, and both where Alex was suspended');
    assert.equal(summary.rewordedNotices, 4, 'the reply notice, the contribution notices to the owner and the project lead, and the accepted credit');
    assert.equal(summary.removed.contributionCredits, 1, 'the credit naming Alex goes with the account');
    assert.equal(summary.removed.suspensionAppeals, 1, 'the appeal against the suspension goes with the account');
    assert.equal(await mine('suspension_appeals', 'appellant_id'), 0);
    assert.equal(await count('SELECT count(*)::int AS n FROM members WHERE user_id=$1 AND (suspended_by IS NOT NULL OR suspended_at IS NOT NULL)', [DEMO_USER]), 0, 'who suspended them is not kept on the scrubbed membership');
    assert.equal(await count("SELECT count(*)::int AS n FROM contributions WHERE user_id=$1 AND title='Built the profile flow'", [IDRIS]), 1, 'Idris’s contribution stays');
    assert.deepEqual([summary.removed.quizAttempts, summary.removed.trackInstructors, summary.removed.privateFiles, summary.removed.invitations, summary.removed.queuedMail, summary.removed.sessions, summary.removed.signInTokens], [1, 1, 1, 2, 1, 2, 1]);
    // Every membership, the suspended one included, is the same scrubbed record.
    const members = await db.query('SELECT organization_id,name,headline,bio,skills,colour,avatar,role,status FROM members WHERE user_id=$1 ORDER BY organization_id', [DEMO_USER]);
    for (const [i, org] of [ORG, NORTH].entries()) assert.deepEqual(members.rows[i], { organization_id: org, name: FORMER_MEMBER, headline: '', bio: '', skills: [], colour: 'neutral', avatar: '', role: 'member', status: 'left' });
    // Shared work stays, attributed to the scrubbed membership.
    assert.deepEqual({ posts: await mine('posts', 'author_id'), comments: await mine('comments', 'author_id'), contributions: await mine('contributions'), team: await mine('project_members'), messages: await mine('messages', 'sender_id') }, kept);
    const tasks = await db.query<{ organization_id: string; id: string; assignee_id: string | null; work_state: string }>("SELECT organization_id,id,assignee_id,work_state FROM project_tasks WHERE id IN ('task_test','task_notes') ORDER BY organization_id,id");
    assert.deepEqual(tasks.rows, [
        { organization_id: ORG, id: 'task_notes', assignee_id: null, work_state: 'todo' }, { organization_id: ORG, id: 'task_test', assignee_id: DEMO_USER, work_state: 'doing' },
        // Suspension closes the project's work to them there, but their own deletion still hands the tasks back (0018).
        { organization_id: NORTH, id: 'task_notes', assignee_id: null, work_state: 'todo' }, { organization_id: NORTH, id: 'task_test', assignee_id: null, work_state: 'todo' }]);
    // Private records, learning and access are gone in both communities.
    for (const table of PERSONAL) assert.equal(await mine(table), 0, `${table} has nothing left`);
    assert.equal(await count("SELECT count(*)::int AS n FROM upload_intents WHERE user_id=$1 AND purpose='member'", [DEMO_USER]), 0);
    assert.equal(await count('SELECT count(*)::int AS n FROM invitations WHERE email=$1', [ALEX_EMAIL]), 0, 'in every community, joined or not');
    assert.equal(await count('SELECT count(*)::int AS n FROM invitations WHERE id=$1', [othersInvitation]), 1);
    // Sign-in, sessions, credentials, reset tokens, counters and queued mail to the address are gone; others' stay.
    for (const table of ['auth_user', 'auth_session', 'auth_account']) assert.equal(await count(`SELECT count(*)::int AS n FROM ${table} WHERE ${table === 'auth_user' ? 'id' : 'user_id'}=$1`, [DEMO_USER]), 0, table);
    assert.equal(await count('SELECT count(*)::int AS n FROM auth_verification WHERE value=$1', [DEMO_USER]), 0);
    assert.equal(await count('SELECT count(*)::int AS n FROM auth_verification WHERE value=$1', [SOFIA]), 1);
    assert.equal(await count('SELECT count(*)::int AS n FROM request_limits WHERE key=$1', [`member:${DEMO_USER}`]), 0);
    const outbox = (await db.query<{ payload: string }>("SELECT payload FROM email_outbox WHERE payload<>''")).rows.map(r => mail.open(r.payload).to);
    assert.deepEqual(outbox, ['sofia@example.test']);
    assert.equal(await count('SELECT count(*)::int AS n FROM auth_user'), 2, 'other accounts are untouched');
    // The conversation stays for the other person, who can read it but not write to a former member.
    const page = await messaging.messages('code-black', DEMO_ADMIN, thread);
    assert.deepEqual(page.items.map(m => m.senderId), [DEMO_USER, DEMO_ADMIN]);
    assert.equal(await count('SELECT count(*)::int AS n FROM message_receipts WHERE user_id=$1', [DEMO_ADMIN]), 1);
    await assert.rejects(() => messaging.send('code-black', DEMO_ADMIN, thread, 'Are you still there?', 'amina-message-2'), { message: 'This member is not available.' });
    // Other inboxes no longer carry the name; the audit trail records counts only; open screens refresh.
    const notices = (await db.query<{ user_id: string; body: string }>('SELECT user_id,body FROM notifications')).rows;
    assert(notices.some(n => n.user_id === DEMO_ADMIN && n.body === 'A former member replied to your post.'));
    assert(notices.some(n => n.user_id === IDRIS && n.body === 'A former member contributed to Common Ground.'));
    assert(!notices.some(n => n.body.includes('Alex')), 'no notice anywhere still carries the name');
    const audit = await db.query<{ organization_id: string; metadata: Record<string, unknown> }>("SELECT organization_id,metadata FROM audit WHERE action='member.account.deleted' AND actor_id=$1 ORDER BY organization_id", [DEMO_USER]);
    assert.deepEqual(audit.rows.map(r => r.organization_id), [ORG, NORTH]);
    assert(!JSON.stringify(audit.rows).includes('Alex') && !JSON.stringify(audit.rows).includes(ALEX_EMAIL));
    const after = await db.query<{ id: string; revision: number }>('SELECT id,revision::int FROM organisations WHERE id<>$1 ORDER BY id', [RIVERSIDE]);
    assert.deepEqual(after.rows.map(r => r.revision), revisions.rows.map(r => r.revision + 1));
    // Members see the kept record as Former member, so bylines still resolve; the directory can tell it apart.
    const seen = (await runtime.snapshot('code-black', SOFIA)).members.find(m => m.userId === DEMO_USER);
    assert.deepEqual([seen?.name, seen?.status], [FORMER_MEMBER, 'left']);
    assert.deepEqual(await runtime.memberships(DEMO_USER), []);
});

test('a repeated request finds nothing left to delete', async () => {
    await assert.rejects(() => runtime.deleteAccount(DEMO_USER), { code: 'NOT_FOUND' });
    await assert.rejects(() => runtime.snapshot('code-black', DEMO_USER), { code: 'NOT_FOUND' });
});
