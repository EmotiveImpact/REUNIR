import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { openDatabase, type Database } from '../packages/db/src/connection';
import { migrate } from '../packages/db/src/migrate';
import { WorkspaceRepository } from '../packages/db/src/repository';
import { createSeed, DEMO_ADMIN, DEMO_USER } from '../packages/domain/src/seed';
import { createApp } from '../apps/api/src/app';
import { FakeBucket } from './helpers/fake-bucket';

const origin = 'https://reunir.test', base = '/api/organisations/code-black';
let db: Database, app: ReturnType<typeof createApp>;
let identity: { id: string; name: string } | null = null;
const as = (id: string) => { identity = { id, name: id }; };
const post = (path: string, body: unknown) => app.request(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, 'Idempotency-Key': randomUUID() }, body: JSON.stringify(body) });
const command = (body: unknown) => post('/commands', body);
const code = async (r: Response) => (await r.json()).error?.code;
const workspace = async () => (await app.request(base + '/workspace')).json();

before(async () => {
    db = await openDatabase('pglite:memory'); await migrate(db);
    const repo = new WorkspaceRepository(db); await repo.seed(createSeed()); await repo.seed(createSeed('studio-north'));
    app = createApp({ repository: repo, origin, resolveSession: async () => identity, storage: new FakeBucket() });
});
after(async () => db?.close());

test('an administrator grants an instructor, who then authors that track and nothing else', async () => {
    as('member_maya');
    assert.equal(await code(await command({ type: 'lesson.draft.create', trackId: 'track_story' })), 'AUTHOR_REQUIRED', 'a named author is not an instructor');
    assert.equal(await code(await command({ type: 'track.instructor.add', trackId: 'track_story', userId: 'member_maya' })), 'ADMIN_REQUIRED');
    as(DEMO_ADMIN);
    assert.equal((await command({ type: 'track.instructor.add', trackId: 'track_story', userId: 'member_maya' })).status, 200);
    as('member_maya');
    const created = await command({ type: 'lesson.draft.create', trackId: 'track_story' });
    assert.equal(created.status, 200);
    const other = await command({ type: 'lesson.draft.create', trackId: 'track_product' });
    assert.equal(other.status, 404);
    const ws = await workspace();
    assert.deepEqual([...new Set(ws.lessonDrafts.map((d: { trackId: string }) => d.trackId))], ['track_story']);
    assert(ws.trackInstructors.some((i: { trackId: string; userId: string }) => i.trackId === 'track_story' && i.userId === 'member_maya'));
});

test('lesson file uploads follow the grant', async () => {
    const intent = (trackId: string) => post('/uploads', { purpose: 'lesson_resource', trackId, name: 'Plan.pdf', contentType: 'application/pdf', sizeBytes: 100 });
    as('member_idris');
    assert.equal((await intent('track_product')).status, 201);
    assert.equal((await intent('track_story')).status, 404);
    as(DEMO_USER);
    assert.equal(await code(await intent('track_product')), 'AUTHOR_REQUIRED');
});

test('the seeded instructor reviews the written answer waiting on their track', async () => {
    as('member_idris');
    const ws = await workspace();
    assert.deepEqual(ws.quizAttempts.map((a: { id: string }) => a.id), ['attempt_sofia']);
    const r = await command({ type: 'quiz.attempt.review', attemptId: 'attempt_sofia', expectedVersion: 1, marks: [{ questionId: 'q6_change', points: 2 }], feedback: 'Specific and observed.' });
    assert.equal(r.status, 200);
    as(DEMO_USER);
    assert.equal(await code(await command({ type: 'quiz.attempt.review', attemptId: 'attempt_sofia', expectedVersion: 2, marks: [], feedback: 'x' })), 'REVIEWER_REQUIRED');
});

test('revoking the grant ends authoring at once', async () => {
    as(DEMO_ADMIN);
    assert.equal((await command({ type: 'track.instructor.remove', trackId: 'track_story', userId: 'member_maya' })).status, 200);
    as('member_maya');
    assert.equal(await code(await command({ type: 'lesson.draft.create', trackId: 'track_story' })), 'AUTHOR_REQUIRED');
    assert.deepEqual((await workspace()).lessonDrafts, []);
});
