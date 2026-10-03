import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { createServer, type Server } from 'node:net';
import { openDatabase, type Database } from '../packages/db/src/connection';
import { migrate } from '../packages/db/src/migrate';
import { WorkspaceRepository } from '../packages/db/src/repository';
import { createSeed, DEMO_ADMIN } from '../packages/domain/src/seed';
import { createApp } from '../apps/api/src/app';
import { inspectConfiguration, validateRuntimeConfiguration, uploadScanningSetting } from '../apps/api/src/config';
import { ScannerUnavailable, clamdScanner, readVerdict, scanTimeoutMs, scannerFromEnvironment, type FileScanner } from '../apps/api/src/scanner';
import { FakeBucket } from './helpers/fake-bucket';
import { jpegHeader, webpHeader } from './helpers/images';

/** Stands in for clamd. Anything containing the marker is flagged; `down` makes every scan unavailable. */
const MARKER = 'REUNIR-TEST-FLAG';
class FakeScanner implements FileScanner {
    down = false;
    scanned: Uint8Array[] = [];
    async scan(bytes: Uint8Array) {
        if (this.down) throw new ScannerUnavailable('connection');
        this.scanned.push(bytes);
        return Buffer.from(bytes).includes(MARKER) ? { clean: false as const, signature: 'Reunir.Test.Flag' } : { clean: true as const };
    }
    async ping() { return !this.down; }
}

/** A tiny clamd: records what INSTREAM delivered and answers as the real daemon does. */
function fakeClamd(answer: (payload: Buffer) => string | null) {
    const received: Buffer[] = [];
    const server: Server = createServer(socket => {
        let buffer = Buffer.alloc(0);
        socket.on('data', d => {
            buffer = Buffer.concat([buffer, d]);
            if (buffer.subarray(0, 6).toString() === 'zPING\0') { socket.end('PONG\0'); return; }
            const command = 'zINSTREAM\0';
            if (buffer.length < command.length) return;
            let at = command.length;
            const parts: Buffer[] = [];
            while (buffer.length >= at + 4) {
                const size = buffer.readUInt32BE(at);
                if (size === 0) {
                    const payload = Buffer.concat(parts);
                    received.push(payload);
                    const reply = answer(payload);
                    if (reply !== null) socket.end(reply + '\0');
                    return;
                }
                if (buffer.length < at + 4 + size) return;
                parts.push(buffer.subarray(at + 4, at + 4 + size));
                at += 4 + size;
            }
        });
    });
    return new Promise<{ port: number; received: Buffer[]; close: () => Promise<void> }>(resolve => server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        resolve({ port: typeof address === 'object' && address ? address.port : 0, received, close: () => new Promise(r => server.close(() => r())) });
    }));
}

test('clamd replies are read strictly', () => {
    assert.deepEqual(readVerdict('stream: OK'), { clean: true });
    assert.deepEqual(readVerdict('stream: Win.Test.EICAR_HDB-1 FOUND'), { clean: false, signature: 'Win.Test.EICAR_HDB-1' });
    assert.throws(() => readVerdict('INSTREAM size limit exceeded. ERROR'), ScannerUnavailable);
    assert.throws(() => readVerdict(''), ScannerUnavailable);
    assert.throws(() => readVerdict('stream: maybe'), ScannerUnavailable);
});
test('the clamd client streams every byte in length-prefixed chunks and reads the verdict', async () => {
    const clamd = await fakeClamd(p => p.includes(MARKER) ? 'stream: Reunir.Test.Flag FOUND' : 'stream: OK');
    try {
        const scanner = clamdScanner({ host: '127.0.0.1', port: clamd.port, chunkBytes: 1000 });
        const clean = randomBytes(4500);
        assert.deepEqual(await scanner.scan(clean), { clean: true });
        assert(clamd.received.at(-1)!.equals(clean), 'all bytes arrive in order across several chunks');
        assert.deepEqual(await scanner.scan(Buffer.from(`%PDF-1.4 ${MARKER}`)), { clean: false, signature: 'Reunir.Test.Flag' });
        assert.deepEqual(await scanner.scan(new Uint8Array()), { clean: true });
        assert.equal(await scanner.ping(), true);
    } finally { await clamd.close(); }
});
test('an unreachable, silent or erroring scanner is unavailable, never clean', async () => {
    const silent = await fakeClamd(() => null), erroring = await fakeClamd(() => 'INSTREAM size limit exceeded. ERROR');
    try {
        await assert.rejects(clamdScanner({ host: '127.0.0.1', port: silent.port, timeoutMs: 200 }).scan(Buffer.from('x')), ScannerUnavailable);
        await assert.rejects(clamdScanner({ host: '127.0.0.1', port: erroring.port }).scan(Buffer.from('x')), ScannerUnavailable);
    } finally { await silent.close(); await erroring.close(); }
    const closed = await fakeClamd(() => 'stream: OK'); const port = closed.port; await closed.close();
    const gone = clamdScanner({ host: '127.0.0.1', port, timeoutMs: 1000 });
    await assert.rejects(gone.scan(Buffer.from('x')), ScannerUnavailable);
    assert.equal(await gone.ping(), false);
});
test('a large file gets a longer scan allowance than a small one', () => {
    const o = { timeoutMs: 30_000, msPerMegabyte: 1_000 };
    assert.equal(scanTimeoutMs(o, 0), 30_000);
    assert.equal(scanTimeoutMs(o, 10 * 1024 * 1024), 40_000);
    assert.equal(scanTimeoutMs(o, 200 * 1024 * 1024), 230_000, 'a 200 MB lesson video is not cut off at 30 s');
});
test('the server builds a scanner only when CLAMAV_HOST is set', () => {
    assert.equal(scannerFromEnvironment({}), undefined);
    assert(scannerFromEnvironment({ CLAMAV_HOST: 'clamav.internal', CLAMAV_PORT: '3310' }));
    assert.throws(() => scannerFromEnvironment({ CLAMAV_HOST: 'clamav.internal', CLAMAV_PORT: '99999' }), /CLAMAV_PORT/);
});

const cfg = { NODE_ENV: 'production', APP_ORIGIN: 'https://community.example.test', DATABASE_URL: 'postgresql://reunir_app:x@db.example.test/reunir', BETTER_AUTH_SECRET: randomBytes(32).toString('base64url'), VITE_DATA_MODE: 'live' };
const scanning = (extra: Record<string, string | undefined>) => inspectConfiguration({ ...cfg, ...extra }).find(c => c.key === 'upload-scanning')!;
test('scanning is required by default in production, optional elsewhere, and anything else is refused', () => {
    assert.equal(uploadScanningSetting({ NODE_ENV: 'production' }), 'required');
    assert.equal(uploadScanningSetting({ NODE_ENV: 'development' }), 'optional');
    assert.equal(uploadScanningSetting({ UPLOAD_SCANNING: 'sometimes' }), null);
    assert.equal(scanning({ UPLOAD_SCANNING: 'sometimes' }).state, 'blocked');
    assert.throws(() => validateRuntimeConfiguration({ ...cfg, UPLOAD_SCANNING: 'sometimes' }), /upload-scanning/);
});
test('production with a bucket will not start without a scanner unless scanning is made optional', () => {
    assert.equal(scanning({}).state, 'pass', 'no bucket means nothing to scan');
    assert.doesNotThrow(() => validateRuntimeConfiguration(cfg));
    assert.equal(scanning({ GCS_BUCKET: 'private' }).state, 'blocked');
    assert.throws(() => validateRuntimeConfiguration({ ...cfg, GCS_BUCKET: 'private' }), /upload-scanning/);
    assert.equal(scanning({ GCS_BUCKET: 'private', UPLOAD_SCANNING: 'optional' }).state, 'warning');
    assert.doesNotThrow(() => validateRuntimeConfiguration({ ...cfg, GCS_BUCKET: 'private', UPLOAD_SCANNING: 'optional' }));
    assert.equal(scanning({ GCS_BUCKET: 'private', CLAMAV_HOST: 'clamav.internal' }).state, 'unverified', 'configured is not the same as reachable');
    assert.throws(() => validateRuntimeConfiguration({ ...cfg, GCS_BUCKET: 'private', CLAMAV_HOST: 'clamav.internal', CLAMAV_PORT: 'clam' }), /upload-scanning/);
    assert(!JSON.stringify(scanning({ GCS_BUCKET: 'private', CLAMAV_HOST: 'clamav.internal' })).includes('clamav.internal'), 'the report never repeats the host');
});

const origin = 'https://reunir.test', base = '/api/organisations/code-black';
let db: Database, app: ReturnType<typeof createApp>, bucket: FakeBucket, scanner: FakeScanner;
const post = (path: string, body: unknown) => app.request(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, 'Idempotency-Key': randomUUID() }, body: JSON.stringify(body) });
const status = async (id: string) => (await db.query<{ status: string }>('SELECT status FROM upload_intents WHERE id=$1', [id])).rows[0].status;
async function start(body: Record<string, unknown>, bytes: Uint8Array, contentType: string) {
    const r = await post('/uploads', { ...body, contentType, sizeBytes: bytes.length });
    assert.equal(r.status, 201);
    const { id } = await r.json(), key = bucket.policies.at(-1)!.key;
    bucket.put(key, bytes, contentType);
    return { id: id as string, key, complete: () => post(`/uploads/${id}/complete`, {}) };
}
const pdf = (text: string) => new TextEncoder().encode(`%PDF-1.4\n% ${text}\n${'x'.repeat(5000)}`);
const jpeg = (tail = '') => { const b = new Uint8Array(9000); b.set(jpegHeader(1600, 900)); b.set(new TextEncoder().encode(tail), 8000); return b; };
const lesson = { purpose: 'lesson_resource', trackId: 'track_product', name: 'notes.pdf' };

before(async () => {
    db = await openDatabase('pglite:memory'); await migrate(db);
    const repo = new WorkspaceRepository(db); await repo.seed(createSeed());
    bucket = new FakeBucket(); scanner = new FakeScanner();
    app = createApp({ repository: repo, origin, resolveSession: async () => ({ id: DEMO_ADMIN, name: 'Amina' }), storage: bucket, scanner });
});
after(async () => db?.close());

test('capabilities say when uploads are scanned', async () => {
    assert.equal((await (await app.request('/api/account/capabilities')).json()).uploadScanning, true);
    const plain = createApp({ repository: new WorkspaceRepository(db), origin, resolveSession: async () => null, storage: bucket });
    assert.equal((await (await plain.request('/api/account/capabilities')).json()).uploadScanning, false);
});
test('a clean lesson file is scanned whole, at the generation it records, then becomes ready', async () => {
    const bytes = pdf('clean'), u = await start(lesson, bytes, 'application/pdf');
    const done = await u.complete();
    assert.equal(done.status, 200);
    assert.deepEqual(Buffer.from(scanner.scanned.at(-1)!), Buffer.from(bytes), 'every byte was scanned, not just the signature');
    assert.equal(bucket.reads.at(-1)!.generation, bucket.objects.get(u.key)!.generation);
    assert.equal(await status(u.id), 'ready');
});
test('a flagged lesson file is rejected and deleted, with its own message', async () => {
    const u = await start(lesson, pdf(MARKER), 'application/pdf');
    const done = await u.complete(), body = await done.json();
    assert.equal(done.status, 422); assert.equal(body.error.code, 'FILE_FLAGGED');
    assert.match(body.error.message, /virus scanner/);
    assert.equal(await status(u.id), 'rejected');
    assert(bucket.removed.includes(u.key)); assert(!bucket.objects.has(u.key));
    assert.equal((await u.complete()).status, 409, 'a flagged file cannot be completed again');
});
test('while the scanner is down the upload stays pending and succeeds on retry', async () => {
    const u = await start(lesson, pdf('retry'), 'application/pdf');
    scanner.down = true;
    const failed = await u.complete();
    assert.equal(failed.status, 503); assert.equal((await failed.json()).error.code, 'SCAN_UNAVAILABLE');
    assert.equal(await status(u.id), 'pending'); assert(bucket.objects.has(u.key), 'nothing is deleted without a verdict');
    scanner.down = false;
    assert.equal((await u.complete()).status, 200);
    assert.equal(await status(u.id), 'ready');
});
test('cover pictures are scanned too', async () => {
    const clean = await start({ purpose: 'cover_image', subject: 'track', subjectId: 'track_story' }, jpeg(), 'image/jpeg');
    assert.equal((await clean.complete()).status, 200);
    const flagged = await start({ purpose: 'cover_image', subject: 'track', subjectId: 'track_story' }, jpeg(MARKER), 'image/jpeg');
    const done = await flagged.complete();
    assert.equal(done.status, 422); assert.equal((await done.json()).error.code, 'FILE_FLAGGED');
    assert.equal(await status(flagged.id), 'rejected'); assert(!bucket.objects.has(flagged.key));
});
test('a cover\'s small copy is scanned too; a flagged copy is deleted and the picture kept', async () => {
    const webp = (tail = '') => { const b = new Uint8Array(2000); b.set(webpHeader(480, 270)); b.set(new TextEncoder().encode(tail), 1500); return b; };
    const send = async (thumb: Uint8Array) => {
        const r = await post('/uploads', { purpose: 'cover_image', subject: 'track', subjectId: 'track_story', contentType: 'image/jpeg', sizeBytes: 9000, thumbnail: { contentType: 'image/webp', sizeBytes: thumb.length } });
        assert.equal(r.status, 201);
        const { id } = await r.json(), [main, small] = bucket.policies.slice(-2);
        bucket.put(main.key, jpeg(), 'image/jpeg'); bucket.put(small.key, thumb, 'image/webp');
        const done = await post(`/uploads/${id}/complete`, {});
        const row = (await db.query<{ status: string; thumbnail_object_key: string | null }>('SELECT status,thumbnail_object_key FROM upload_intents WHERE id=$1', [id])).rows[0];
        return { done, row, key: main.key, thumbKey: small.key };
    };
    const clean = await send(webp());
    assert.equal(clean.done.status, 200);
    assert.deepEqual(Buffer.from(scanner.scanned.at(-1)!), Buffer.from(webp()), 'the whole small copy was scanned');
    assert.equal(clean.row.thumbnail_object_key, clean.thumbKey);
    const flagged = await send(webp(MARKER));
    assert.equal(flagged.done.status, 200, 'the picture itself is clean and is kept');
    assert.equal(flagged.row.status, 'ready'); assert.equal(flagged.row.thumbnail_object_key, null);
    assert(bucket.objects.has(flagged.key)); assert(!bucket.objects.has(flagged.thumbKey), 'the flagged copy is deleted');
});
test('member attachments are scanned, and a flagged one cannot be revived by uploading again', async () => {
    const clean = await start({ name: 'plan.pdf' }, pdf('member'), 'application/pdf');
    assert.equal((await clean.complete()).status, 200);
    const flagged = await start({ name: 'plan.pdf' }, pdf(MARKER), 'application/pdf');
    const done = await flagged.complete();
    assert.equal(done.status, 422); assert.equal((await done.json()).error.code, 'FILE_FLAGGED');
    assert.equal(await status(flagged.id), 'rejected'); assert(!bucket.objects.has(flagged.key));
    bucket.put(flagged.key, pdf('a different file'), 'application/pdf');
    const again = await flagged.complete();
    assert.equal(again.status, 409); assert.equal((await again.json()).error.code, 'FILE_REJECTED');
    assert.equal(await status(flagged.id), 'rejected');
});
