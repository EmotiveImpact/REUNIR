import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { openDatabase, type Database } from '../packages/db/src/connection';
import { migrate } from '../packages/db/src/migrate';
import { WorkspaceRepository } from '../packages/db/src/repository';
import { grantRuntimeTables } from '../packages/db/src/runtime-role';
import { createSeed, DEMO_ADMIN, DEMO_USER } from '../packages/domain/src/seed';
import { createApp } from '../apps/api/src/app';

const origin = 'https://reunir.test';
let db: Database, app: ReturnType<typeof createApp>, repo: WorkspaceRepository;
let identity: { id: string; name: string } | null = null;
const as = (id: string | null) => { identity = id ? { id, name: id } : null; };
const record = (slug = 'code-black') => app.request(`/api/organisations/${slug}/me/learning-record`);

before(async () => {
    db = await openDatabase('pglite:memory'); await migrate(db);
    const owner = new WorkspaceRepository(db); await owner.seed(createSeed()); await owner.seed(createSeed('studio-north'));
    // The API reads through the restricted runtime role with forced row security, as in production.
    await db.query('CREATE ROLE reunir_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS');
    await db.transaction(grantRuntimeTables);
    const runtime = Object.create(db) as Database;
    runtime.transaction = fn => db.transaction(async tx => { await tx.query('SET LOCAL ROLE reunir_app'); return fn(tx); });
    repo = new WorkspaceRepository(runtime);
    app = createApp({ repository: repo, origin, resolveSession: async () => identity });
});
after(async () => db?.close());

test('a member downloads their own record as a private attachment', async () => {
    as(DEMO_USER);
    const r = await record();
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-type') ?? '', /application\/json/);
    assert.match(r.headers.get('content-disposition') ?? '', /^attachment; filename="reunir-learning-record-code-black-\d{4}-\d{2}-\d{2}\.json"$/);
    assert.equal(r.headers.get('cache-control'), 'no-store');
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
    const body = await r.json();
    assert.deepEqual([body.format, body.member.name, body.community.name], ['reunir.learning-record', 'Alex Morgan', 'Code Black']);
    assert.deepEqual(body.enrolments.map((e: { track: string }) => e.track), ['From idea to first version']);
});
test('through the restricted role a learner gets their own attempt and marks, and nobody else’s', async () => {
    await repo.execute('code-black', DEMO_ADMIN, { type: 'quiz.attempt.review', attemptId: 'attempt_sofia', expectedVersion: 1, marks: [{ questionId: 'q6_change', points: 2 }], feedback: 'Clear and observed.' }, randomUUID(), 'learning-record-http');
    as('member_sofia');
    const sofia = await (await record()).json();
    assert.deepEqual(sofia.knowledgeChecks.map((a: { status: string; feedback: string; reviewedBy: string }) => [a.status, a.feedback, a.reviewedBy]), [['reviewed', 'Clear and observed.', 'Amina Okafor']]);
    as(DEMO_USER);
    const alex = JSON.stringify(await (await record()).json());
    assert(!alex.includes('Clear and observed.') && !alex.includes('Sofia'), 'another learner’s attempt never appears');
});
test('each community gives its own record; visitors and non-members get nothing', async () => {
    as(DEMO_USER);
    const north = await (await record('studio-north')).json();
    assert.equal(north.community.name, 'Studio North');
    assert.equal(north.community.slug, 'studio-north');
    assert(!JSON.stringify(north).includes('Code Black'), 'nothing from the other community');
    as(null);
    assert.equal((await record()).status, 401);
    as('someone_else');
    assert.equal((await record()).status, 404, 'a non-member learns nothing, not even that the community exists');
    as(DEMO_USER);
    assert.equal((await record('no-such-community')).status, 404);
});
