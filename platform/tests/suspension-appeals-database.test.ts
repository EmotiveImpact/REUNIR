import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { openDatabase, type Database, type SQL } from '../packages/db/src/connection';
import { migrate } from '../packages/db/src/migrate';
import { WorkspaceRepository, setContext } from '../packages/db/src/repository';
import { MessagingRepository } from '../packages/db/src/messaging';
import { grantRuntimeTables } from '../packages/db/src/runtime-role';
import { createSeed, DEMO_ADMIN, DEMO_USER } from '../packages/domain/src/seed';

// Alpha 58: appeals against a suspension, and a second look at a closed message report, through the restricted role.
const ORG = 'org_code_black', NORTH = 'org_studio_north', IDRIS = 'member_idris', SOFIA = 'member_sofia', MAYA = 'member_maya', JORDAN = 'member_jordan', THEO = 'member_theo';
let db: Database, repo: WorkspaceRepository, messaging: MessagingRepository;
const run = (user: string, cmd: unknown, slug = 'code-black') => repo.execute(slug, user, cmd, randomUUID(), 'suspension-db');
/** Statements as the restricted runtime role, with forced row security, as the API runs them. */
const asRuntime = <T>(organizationId: string, userId: string, fn: (sql: SQL) => Promise<T>) => db.transaction(async sql => {
    await sql.query('SET LOCAL ROLE reunir_app'); await setContext(sql, organizationId, userId);
    return fn(sql);
});
const memberId = (userId: string) => `${userId}`;
const status = (userId: string, cmd: 'suspended' | 'active', by: string) => run(by, { type: 'member.status', memberId: memberId(userId), status: cmd, reason: 'A note for the audit trail.' });
const membership = async (userId: string) => (await db.query<{ status: string; suspended_by: string | null; suspended_at: Date | null }>('SELECT status,suspended_by,suspended_at FROM members WHERE organization_id=$1 AND user_id=$2', [ORG, userId])).rows[0];
const appealRow = async (id: string) => (await db.query<{ status: string; decided_by: string | null; suspended_by: string | null }>('SELECT status,decided_by,suspended_by FROM suspension_appeals WHERE organization_id=$1 AND id=$2', [ORG, id])).rows[0];

before(async () => {
    db = await openDatabase('pglite:memory'); await migrate(db);
    const owner = new WorkspaceRepository(db); await owner.seed(createSeed()); await owner.seed(createSeed('studio-north'));
    await db.query('CREATE ROLE reunir_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS');
    await db.transaction(grantRuntimeTables);
    const scoped = Object.create(db) as Database;
    scoped.transaction = fn => db.transaction(async tx => { await tx.query('SET LOCAL ROLE reunir_app'); return fn(tx); });
    repo = new WorkspaceRepository(scoped);
    messaging = new MessagingRepository(repo);
    // Idris becomes an administrator, so one administrator can suspend and another decide.
    await run(DEMO_ADMIN, { type: 'member.role', memberId: IDRIS, role: 'admin' });
});
after(async () => db?.close());

test('the runtime role changes only an appeal’s decision, and never what a message report says', async () => {
    const can = async (table: string, privilege: string, column?: string) => (column
        ? await db.query<{ ok: boolean }>('SELECT has_column_privilege(\'reunir_app\',$1,$2,$3) AS ok', [table, column, privilege])
        : await db.query<{ ok: boolean }>('SELECT has_table_privilege(\'reunir_app\',$1,$2) AS ok', [table, privilege])).rows[0].ok;
    assert.equal(await can('suspension_appeals', 'UPDATE'), false, 'no table-wide UPDATE');
    for (const c of ['status', 'decided_by', 'decided_at', 'response']) assert.equal(await can('suspension_appeals', 'UPDATE', c), true, c);
    for (const c of ['reason', 'appellant_id', 'suspended_by', 'suspended_at', 'created_at']) assert.equal(await can('suspension_appeals', 'UPDATE', c), false, c);
    assert.equal(await can('message_reports', 'UPDATE'), false);
    for (const c of ['status', 'reviewed_by', 'second_look', 'first_reviewed_by']) assert.equal(await can('message_reports', 'UPDATE', c), true, c);
    for (const c of ['reason', 'reported_body', 'reporter_id', 'sender_id']) assert.equal(await can('message_reports', 'UPDATE', c), false, c);
    const rls = (await db.query<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>("SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE relname='suspension_appeals'")).rows[0];
    assert.deepEqual(rls, { relrowsecurity: true, relforcerowsecurity: true });
});

test('a suspended member appeals from their account, sees only their own standing, and an independent owner restores them', async () => {
    await status(DEMO_USER, 'suspended', IDRIS);
    const m = await membership(DEMO_USER);
    assert.deepEqual([m.status, m.suspended_by], ['suspended', IDRIS]);
    assert(m.suspended_at instanceof Date);
    await assert.rejects(() => repo.snapshot('code-black', DEMO_USER), { code: 'NOT_FOUND' });
    const standing = await repo.suspensions(DEMO_USER);
    assert.deepEqual(standing.map(s => [s.slug, s.canAppeal, s.decidable, s.appeals.length]), [['code-black', true, true, 0]], 'Studio North, where access is active, is not listed');
    assert.deepEqual(await repo.suspensions(SOFIA), []);
    await assert.rejects(() => repo.appealSuspension('studio-north', DEMO_USER, { reason: 'Not suspended here.' }, 'r1'), { code: 'NOT_FOUND' });
    await assert.rejects(() => repo.appealSuspension('code-black', SOFIA, { reason: 'Not suspended at all.' }, 'r1'), { code: 'NOT_FOUND' });
    await assert.rejects(() => repo.appealSuspension('code-black', DEMO_USER, { reason: '   ' }, 'r1'));
    const sent = await repo.appealSuspension('code-black', DEMO_USER, { reason: 'I have stopped selling in the community.' }, 'r1');
    assert.match(sent.message, /did not suspend you/);
    assert.deepEqual(await appealRow(sent.objectId), { status: 'pending', decided_by: null, suspended_by: IDRIS });
    assert.equal(sent.standing!.appeals[0].status, 'pending');
    await assert.rejects(() => repo.appealSuspension('code-black', DEMO_USER, { reason: 'Again.' }, 'r2'), { code: 'APPEAL_OPEN' });
    const notice = (await db.query<{ user_id: string; href: string }>("SELECT user_id,href FROM notifications WHERE organization_id=$1 AND title='An access appeal to decide'", [ORG])).rows;
    assert.deepEqual(notice, [{ user_id: DEMO_ADMIN, href: '/appeals' }], 'the owner who did not suspend is told; the suspender is not');

    // Row security: the appellant and active owners and administrators read it; other members and other communities do not.
    const read = (org: string, user: string) => asRuntime(org, user, sql => sql.query('SELECT id FROM suspension_appeals').then(r => r.rows.length));
    assert.equal(await read(ORG, DEMO_USER), 1);
    assert.equal(await read(ORG, DEMO_ADMIN), 1);
    assert.equal(await read(ORG, SOFIA), 0);
    assert.equal(await read(ORG, MAYA), 0, 'moderators do not read access appeals');
    assert.equal(await read(NORTH, DEMO_ADMIN), 0, 'never across communities');
    assert.equal((await repo.snapshot('code-black', SOFIA)).suspensionAppeals.length, 0);
    assert.equal((await repo.snapshot('code-black', DEMO_ADMIN)).suspensionAppeals.length, 1);
    // The appellant cannot decide their own appeal, and the suspender cannot decide it in SQL or through the rules.
    await assert.rejects(() => asRuntime(ORG, DEMO_USER, sql => sql.query("UPDATE suspension_appeals SET status='reversed',decided_by=$2,decided_at=now() WHERE id=$1", [sent.objectId, DEMO_USER])));
    await assert.rejects(() => asRuntime(ORG, IDRIS, sql => sql.query("UPDATE suspension_appeals SET status='reversed',decided_by=$2,decided_at=now(),response='x' WHERE id=$1", [sent.objectId, IDRIS])));
    await assert.rejects(() => run(IDRIS, { type: 'suspension.appeal.decide', appealId: sent.objectId, decision: 'reversed', response: 'Fine.' }), { code: 'SUSPENDER_CANNOT_DECIDE' });
    // Nobody inserts an appeal for someone else, or about a suspension that is not the one in force.
    await assert.rejects(() => asRuntime(ORG, SOFIA, sql => sql.query("INSERT INTO suspension_appeals(id,organization_id,created_at,appellant_id,suspended_by,suspended_at,reason) VALUES('forged',$1,now(),$2,$3,now(),'Forged.')", [ORG, DEMO_USER, IDRIS])));
    await assert.rejects(() => asRuntime(ORG, DEMO_USER, sql => sql.query("INSERT INTO suspension_appeals(id,organization_id,created_at,appellant_id,suspended_by,suspended_at,reason) VALUES('stale',$1,now(),$2,$3,now()-interval '1 day','Stale.')", [ORG, DEMO_USER, IDRIS])));

    await run(DEMO_ADMIN, { type: 'suspension.appeal.decide', appealId: sent.objectId, decision: 'reversed', response: 'Welcome back.' });
    assert.deepEqual(await appealRow(sent.objectId), { status: 'reversed', decided_by: DEMO_ADMIN, suspended_by: IDRIS });
    const restored = await membership(DEMO_USER);
    assert.deepEqual([restored.status, restored.suspended_by, restored.suspended_at], ['active', null, null]);
    const back = await repo.snapshot('code-black', DEMO_USER);
    assert.deepEqual(back.suspensionAppeals.map(a => [a.status, a.response]), [['reversed', 'Welcome back.']]);
    assert(back.notifications.some(n => n.title === 'Your access is restored'));
    assert.deepEqual(await repo.suspensions(DEMO_USER), []);
});

test('restoring access some other way closes the open appeal; withdrawing works while suspended', async () => {
    await status(SOFIA, 'suspended', IDRIS);
    const first = await repo.appealSuspension('code-black', SOFIA, { reason: 'Please look again.' }, 'r3');
    const withdrawn = await repo.withdrawSuspensionAppeal('code-black', SOFIA, first.objectId, 'r4');
    assert.equal((await appealRow(first.objectId)).status, 'withdrawn');
    assert.equal(withdrawn.standing!.canAppeal, true);
    await assert.rejects(() => repo.withdrawSuspensionAppeal('code-black', SOFIA, first.objectId, 'r5'), { code: 'NOT_PENDING' });
    const second = await repo.appealSuspension('code-black', SOFIA, { reason: 'Please look again, properly.' }, 'r6');
    await status(SOFIA, 'active', IDRIS);
    assert.deepEqual(await appealRow(second.objectId), { status: 'closed', decided_by: null, suspended_by: IDRIS });
    // A closed appeal cannot be closed while the member is still suspended: the policy needs the appellant active again.
    await status(SOFIA, 'suspended', IDRIS);
    const third = await repo.appealSuspension('code-black', SOFIA, { reason: 'Suspended again.' }, 'r7');
    assert.equal(await asRuntime(ORG, DEMO_ADMIN, sql => sql.query("UPDATE suspension_appeals SET status='closed',decided_at=now() WHERE id=$1 RETURNING id", [third.objectId]).then(r => r.rows.length)).catch(() => 0), 0);
    assert.equal((await appealRow(third.objectId)).status, 'pending');
});

test('a closed message report can be looked at again once, by another moderator, and the reporter is told each time', async () => {
    const thread = (await messaging.start('code-black', DEMO_USER, JORDAN)).id;
    const message = (await messaging.send('code-black', DEMO_USER, thread, 'Buy my camera kit, cheap.', 'second-look-1')).id;
    const report = (await messaging.report('code-black', JORDAN, thread, message, 'Selling in private messages.')).id;
    await assert.rejects(() => messaging.secondLook('code-black', JORDAN, report, 'Not closed yet.'), { code: 'REPORT_OPEN' });
    await messaging.resolve('code-black', MAYA, report);
    const notices = async () => (await db.query<{ title: string; href: string }>('SELECT title,href FROM notifications WHERE organization_id=$1 AND user_id=$2 AND href=$3 ORDER BY created_at,id', [ORG, JORDAN, '/appeals'])).rows.map(r => r.title);
    assert.deepEqual(await notices(), ['Your report was reviewed']);
    const own = await messaging.mine('code-black', JORDAN);
    assert.deepEqual(own.map(r => [r.status, r.secondLook]), [['resolved', null]]);
    assert.equal('reviewedBy' in own[0] || 'firstReviewedBy' in own[0] || 'reporterId' in own[0], false, 'the reporter never learns who reviewed it');
    assert.deepEqual(await messaging.mine('code-black', THEO), [], 'only your own reports');
    await assert.rejects(() => messaging.secondLook('code-black', THEO, report, 'Not my report.'), { code: 'NOT_FOUND' });
    await assert.rejects(() => messaging.secondLook('code-black', JORDAN, report, 'No'));
    await messaging.secondLook('code-black', JORDAN, report, 'It happened again in the same thread.');
    const queued = (await messaging.reports('code-black', DEMO_ADMIN)).find(r => r.id === report)!;
    assert.deepEqual([queued.status, queued.secondLook, queued.firstReviewedBy], ['open', 'It happened again in the same thread.', MAYA]);
    await assert.rejects(() => messaging.resolve('code-black', MAYA, report), { code: 'SECOND_LOOK_INDEPENDENT' });
    await messaging.resolve('code-black', DEMO_ADMIN, report);
    assert.deepEqual(await notices(), ['Your report was reviewed', 'Your report was looked at again']);
    await assert.rejects(() => messaging.secondLook('code-black', JORDAN, report, 'And once more, please.'), { code: 'SECOND_LOOK_USED' });
    // What was reported never changes, even for the reporter.
    await assert.rejects(() => asRuntime(ORG, JORDAN, sql => sql.query("UPDATE message_reports SET reported_body='Something else.' WHERE id=$1", [report])));
});
