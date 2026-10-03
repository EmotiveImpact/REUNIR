import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { openDatabase, type Database } from '../packages/db/src/connection';
import { migrate } from '../packages/db/src/migrate';
import { WorkspaceRepository, setContext } from '../packages/db/src/repository';
import { grantRuntimeTables } from '../packages/db/src/runtime-role';
import { createSeed, DEMO_ADMIN, DEMO_USER } from '../packages/domain/src/seed';
import { MailQueue } from '../apps/api/src/mail';
import { InvitationService } from '../apps/api/src/invitations';
import { createApp } from '../apps/api/src/app';

const ORG = 'org_code_black', origin = 'https://ferven.test', secret = 'instructor-invitations-test-secret-0123456789';
let db: Database, runtime: Database, repo: WorkspaceRepository, mail: MailQueue, invites: InvitationService;
const token = (url: string) => new URLSearchParams(new URL(url).hash.split('?')[1]).get('token')!;
/** A fresh account, as Better Auth would create it, with no membership yet. */
async function account(email: string) {
    const id = 'user_' + randomUUID().slice(0, 8);
    await db.query('INSERT INTO auth_user(id,name,email,email_verified,created_at,updated_at) VALUES($1,$2,$3,true,now(),now())', [id, 'Invited ' + id, email]);
    return id;
}
const grants = async (userId: string) => (await db.query<{ track_id: string; granted_by: string }>('SELECT track_id,granted_by FROM track_instructors WHERE organization_id=$1 AND user_id=$2', [ORG, userId])).rows;

before(async () => {
    db = await openDatabase('pglite:memory'); await migrate(db);
    const owner = new WorkspaceRepository(db); await owner.seed(createSeed()); await owner.seed(createSeed('studio-north'));
    await db.query('CREATE ROLE reunir_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS');
    await db.transaction(grantRuntimeTables);
    runtime = Object.create(db) as Database;
    runtime.transaction = fn => db.transaction(async tx => { await tx.query('SET LOCAL ROLE reunir_app'); return fn(tx); });
    repo = new WorkspaceRepository(runtime);
    mail = new MailQueue(runtime, secret);
    invites = new InvitationService(repo, origin, mail);
});
after(async () => db?.close());

test('an administrator invites someone new to teach one track; accepting makes them a member and that track’s instructor', async () => {
    const created = await invites.create('code-black', DEMO_ADMIN, 'Teacher@Example.test', 'track_story');
    const row = (await db.query<{ track_id: string; email: string }>('SELECT track_id,email FROM invitations WHERE id=$1', [created.id])).rows[0];
    assert.deepEqual(row, { track_id: 'track_story', email: 'teacher@example.test' });
    const message = mail.open((await db.query<{ payload: string }>('SELECT payload FROM email_outbox WHERE invitation_id=$1', [created.id])).rows[0].payload);
    assert.match(message.subject, /invitation to teach Stories that make people feel in Code Black/);
    assert.match(message.text, /write lessons and knowledge checks for Stories that make people feel/);
    assert.equal((await invites.inspect(token(created.url))).track, 'Stories that make people feel');
    const person = await account('teacher@example.test');
    const accepted = await invites.accept(token(created.url), person);
    assert.equal(accepted.teaching, 'Stories that make people feel');
    assert.deepEqual(await grants(person), [{ track_id: 'track_story', granted_by: DEMO_ADMIN }], 'granted in the inviting administrator’s name');
    const member = (await db.query<{ role: string; status: string }>('SELECT role,status FROM members WHERE organization_id=$1 AND user_id=$2', [ORG, person])).rows[0];
    assert.deepEqual(member, { role: 'member', status: 'active' }, 'teaching is not a community role');
    const audit = (await db.query<{ actor_id: string }>("SELECT actor_id FROM audit WHERE organization_id=$1 AND action='track.instructor.add' AND object_id='track_story'", [ORG])).rows;
    assert.deepEqual(audit.map(a => a.actor_id), [DEMO_ADMIN]);
    const view = await repo.snapshot('code-black', person);
    assert(view.trackInstructors.some(i => i.userId === person && i.trackId === 'track_story'));
    assert(!view.trackInstructors.some(i => i.userId === person && i.trackId !== 'track_story'), 'one track only');
});

test('a plain invitation still grants membership only', async () => {
    const created = await invites.create('code-black', DEMO_ADMIN, 'member-only@example.test');
    const person = await account('member-only@example.test');
    assert.equal((await invites.accept(token(created.url), person)).teaching, null);
    assert.deepEqual(await grants(person), []);
});

test('unknown tracks, other communities’ tracks and existing members are refused', async () => {
    await assert.rejects(() => invites.create('code-black', DEMO_ADMIN, 'nobody@example.test', 'track_missing'), { code: 'NOT_FOUND' });
    const north = (await db.query<{ id: string }>("SELECT id FROM tracks WHERE organization_id='org_studio_north' LIMIT 1")).rows[0].id;
    const shared = (await db.query<{ n: number }>("SELECT count(*)::int AS n FROM tracks WHERE organization_id=$1 AND id=$2", [ORG, north])).rows[0].n;
    if (!shared) await assert.rejects(() => invites.create('code-black', DEMO_ADMIN, 'nobody@example.test', north), { code: 'NOT_FOUND' });
    await db.query("INSERT INTO auth_user(id,name,email,email_verified,created_at,updated_at) VALUES($1,'Alex','alex@example.test',true,now(),now()) ON CONFLICT DO NOTHING", [DEMO_USER]);
    await assert.rejects(() => invites.create('code-black', DEMO_ADMIN, 'alex@example.test', 'track_story'), { code: 'MEMBERSHIP_EXISTS' });
    await assert.rejects(() => invites.create('code-black', DEMO_USER, 'student@example.test', 'track_story'), { code: 'FORBIDDEN' }, 'members cannot invite');
});

test('if the sender no longer administers the community, the person joins without the teaching grant', async () => {
    await db.query("UPDATE members SET role='admin' WHERE organization_id=$1 AND user_id='member_maya'", [ORG]);
    const created = await invites.create('code-black', 'member_maya', 'late@example.test', 'track_story');
    await db.query("UPDATE members SET role='member' WHERE organization_id=$1 AND user_id='member_maya'", [ORG]);
    const person = await account('late@example.test');
    const accepted = await invites.accept(token(created.url), person);
    assert.equal(accepted.teaching, null);
    assert.deepEqual(await grants(person), []);
    assert.equal((await db.query('SELECT 1 FROM members WHERE organization_id=$1 AND user_id=$2', [ORG, person])).rows.length, 1);
});

test('row security admits an invited grant only for the invited person, track and sender, while the invitation is pending', async () => {
    const created = await invites.create('code-black', DEMO_ADMIN, 'forger@example.test', 'track_story');
    const digest = createHash('sha256').update(token(created.url)).digest('hex');
    const person = await account('forger@example.test');
    await db.query("INSERT INTO members(organization_id,id,created_at,user_id,name,headline,bio,skills,colour,avatar,role,status) VALUES($1,$2,now(),$3,'Forger','','','[]','violet','','member','active')", [ORG, randomUUID(), person]);
    const attempt = (track: string, grantedBy: string, hash: string | null = digest, user = person) => db.transaction(async tx => {
        await tx.query('SET LOCAL ROLE reunir_app');
        await setContext(tx, ORG, user);
        if (hash) await tx.query("SELECT set_config('app.invitation_hash',$1,true)", [hash]);
        await tx.query('INSERT INTO track_instructors(id,organization_id,created_at,track_id,user_id,granted_by) VALUES($1,$2,now(),$3,$4,$5)', [randomUUID(), ORG, track, user, grantedBy]);
    });
    await assert.rejects(() => attempt('track_product', DEMO_ADMIN), 'another track');
    await assert.rejects(() => attempt('track_story', 'member_maya'), 'another sender');
    await assert.rejects(() => attempt('track_story', DEMO_ADMIN, null), 'no invitation');
    await assert.rejects(() => attempt('track_story', DEMO_ADMIN, digest, 'member_jordan'), 'someone else');
    await invites.revoke('code-black', DEMO_ADMIN, created.id);
    await assert.rejects(() => attempt('track_story', DEMO_ADMIN), 'a revoked invitation');
    assert.deepEqual(await grants(person), []);
});

test('the route takes an optional track and lists who was asked to teach', async () => {
    const app = createApp({ repository: repo, origin, invitations: invites, mail, resolveSession: async () => ({ id: DEMO_ADMIN, name: 'Amina' }) });
    const post = (body: unknown) => app.request('/api/organisations/code-black/invitations', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, 'Idempotency-Key': randomUUID() }, body: JSON.stringify(body) });
    assert.equal((await post({ email: 'route@example.test', trackId: '../track' })).status, 400);
    assert.equal((await post({ email: 'route@example.test', trackId: 'track_story', role: 'admin' })).status, 400);
    assert.equal((await post({ email: 'route@example.test', trackId: 'track_story' })).status, 201);
    const listed = await (await app.request('/api/organisations/code-black/invitations')).json() as { email: string; trackTitle: string | null }[];
    assert.equal(listed.find(i => i.email === 'route@example.test')?.trackTitle, 'Stories that make people feel');
    assert.equal(listed.find(i => i.email === 'member-only@example.test')?.trackTitle, null);
});
