import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase, type Database, type SQL } from '../packages/db/src/connection';
import { migrate } from '../packages/db/src/migrate';
import { WorkspaceRepository, setContext } from '../packages/db/src/repository';
import { MessagingRepository } from '../packages/db/src/messaging';
import { grantRuntimeTables } from '../packages/db/src/runtime-role';
import { createSeed, DEMO_ADMIN, DEMO_USER } from '../packages/domain/src/seed';
import { startGroup, GROUP_LIMIT } from '../packages/contracts/src/messaging';

// Group conversations (migration 0022) through the restricted runtime role, with forced row security, as the API runs them.
const ORG = 'org_code_black', THEO = 'member_theo', SOFIA = 'member_sofia', JORDAN = 'member_jordan', MAYA = 'member_maya', NIA = 'member_nia';
let db: Database, messaging: MessagingRepository, group = '', early = '', late = '';
const asRuntime = <T>(userId: string, fn: (sql: SQL) => Promise<T>, organizationId = ORG) => db.transaction(async sql => {
    await sql.query('SET LOCAL ROLE reunir_app'); await setContext(sql, organizationId, userId); return fn(sql);
});
const bodies = async (userId: string) => (await messaging.messages('code-black', userId, group)).items.map(m => m.body);
let key = 0;
const send = (userId: string, body: string, thread = group) => messaging.send('code-black', userId, thread, body, `group-test-${++key}`);

before(async () => {
    db = await openDatabase('pglite:memory'); await migrate(db);
    const owner = new WorkspaceRepository(db); await owner.seed(createSeed()); await owner.seed(createSeed('studio-north'));
    await db.query('CREATE ROLE reunir_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS');
    await db.transaction(grantRuntimeTables);
    const scoped = Object.create(db) as Database;
    scoped.transaction = fn => db.transaction(async tx => { await tx.query('SET LOCAL ROLE reunir_app'); return fn(tx); });
    messaging = new MessagingRepository(new WorkspaceRepository(scoped));
});
after(async () => db?.close());

test('direct threads keep their shape: exactly two different people and no name', async () => {
    await assert.rejects(() => db.query("INSERT INTO conversations(organization_id,id,participant_ids,pair_key) VALUES($1,'bad_three',$2,'bad_three')", [ORG, [DEMO_USER, THEO, SOFIA]]));
    await assert.rejects(() => db.query("INSERT INTO conversations(organization_id,id,participant_ids,pair_key,title) VALUES($1,'bad_named',$2,'bad_named','Named')", [ORG, [DEMO_USER, THEO]]));
    await assert.rejects(() => db.query("INSERT INTO conversations(organization_id,id,kind,participant_ids,pair_key,created_by) VALUES($1,'bad_group','group',$2,'bad_group',$3)", [ORG, [DEMO_USER, THEO, SOFIA], DEMO_USER]));
    const direct = await messaging.start('code-black', DEMO_USER, THEO);
    assert.equal((await messaging.detail('code-black', DEMO_USER, direct.id)).kind, 'direct');
});

test('a group needs a name and at least two other active, unblocked members', async () => {
    assert.throws(() => startGroup.parse({ title: 'Too small', userIds: [THEO] }));
    assert.throws(() => startGroup.parse({ title: ' ', userIds: [THEO, SOFIA] }));
    assert.throws(() => startGroup.parse({ title: 'Too big', userIds: Array.from({ length: GROUP_LIMIT }, (_, i) => `member_${i}`) }));
    await assert.rejects(() => messaging.startGroup('code-black', DEMO_USER, { title: 'Duplicates', userIds: [THEO, THEO] }), { code: 'VALIDATION' });
    await assert.rejects(() => messaging.startGroup('code-black', DEMO_USER, { title: 'With me', userIds: [DEMO_USER, THEO] }), { code: 'SELF_MESSAGE' });
    await assert.rejects(() => messaging.startGroup('code-black', DEMO_USER, { title: 'Stranger', userIds: [THEO, 'member_nobody'] }), { code: 'NOT_FOUND' });
    await db.query("UPDATE members SET status='suspended' WHERE organization_id=$1 AND user_id=$2", [ORG, NIA]);
    await assert.rejects(() => messaging.startGroup('code-black', DEMO_USER, { title: 'Suspended', userIds: [THEO, NIA] }), { code: 'NOT_FOUND' });
    await messaging.block('code-black', MAYA, DEMO_USER, true);
    await assert.rejects(() => messaging.startGroup('code-black', DEMO_USER, { title: 'Blocked', userIds: [THEO, MAYA] }), { code: 'MESSAGING_UNAVAILABLE' });
    assert.equal((await db.query("SELECT count(*)::int AS n FROM conversations WHERE kind='group'")).rows[0].n, 0);
});

test('people in a group read and write it; nobody else in the community, or another community, can', async () => {
    group = (await messaging.startGroup('code-black', DEMO_USER, { title: '  Open studio crew ', userIds: [THEO, SOFIA] })).id;
    const seen = await messaging.detail('code-black', THEO, group);
    assert.deepEqual({ kind: seen.kind, title: seen.title, createdBy: seen.createdBy, people: seen.participantIds }, { kind: 'group', title: 'Open studio crew', createdBy: DEMO_USER, people: [DEMO_USER, THEO, SOFIA] });
    early = (await send(DEMO_USER, 'Who is bringing work on Thursday?')).id;
    await send(THEO, 'I am, a two-minute motion piece.');
    assert.deepEqual(await bodies(SOFIA), ['Who is bringing work on Thursday?', 'I am, a two-minute motion piece.']);
    const inbox = (await messaging.list('code-black', SOFIA)).items.find(c => c.id === group)!;
    assert.deepEqual({ unread: inbox.unread, last: inbox.lastBody }, { unread: 2, last: 'I am, a two-minute motion piece.' });
    await assert.rejects(() => messaging.messages('code-black', JORDAN, group), { code: 'NOT_FOUND' });
    await assert.rejects(() => send(JORDAN, 'Let me in.'), { code: 'NOT_FOUND' });
    await assert.rejects(() => messaging.detail('code-black', DEMO_ADMIN, group), { code: 'NOT_FOUND' }, 'the owner has no special access to a group');
    assert(!(await messaging.list('code-black', JORDAN)).items.some(c => c.id === group));
    await assert.rejects(() => messaging.detail('studio-north', DEMO_USER, group), { code: 'NOT_FOUND' });
    assert.equal((await asRuntime(JORDAN, sql => sql.query('SELECT id FROM messages WHERE conversation_id=$1', [group]))).rows.length, 0);
    assert.equal((await asRuntime(DEMO_USER, sql => sql.query('SELECT id FROM conversations WHERE id=$1', [group]), 'org_studio_north')).rows.length, 0);
});

test('someone added later reads only what is written after they join, even with direct queries', async () => {
    assert.deepEqual(await messaging.add('code-black', THEO, group, { userIds: [JORDAN, SOFIA] }), { ok: true, added: 1 });
    late = (await send(JORDAN, 'Thanks for having me.')).id;
    assert.deepEqual(await bodies(JORDAN), ['Thanks for having me.']);
    assert.deepEqual(await bodies(DEMO_USER), ['Who is bringing work on Thursday?', 'I am, a two-minute motion piece.', 'Thanks for having me.']);
    const raw = await asRuntime(JORDAN, sql => sql.query<{ id: string }>('SELECT id FROM messages WHERE conversation_id=$1', [group]));
    assert.deepEqual(raw.rows.map(r => r.id), [late]);
    await assert.rejects(() => messaging.read('code-black', JORDAN, group, early), { code: 'NOT_FOUND' });
    await assert.rejects(() => messaging.report('code-black', JORDAN, group, early, 'Reporting what I cannot see.'), { code: 'NOT_FOUND' });
    assert.equal((await messaging.list('code-black', JORDAN)).items.find(c => c.id === group)!.unread, 0);
});

test('a member who joined late adds others from the true newest message, not from what they can see', async () => {
    // Jordan can see nothing in this group when adding Amina, yet Amina must still not see the earlier message.
    const fresh = (await messaging.startGroup('code-black', DEMO_USER, { title: 'Late joins', userIds: [THEO, SOFIA] })).id;
    await send(DEMO_USER, 'Only the first three see this.', fresh);
    await messaging.add('code-black', THEO, fresh, { userIds: [JORDAN] });
    await messaging.add('code-black', JORDAN, fresh, { userIds: [DEMO_ADMIN] });
    assert.deepEqual((await messaging.messages('code-black', DEMO_ADMIN, fresh)).items, []);
});

test('a block pauses only direct threads, never a group, but stops one adding the other', async () => {
    await messaging.block('code-black', SOFIA, THEO, true);
    const seen = await messaging.detail('code-black', SOFIA, group);
    assert.deepEqual({ blocked: seen.blocked, mine: seen.blockedByMe }, { blocked: false, mine: false });
    await send(THEO, 'Still here for everyone.');
    await send(SOFIA, 'And so am I.');
    // Maya blocked Alex earlier, so Alex cannot add her, though Theo can.
    await assert.rejects(() => messaging.add('code-black', DEMO_USER, group, { userIds: [MAYA] }), { code: 'MESSAGING_UNAVAILABLE' });
    const direct = await messaging.start('code-black', THEO, SOFIA).catch(e => e);
    assert.equal(direct.code, 'MESSAGING_UNAVAILABLE', 'the direct thread between them is paused');
});

test('anyone in a group renames it; only direct threads refuse group actions', async () => {
    await messaging.rename('code-black', SOFIA, group, { title: 'Thursday critique' });
    assert.equal((await messaging.detail('code-black', DEMO_USER, group)).title, 'Thursday critique');
    const direct = await messaging.start('code-black', DEMO_USER, SOFIA);
    await assert.rejects(() => messaging.rename('code-black', DEMO_USER, direct.id, { title: 'Nope' }), { code: 'NOT_A_GROUP' });
    await assert.rejects(() => messaging.add('code-black', DEMO_USER, direct.id, { userIds: [JORDAN] }), { code: 'NOT_A_GROUP' });
    await assert.rejects(() => messaging.leave('code-black', DEMO_USER, direct.id), { code: 'NOT_A_GROUP' });
});

test('only the person who started a group removes others, and a removed person loses access', async () => {
    await assert.rejects(() => messaging.remove('code-black', THEO, group, JORDAN), { code: 'FORBIDDEN' });
    await assert.rejects(() => messaging.remove('code-black', DEMO_USER, group, DEMO_USER), { code: 'USE_LEAVE' });
    await assert.rejects(() => messaging.remove('code-black', DEMO_USER, group, MAYA), { code: 'NOT_FOUND' });
    await messaging.remove('code-black', DEMO_USER, group, JORDAN);
    await assert.rejects(() => messaging.messages('code-black', JORDAN, group), { code: 'NOT_FOUND' });
    assert.deepEqual((await messaging.detail('code-black', DEMO_USER, group)).participantIds, [DEMO_USER, THEO, SOFIA]);
    assert((await bodies(DEMO_USER)).includes('Thanks for having me.'), 'their messages stay for the others');
});

test('leaving takes a person out; their messages stay; re-adding starts them from the newest message', async () => {
    await messaging.leave('code-black', SOFIA, group);
    await assert.rejects(() => messaging.messages('code-black', SOFIA, group), { code: 'NOT_FOUND' });
    assert(!(await messaging.list('code-black', SOFIA)).items.some(c => c.id === group));
    await send(DEMO_USER, 'Sofia has gone quiet.');
    // Sofia blocked Theo, so Theo cannot bring her back; Alex can.
    await assert.rejects(() => messaging.add('code-black', THEO, group, { userIds: [SOFIA] }), { code: 'MESSAGING_UNAVAILABLE' });
    await messaging.add('code-black', DEMO_USER, group, { userIds: [SOFIA] });
    assert.deepEqual(await bodies(SOFIA), []);
    await send(THEO, 'Welcome back, Sofia.');
    assert.deepEqual(await bodies(SOFIA), ['Welcome back, Sofia.']);
});

test('row security keeps outsiders out, admits a leave only for the marked group and joins only in the adder\'s name', async () => {
    // A non-participant cannot touch the row at all.
    await asRuntime(JORDAN, sql => sql.query("UPDATE conversations SET participant_ids=participant_ids||'{member_jordan}'::text[] WHERE id=$1", [group]));
    assert(!(await messaging.detail('code-black', DEMO_USER, group)).participantIds.includes(JORDAN));
    // A participant cannot turn a direct thread into anything that excludes them.
    const direct = await messaging.start('code-black', THEO, JORDAN);
    await assert.rejects(() => asRuntime(THEO, sql => sql.query("UPDATE conversations SET participant_ids=ARRAY['member_jordan','member_sofia'] WHERE id=$1", [direct.id])));
    // Without the transaction mark the API sets, a participant cannot write themselves out of a group.
    await assert.rejects(() => asRuntime(THEO, sql => sql.query('UPDATE conversations SET participant_ids=array_remove(participant_ids,$2) WHERE id=$1', [group, THEO])));
    // Joins are written only in the adder's own name.
    await assert.rejects(() => asRuntime(THEO, sql => sql.query("INSERT INTO conversation_joins(organization_id,conversation_id,user_id,after_sequence,added_by) VALUES($1,$2,'member_maya',0,$3)", [ORG, group, DEMO_USER])));
});

test('reports from a group share only the selected message with moderators', async () => {
    const theirs = (await messaging.messages('code-black', SOFIA, group)).items.find(m => m.senderId === THEO)!;
    await messaging.report('code-black', SOFIA, group, theirs.id, 'Checking the report path from a group.');
    const queue = await messaging.reports('code-black', DEMO_ADMIN);
    assert.deepEqual(queue.map(r => r.reportedBody), ['Welcome back, Sofia.']);
});
