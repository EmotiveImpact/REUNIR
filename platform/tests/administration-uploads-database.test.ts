import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase, type Database } from '../packages/db/src/connection';
import { migrate } from '../packages/db/src/migrate';
import { WorkspaceRepository } from '../packages/db/src/repository';
import { createSeed, DEMO_ADMIN, DEMO_INSTRUCTOR } from '../packages/domain/src/seed';

let db: Database, repo: WorkspaceRepository;
const withheld = { administration: 'withheld' as const };
const lessonFile = (trackId: string) => ({ purpose: 'lesson_resource' as const, trackId, name: 'notes.pdf', contentType: 'application/pdf' as const, sizeBytes: 100 });
const trackCover = { purpose: 'cover_image' as const, subject: 'track' as const, subjectId: 'track_product', contentType: 'image/png' as const, sizeBytes: 4096 };
const code = async (p: Promise<unknown>) => { try { await p; return 'ok'; } catch (e) { return (e as { code?: string }).code; } };

before(async () => { db = await openDatabase('pglite:memory'); await migrate(db); repo = new WorkspaceRepository(db); await repo.seed(createSeed()); });
after(async () => db?.close());

test('an administrator without two-step sign-in cannot start lesson file or cover uploads that rely on administration', async () => {
    assert.equal(await code(repo.beginResourceUpload('code-black', DEMO_ADMIN, lessonFile('track_product'), (o, id) => `organisations/${o}/resources/${id}.pdf`, 'withheld-lesson', withheld)), 'TWO_FACTOR_REQUIRED');
    assert.equal(await code(repo.beginCoverUpload('code-black', DEMO_ADMIN, trackCover, (o, id) => `organisations/${o}/covers/tracks/track_product/${id}.png`, 'withheld-cover', undefined, withheld)), 'TWO_FACTOR_REQUIRED');
});

test('the track instructor, who holds a grant rather than administration, is never asked', async () => {
    const { upload } = await repo.beginResourceUpload('code-black', DEMO_INSTRUCTOR, lessonFile('track_product'), (o, id) => `organisations/${o}/resources/${id}.pdf`, 'instructor-lesson', withheld);
    assert.equal(upload.status, 'pending');
    // Discarding someone else's unused file is an administrator's power, so it is withheld too; the uploader keeps theirs.
    assert.equal(await code(repo.discardResourceUpload('code-black', DEMO_ADMIN, upload.id, 'withheld-discard', withheld)), 'TWO_FACTOR_REQUIRED');
    assert.equal((await repo.discardResourceUpload('code-black', DEMO_INSTRUCTOR, upload.id, 'instructor-discard', withheld)).id, upload.id);
});

test('with two-step sign-in, or when it is optional, the administrator keeps every file power', async () => {
    const { upload } = await repo.beginResourceUpload('code-black', DEMO_ADMIN, lessonFile('track_product'), (o, id) => `organisations/${o}/resources/${id}.pdf`, 'allowed-lesson', { administration: 'allowed' });
    assert.equal((await repo.discardResourceUpload('code-black', DEMO_ADMIN, upload.id, 'allowed-discard')).id, upload.id);
});
