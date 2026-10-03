import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { openDatabase, type Database } from '../packages/db/src/connection';
import { migrate } from '../packages/db/src/migrate';
import { WorkspaceRepository } from '../packages/db/src/repository';
import { grantRuntimeTables } from '../packages/db/src/runtime-role';
import { createSeed, DEMO_ADMIN, DEMO_USER } from '../packages/domain/src/seed';
import { AUDIT_WINDOW, NOTIFICATION_WINDOW, cursorFor } from '../packages/contracts/src/pages';

let db: Database, repo: WorkspaceRepository;
const ORG = 'org_code_black';
const at = (n: number) => new Date(Date.UTC(2026, 8, 1) + n * 1000).toISOString();

before(async () => {
    db = await openDatabase('pglite:memory'); await migrate(db);
    const owner = new WorkspaceRepository(db); await owner.seed(createSeed()); await owner.seed(createSeed('studio-north'));
    await db.query('CREATE ROLE reunir_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS');
    await db.transaction(grantRuntimeTables);
    const runtime = Object.create(db) as Database;
    runtime.transaction = fn => db.transaction(async tx => { await tx.query('SET LOCAL ROLE reunir_app'); return fn(tx); });
    repo = new WorkspaceRepository(runtime);
    // A long history: 70 notices for Alex, 60 for Sofia, 150 audit entries (two sharing one millisecond) and outbox rows.
    for (let i = 0; i < 70; i++) await db.query("INSERT INTO notifications(id,organization_id,created_at,user_id,title,body,href,read_at) VALUES($1,$2,$3,$4,$5,'Body','/home',NULL)", [`alex_${i}`, ORG, at(i), DEMO_USER, `Alex ${i}`]);
    for (let i = 0; i < 60; i++) await db.query("INSERT INTO notifications(id,organization_id,created_at,user_id,title,body,href,read_at) VALUES($1,$2,$3,$4,$5,'Body','/home',NULL)", [`sofia_${i}`, ORG, at(i), 'member_sofia', `Sofia ${i}`]);
    for (let i = 0; i < 150; i++) await db.query("INSERT INTO audit(id,organization_id,created_at,actor_id,action,object_id,metadata) VALUES($1,$2,$3,$4,'test.action','x','{}')", [`audit_${String(i).padStart(3, '0')}`, ORG, at(i), DEMO_ADMIN]);
    await db.query("INSERT INTO audit(id,organization_id,created_at,actor_id,action,object_id,metadata) VALUES('audit_tie','org_code_black',$1,$2,'test.action','x','{}')", [at(149), DEMO_ADMIN]);
});
after(async () => db?.close());

test('the snapshot reads only the person’s own notices and sends the newest, with exact totals', async () => {
    const alex = await repo.snapshot('code-black', DEMO_USER);
    assert.equal(alex.notifications.length, NOTIFICATION_WINDOW);
    assert(alex.notifications.every(n => n.userId === DEMO_USER));
    assert(alex.notifications.some(n => n.id === 'alex_69') && !alex.notifications.some(n => n.id === 'alex_0'), 'the newest end');
    const own = (await db.query<{ n: number }>('SELECT count(*)::int AS n FROM notifications WHERE user_id=$1 AND organization_id=$2', [DEMO_USER, ORG])).rows[0].n;
    assert.equal(alex.summary!.notifications, own);
    assert.deepEqual([alex.audit, alex.outbox], [[], []]);
    const amina = await repo.snapshot('code-black', DEMO_ADMIN);
    assert.equal(amina.audit.length, AUDIT_WINDOW);
    assert.equal(amina.summary!.audit, (await db.query<{ n: number }>("SELECT count(*)::int AS n FROM audit WHERE organization_id=$1", [ORG])).rows[0].n, 'the audit total counts the whole trail');
});

test('commands still add notices for other people and audit entries, without reading them', async () => {
    const before = (await db.query<{ n: number }>("SELECT count(*)::int AS n FROM notifications WHERE user_id='member_sofia'")).rows[0].n;
    const audits = (await db.query<{ n: number }>('SELECT count(*)::int AS n FROM audit')).rows[0].n;
    await repo.execute('code-black', DEMO_ADMIN, { type: 'member.role', memberId: 'member_maya', role: 'admin' }, randomUUID(), 'pages-db');
    await repo.execute('code-black', DEMO_USER, { type: 'post.comment', postId: 'post_welcome', body: 'Thanks for the welcome.' }, randomUUID(), 'pages-db');
    assert.equal((await db.query<{ n: number }>('SELECT count(*)::int AS n FROM audit')).rows[0].n, audits + 1, 'the new audit entry is written; none are lost');
    assert.equal((await db.query<{ n: number }>("SELECT count(*)::int AS n FROM notifications WHERE user_id='member_sofia'")).rows[0].n, before, 'Sofia’s history is untouched');
    assert.equal((await db.query<{ n: number }>("SELECT count(*)::int AS n FROM notifications WHERE user_id=$1 AND organization_id=$2", [DEMO_USER, ORG])).rows[0].n, 70 + createSeed().notifications.filter(n => n.userId === DEMO_USER).length);
    // Marking everything read reaches notices outside the window too.
    await repo.execute('code-black', DEMO_USER, { type: 'notification.read' }, randomUUID(), 'pages-db');
    assert.equal((await db.query<{ n: number }>("SELECT count(*)::int AS n FROM notifications WHERE user_id=$1 AND organization_id=$2 AND read_at IS NULL", [DEMO_USER, ORG])).rows[0].n, 0);
    assert.equal((await db.query<{ n: number }>("SELECT count(*)::int AS n FROM notifications WHERE user_id='member_sofia' AND read_at IS NULL")).rows[0].n > 0, true);
});

test('notices page through the whole history once each, under the restricted role', async () => {
    const seen: string[] = [];
    let page = await repo.page('code-black', DEMO_USER, 'notifications', { limit: 25 });
    const total = page.total;
    while (true) { seen.push(...page.items.map(n => n.id)); if (!page.nextCursor) break; page = await repo.page('code-black', DEMO_USER, 'notifications', { cursor: page.nextCursor, limit: 25 }); }
    assert.equal(seen.length, total); assert.equal(new Set(seen).size, total);
    assert(!seen.some(id => id.startsWith('sofia_')));
});

test('the audit trail pages in SQL, newest first, including entries that share a millisecond; administrators only', async () => {
    const seen: string[] = [];
    let page = await repo.page('code-black', DEMO_ADMIN, 'audit', { limit: 50 });
    const total = page.total;
    assert(total > 150);
    const ids = page.items.map(a => a.id);
    assert.equal(ids.indexOf('audit_tie') + 1, ids.indexOf('audit_149'), 'two entries in one millisecond sort by ID');
    while (true) { seen.push(...page.items.map(a => a.id)); if (!page.nextCursor) break; page = await repo.page('code-black', DEMO_ADMIN, 'audit', { cursor: page.nextCursor, limit: 50 }); }
    assert.equal(seen.length, total); assert.equal(new Set(seen).size, total, 'no entry twice, none skipped');
    await assert.rejects(() => repo.page('code-black', DEMO_USER, 'audit'), { code: 'FORBIDDEN' });
    await assert.rejects(() => repo.page('code-black', DEMO_ADMIN, 'audit', { cursor: 'nonsense' }), { code: 'INVALID_CURSOR' });
    // Studio North's trail is separate: its administrator never pages Code Black's entries.
    const north = await repo.page('studio-north', DEMO_ADMIN, 'audit', { cursor: cursorFor({ createdAt: at(1000), id: 'zzz' }) });
    assert(!north.items.some(a => a.id.startsWith('audit_')));
});

test('suspended and outside members read no pages', async () => {
    await db.query("UPDATE members SET status='suspended' WHERE organization_id=$1 AND user_id='member_sofia'", [ORG]);
    await assert.rejects(() => repo.page('code-black', 'member_sofia', 'notifications'), { code: 'NOT_FOUND' });
    await assert.rejects(() => repo.page('code-black', 'nobody', 'notifications'), { code: 'NOT_FOUND' });
});
