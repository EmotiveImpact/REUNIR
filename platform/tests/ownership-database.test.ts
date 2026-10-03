import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { openDatabase, type Database, type SQL } from '../packages/db/src/connection';
import { migrate } from '../packages/db/src/migrate';
import { WorkspaceRepository, setContext } from '../packages/db/src/repository';
import { grantRuntimeTables } from '../packages/db/src/runtime-role';
import { createSeed, DEMO_ADMIN } from '../packages/domain/src/seed';

const ORG = 'org_code_black', NORTH = 'org_studio_north', MAYA = 'member_maya', SOFIA = 'member_sofia';
let db: Database, runtime: WorkspaceRepository;
const asRuntime = <T>(organizationId: string, userId: string, fn: (sql: SQL) => Promise<T>) => db.transaction(async sql => {
    await sql.query('SET LOCAL ROLE reunir_app'); await setContext(sql, organizationId, userId); return fn(sql);
});
const run = (user: string, cmd: unknown, slug = 'code-black') => runtime.execute(slug, user, cmd, randomUUID(), 'ownership-test');
const roles = async (org: string) => Object.fromEntries((await db.query<{ user_id: string; role: string }>("SELECT user_id,role FROM members WHERE organization_id=$1 AND role IN ('owner','admin') ORDER BY user_id", [org])).rows.map(r => [r.user_id, r.role]));
const refused = (p: Promise<unknown>, code: string | RegExp) => assert.rejects(p, (e: { code?: string; message?: string }) => typeof code === 'string' ? e.code === code : code.test(String(e.message)));

before(async () => {
    db = await openDatabase('pglite:memory'); await migrate(db);
    const owner = new WorkspaceRepository(db); await owner.seed(createSeed()); await owner.seed(createSeed('studio-north'));
    await db.query('CREATE ROLE reunir_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS');
    await db.transaction(grantRuntimeTables);
    const scoped = Object.create(db) as Database;
    scoped.transaction = fn => db.transaction(async tx => { await tx.query('SET LOCAL ROLE reunir_app'); return fn(tx); });
    runtime = new WorkspaceRepository(scoped);
    const now = new Date().toISOString();
    await db.query('INSERT INTO auth_user(id,name,email,email_verified,created_at,updated_at) VALUES($1,$2,$3,true,$4,$4)', [DEMO_ADMIN, 'Amina Okafor', 'amina@example.test', now]);
});
after(async () => db?.close());

test('the database holds at most one owner per community, even for the runtime role', async () => {
    await refused(asRuntime(ORG, DEMO_ADMIN, sql => sql.query("UPDATE members SET role='owner' WHERE organization_id=$1 AND user_id=$2", [ORG, MAYA])), /members_single_owner_idx|duplicate key/);
    await refused(db.query("UPDATE members SET role='owner' WHERE organization_id=$1 AND user_id=$2", [NORTH, SOFIA]), /members_single_owner_idx|duplicate key/);
    assert.deepEqual(await roles(ORG), { [DEMO_ADMIN]: 'owner' });
});

test('refusals change nothing: a non-owner, a non-administrator, a mistyped name, another community’s member', async () => {
    await run(DEMO_ADMIN, { type: 'member.role', memberId: MAYA, role: 'admin' });
    await refused(runtime.transferOwnership('code-black', MAYA, MAYA, 'Code Black', 'r1'), 'OWNER_REQUIRED');
    await refused(runtime.transferOwnership('code-black', DEMO_ADMIN, SOFIA, 'Code Black', 'r2'), 'ADMIN_REQUIRED');
    await refused(runtime.transferOwnership('code-black', DEMO_ADMIN, MAYA, 'Studio North', 'r3'), 'CONFIRMATION_REQUIRED');
    // Studio North's members are another tenant's rows: row security hides them, so the member is simply not found.
    await db.query("INSERT INTO members VALUES('north_only',$1,now(),'member_north','North Admin','','','[]','neutral','','admin','active')", [NORTH]);
    await refused(runtime.transferOwnership('code-black', DEMO_ADMIN, 'north_only', 'Code Black', 'r4'), 'NOT_FOUND');
    await db.query("DELETE FROM members WHERE organization_id=$1 AND id='north_only'", [NORTH]);
    await refused(runtime.transferOwnership('studio-north', SOFIA, MAYA, 'Studio North', 'r5'), 'OWNER_REQUIRED');
    assert.deepEqual(await roles(ORG), { [DEMO_ADMIN]: 'owner', [MAYA]: 'admin' });
});

test('a suspended owner cannot hand over, and a suspended administrator cannot receive', async () => {
    await db.query("UPDATE members SET status='suspended' WHERE organization_id=$1 AND user_id=$2", [ORG, MAYA]);
    try { await refused(runtime.transferOwnership('code-black', DEMO_ADMIN, MAYA, 'Code Black', 'r6'), 'INACTIVE_MEMBER'); }
    finally { await db.query("UPDATE members SET status='active' WHERE organization_id=$1 AND user_id=$2", [ORG, MAYA]); }
    await db.query("UPDATE members SET status='suspended' WHERE organization_id=$1 AND user_id=$2", [ORG, DEMO_ADMIN]);
    try { await refused(runtime.transferOwnership('code-black', DEMO_ADMIN, MAYA, 'Code Black', 'r7'), 'NOT_FOUND'); }
    finally { await db.query("UPDATE members SET status='active' WHERE organization_id=$1 AND user_id=$2", [ORG, DEMO_ADMIN]); }
    assert.deepEqual(await roles(ORG), { [DEMO_ADMIN]: 'owner', [MAYA]: 'admin' });
});

test('the owner hands Code Black to an administrator under the runtime role, with an audit entry and a notice', async () => {
    const r = await runtime.transferOwnership('code-black', DEMO_ADMIN, MAYA, ' code black ', 'handover-1');
    assert.equal(r.message, 'Maya Bennett now owns Code Black. You are an administrator.');
    assert.deepEqual([r.ownerMemberId, r.previousOwnerMemberId], [MAYA, DEMO_ADMIN]);
    assert.deepEqual(await roles(ORG), { [DEMO_ADMIN]: 'admin', [MAYA]: 'owner' });
    assert.deepEqual(await roles(NORTH), { [DEMO_ADMIN]: 'owner' }, 'other communities are untouched');
    const audit = (await db.query<{ actor_id: string; object_id: string; metadata: { previousOwner: string; requestId: string } }>("SELECT actor_id,object_id,metadata FROM audit WHERE organization_id=$1 AND action='member.owner.transferred'", [ORG])).rows;
    assert.deepEqual(audit.map(a => [a.actor_id, a.object_id, a.metadata.previousOwner, a.metadata.requestId]), [[DEMO_ADMIN, MAYA, DEMO_ADMIN, 'handover-1']]);
    assert.equal((await runtime.snapshot('code-black', MAYA)).notifications.filter(n => n.title === 'You now own Code Black').length, 1);
    await refused(runtime.transferOwnership('code-black', DEMO_ADMIN, MAYA, 'Code Black', 'again'), 'OWNER_REQUIRED');
    await refused(run(DEMO_ADMIN, { type: 'member.role', memberId: SOFIA, role: 'admin' }), 'OWNER_REQUIRED');
    assert.equal((await run(MAYA, { type: 'member.role', memberId: SOFIA, role: 'moderator' })).message, 'Community role updated.');
});

test('the previous owner can delete their account only once they own nothing', async () => {
    await refused(runtime.deleteAccount(DEMO_ADMIN), 'OWNER_CANNOT_DELETE');
    assert.equal((await db.query('SELECT 1 FROM auth_user WHERE id=$1', [DEMO_ADMIN])).rows.length, 1, 'still owning Studio North, nothing changed');
    await run(DEMO_ADMIN, { type: 'member.role', memberId: SOFIA, role: 'admin' }, 'studio-north');
    await runtime.transferOwnership('studio-north', DEMO_ADMIN, SOFIA, 'Studio North', 'handover-2');
    const { summary } = await runtime.deleteAccount(DEMO_ADMIN);
    assert.equal(summary.communities, 2);
    assert.deepEqual(await roles(ORG), { [MAYA]: 'owner' });
    assert.deepEqual(await roles(NORTH), { [SOFIA]: 'owner' });
    assert.equal((await db.query("SELECT count(*)::int AS n FROM members WHERE user_id=$1 AND status='left' AND name='Former member'", [DEMO_ADMIN])).rows[0].n, 2);
});
