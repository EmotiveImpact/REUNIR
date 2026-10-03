import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { openDatabase, type Database, type SQL } from '../packages/db/src/connection';
import { migrate } from '../packages/db/src/migrate';
import { WorkspaceRepository, setContext } from '../packages/db/src/repository';
import { grantRuntimeTables } from '../packages/db/src/runtime-role';
import { createSeed, DEMO_ADMIN, DEMO_USER } from '../packages/domain/src/seed';

const ORG = 'org_code_black', NORTH = 'org_studio_north', MAYA = 'member_maya', NIA = 'member_nia', JORDAN = 'member_jordan';
let db: Database, repo: WorkspaceRepository;
const run = (user: string, cmd: unknown, slug = 'code-black') => repo.execute(slug, user, cmd, randomUUID(), 'appeals-db');
/** Statements as the restricted runtime role, with forced row security, as the API runs them. */
const asRuntime = <T>(organizationId: string, userId: string, fn: (sql: SQL) => Promise<T>, mark?: string) => db.transaction(async sql => {
    await sql.query('SET LOCAL ROLE reunir_app'); await setContext(sql, organizationId, userId);
    if (mark !== undefined) await sql.query("SELECT set_config('app.account_deletion',$1,true)", [mark]);
    return fn(sql);
});
const appeals = (organizationId: string, userId: string) => asRuntime(organizationId, userId, sql => sql.query<{ id: string }>('SELECT id FROM moderation_appeals'));
const row = async (id: string) => (await db.query<{ status: string; decided_by: string | null; response: string; reason: string }>('SELECT status,decided_by,response,reason FROM moderation_appeals WHERE organization_id=$1 AND id=$2', [ORG, id])).rows[0];

before(async () => {
    db = await openDatabase('pglite:memory'); await migrate(db);
    const owner = new WorkspaceRepository(db); await owner.seed(createSeed()); await owner.seed(createSeed('studio-north'));
    await db.query('CREATE ROLE reunir_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS');
    await db.transaction(grantRuntimeTables);
    const scoped = Object.create(db) as Database;
    scoped.transaction = fn => db.transaction(async tx => { await tx.query('SET LOCAL ROLE reunir_app'); return fn(tx); });
    repo = new WorkspaceRepository(scoped);
});
after(async () => db?.close());

test('the runtime role may change only the decision fields of an appeal', async () => {
    const can = async (privilege: string, column?: string) => (column
        ? await db.query<{ ok: boolean }>("SELECT has_column_privilege('reunir_app','moderation_appeals',$1,$2) AS ok", [column, privilege])
        : await db.query<{ ok: boolean }>("SELECT has_table_privilege('reunir_app','moderation_appeals',$1) AS ok", [privilege])).rows[0].ok;
    for (const p of ['SELECT', 'INSERT', 'DELETE']) assert.equal(await can(p), true, p);
    assert.equal(await can('UPDATE'), false, 'no table-wide UPDATE');
    for (const c of ['status', 'decided_by', 'decided_at', 'response']) assert.equal(await can('UPDATE', c), true, c);
    for (const c of ['reason', 'appellant_id', 'subject_id', 'subject', 'created_at', 'organization_id']) assert.equal(await can('UPDATE', c), false, c);
});

test('hiding, appealing and reversing persist through the restricted role, with who moderated and when', async () => {
    await run(MAYA, { type: 'post.moderate', postId: 'post_win', hidden: true });
    const hidden = (await db.query<{ hidden: boolean; moderated_by: string; moderated_at: Date }>("SELECT hidden,moderated_by,moderated_at FROM posts WHERE organization_id=$1 AND id='post_win'", [ORG])).rows[0];
    assert.deepEqual([hidden.hidden, hidden.moderated_by], [true, MAYA]);
    assert(hidden.moderated_at instanceof Date);
    assert((await repo.snapshot('code-black', NIA)).posts.some(p => p.id === 'post_win' && p.hidden), 'the author still sees the hidden post');
    assert(!(await repo.snapshot('code-black', JORDAN)).posts.some(p => p.id === 'post_win'), 'other members do not');

    const r = await run(NIA, { type: 'moderation.appeal', postId: 'post_win', reason: 'This was a celebration, not an advert.' });
    const id = r.objectId!;
    assert.deepEqual(await row(id), { status: 'pending', decided_by: null, response: '', reason: 'This was a celebration, not an advert.' });
    await assert.rejects(() => run(NIA, { type: 'moderation.appeal', postId: 'post_win', reason: 'Again.' }), /already waiting/);
    assert.equal((await repo.snapshot('code-black', NIA)).moderationAppeals.length, 1);
    assert.equal((await repo.snapshot('code-black', DEMO_ADMIN)).moderationAppeals.length, 1);
    assert.equal((await repo.snapshot('code-black', MAYA)).moderationAppeals.length, 0, 'the moderator does not read appeals');
    assert.equal((await repo.snapshot('code-black', JORDAN)).moderationAppeals.length, 0);
    const notice = (await db.query<{ title: string; href: string }>("SELECT title,href FROM notifications WHERE organization_id=$1 AND user_id=$2 ORDER BY created_at DESC,id DESC LIMIT 1", [ORG, DEMO_ADMIN])).rows[0];
    assert.deepEqual(notice, { title: 'An appeal to decide', href: '/appeals' });

    await assert.rejects(() => run(MAYA, { type: 'moderation.appeal.decide', appealId: id, decision: 'reversed', response: 'Mine to decide?' }), /not available/);
    await run(DEMO_ADMIN, { type: 'moderation.appeal.decide', appealId: id, decision: 'reversed', response: 'Restored. Celebrations are welcome.' });
    assert.deepEqual(await row(id), { status: 'reversed', decided_by: DEMO_ADMIN, response: 'Restored. Celebrations are welcome.', reason: 'This was a celebration, not an advert.' });
    assert(!(await db.query("SELECT hidden FROM posts WHERE organization_id=$1 AND id='post_win'", [ORG])).rows[0].hidden);
    assert((await repo.snapshot('code-black', JORDAN)).posts.some(p => p.id === 'post_win'), 'members see it again');
    const actions = (await db.query<{ action: string }>("SELECT action FROM audit WHERE organization_id=$1 AND (action LIKE 'moderation.appeal%' OR action='post.restored')", [ORG])).rows.map(x => x.action).sort();
    assert.deepEqual(actions, ['moderation.appeal', 'moderation.appeal.reversed', 'post.restored'], 'entries made in one command share a time, so they are compared as a set');
});

test('row security: appellant and owners or administrators read; nobody else, and no other community', async () => {
    const r = await run(DEMO_USER, { type: 'moderation.appeal', postId: 'post_hidden_alex', reason: 'A one-off post to people I know.' });
    const id = r.objectId!;
    assert((await appeals(ORG, DEMO_USER)).rows.some(x => x.id === id));
    assert((await appeals(ORG, DEMO_ADMIN)).rows.some(x => x.id === id));
    assert.equal((await appeals(ORG, MAYA)).rows.length, 0);
    assert.equal((await appeals(ORG, JORDAN)).rows.length, 0);
    assert.equal((await appeals(NORTH, DEMO_USER)).rows.length, 0, 'another community sees none');
    assert.equal((await appeals(NORTH, DEMO_ADMIN)).rows.length, 0);
    assert.equal((await db.transaction(async sql => { await sql.query('SET LOCAL ROLE reunir_app'); return sql.query('SELECT id FROM moderation_appeals'); })).rows.length, 0, 'no context, no rows');
    assert.equal((await repo.snapshot('studio-north', DEMO_ADMIN)).moderationAppeals.length, 0);

    // Forged inserts: for someone else, for a visible post, already decided, or a second open appeal.
    const insert = (user: string, values: { id: string; post: string; appellant: string; status?: string; decidedBy?: string | null }) => asRuntime(ORG, user, sql => sql.query(
        "INSERT INTO moderation_appeals(id,organization_id,created_at,subject,subject_id,appellant_id,reason,status,decided_by,decided_at,response) VALUES($1,$2,now(),'post',$3,$4,'Forged',$5,$6,$7,'')",
        [values.id, ORG, values.post, values.appellant, values.status ?? 'pending', values.decidedBy ?? null, values.status && values.status !== 'pending' ? new Date().toISOString() : null]));
    await assert.rejects(() => insert(JORDAN, { id: 'forged_other', post: 'post_hidden_alex', appellant: DEMO_USER }));
    await assert.rejects(() => insert(JORDAN, { id: 'forged_visible', post: 'post_common', appellant: JORDAN }));
    await assert.rejects(() => insert('member_idris', { id: 'forged_visible_own', post: 'post_common', appellant: 'member_idris' }));
    await assert.rejects(() => insert(DEMO_USER, { id: 'forged_decided', post: 'post_hidden_alex', appellant: DEMO_USER, status: 'reversed', decidedBy: DEMO_ADMIN }));
    await assert.rejects(() => db.query("INSERT INTO moderation_appeals(id,organization_id,created_at,subject,subject_id,appellant_id,reason,status) VALUES('second_open',$1,now(),'post','post_hidden_alex',$2,'Twice','pending')", [ORG, DEMO_USER]), 'one open appeal per item, even for the migration role');

    // Updates: a moderator or member changes nothing; the appellant cannot decide; nobody rewrites the reason.
    await asRuntime(ORG, MAYA, sql => sql.query("UPDATE moderation_appeals SET status='reversed',decided_by=$2,decided_at=now() WHERE id=$1", [id, MAYA]));
    await asRuntime(ORG, JORDAN, sql => sql.query("UPDATE moderation_appeals SET status='withdrawn',decided_at=now() WHERE id=$1", [id]));
    assert.equal((await row(id)).status, 'pending');
    await assert.rejects(() => asRuntime(ORG, DEMO_USER, sql => sql.query("UPDATE moderation_appeals SET status='reversed',decided_by=$2,decided_at=now() WHERE id=$1", [id, DEMO_USER])));
    await assert.rejects(() => asRuntime(ORG, DEMO_ADMIN, sql => sql.query("UPDATE moderation_appeals SET reason='Rewritten' WHERE id=$1", [id])), /permission denied/);
    // Deleting is refused outside the appellant's own account deletion.
    await asRuntime(ORG, DEMO_ADMIN, sql => sql.query('DELETE FROM moderation_appeals WHERE id=$1', [id]));
    await asRuntime(ORG, DEMO_USER, sql => sql.query('DELETE FROM moderation_appeals WHERE id=$1', [id]));
    assert.equal((await row(id)).status, 'pending');
    await run(DEMO_USER, { type: 'moderation.appeal.withdraw', appealId: id });
    assert.equal((await row(id)).status, 'withdrawn');
});

test('the moderator cannot decide at the database either, and a suspended member cannot appeal', async () => {
    // Amina hides Jordan's post herself, so she is the moderator. She is the only administrator, so the appeal waits.
    await db.query("INSERT INTO posts(id,organization_id,created_at,space_id,author_id,kind,title,body,pinned,hidden,cover) VALUES('post_jordan_test',$1,now(),'space_general',$2,'update','A test post','Fictional.',false,false,'')", [ORG, JORDAN]);
    await run(DEMO_ADMIN, { type: 'post.moderate', postId: 'post_jordan_test', hidden: true });
    const r = await run(JORDAN, { type: 'moderation.appeal', postId: 'post_jordan_test', reason: 'Please look again.' });
    assert.match(r.message, /Nobody can decide it yet/);
    await assert.rejects(() => run(DEMO_ADMIN, { type: 'moderation.appeal.decide', appealId: r.objectId!, decision: 'reversed', response: 'Restoring.' }), /You hid this post/);
    await asRuntime(ORG, DEMO_ADMIN, sql => sql.query("UPDATE moderation_appeals SET status='reversed',decided_by=$2,decided_at=now(),response='Direct' WHERE id=$1", [r.objectId, DEMO_ADMIN]));
    assert.equal((await row(r.objectId!)).status, 'pending', 'row security admits no decision by the moderator');

    const sofia = (await db.query<{ id: string }>("SELECT id FROM members WHERE organization_id=$1 AND user_id='member_sofia'", [ORG])).rows[0].id;
    await db.query("INSERT INTO posts(id,organization_id,created_at,space_id,author_id,kind,title,body,pinned,hidden,cover,moderated_by,moderated_at) VALUES('post_sofia_hidden',$1,now(),'space_general','member_sofia','update','Hidden','Fictional.',false,true,'',$2,now())", [ORG, MAYA]);
    await run(DEMO_ADMIN, { type: 'member.status', memberId: sofia, status: 'suspended', reason: 'A reviewed test case.' });
    await assert.rejects(() => run('member_sofia', { type: 'moderation.appeal', postId: 'post_sofia_hidden', reason: 'Suspended.' }));
    await assert.rejects(() => asRuntime(ORG, 'member_sofia', sql => sql.query("INSERT INTO moderation_appeals(id,organization_id,created_at,subject,subject_id,appellant_id,reason) VALUES('suspended_appeal',$1,now(),'post','post_sofia_hidden','member_sofia','Suspended')", [ORG])));
    await run(DEMO_ADMIN, { type: 'member.status', memberId: sofia, status: 'active', reason: 'Restored after the test.' });
});

test('deleting the appellant’s account removes their appeals and nobody else’s', async () => {
    const now = new Date().toISOString();
    await db.query('INSERT INTO auth_user(id,name,email,email_verified,created_at,updated_at) VALUES($1,$2,$3,true,$4,$4)', [NIA, 'Nia James', 'nia@example.test', now]);
    const others = (await db.query<{ n: number }>('SELECT count(*)::int AS n FROM moderation_appeals WHERE appellant_id<>$1', [NIA])).rows[0].n;
    assert(others > 0);
    const { summary } = await repo.deleteAccount(NIA);
    assert.equal(summary.removed.moderationAppeals, 1);
    assert.equal((await db.query('SELECT 1 FROM moderation_appeals WHERE appellant_id=$1', [NIA])).rows.length, 0);
    assert.equal((await db.query<{ n: number }>('SELECT count(*)::int AS n FROM moderation_appeals')).rows[0].n, others);
    assert((await db.query("SELECT 1 FROM audit WHERE organization_id=$1 AND action='moderation.appeal.reversed'", [ORG])).rows.length, 'the decision stays audited');
});
