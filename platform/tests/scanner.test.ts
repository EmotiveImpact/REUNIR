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
import { ScannerUnavailable, clamdScanner, readVerdict, scanTimeoutMs, scannerFromEnvironment, type FileScanner, type ScanSource } from '../apps/api/src/scanner';
import { ScanQueue, SCAN_GIVE_UP_MS, scanRetryDelayMs } from '../packages/db/src/scans';
import { scanWaitingUploads } from '../apps/api/src/scan-worker';
import { uploadCompletion } from '../apps/api/src/uploads';
import { FakeBucket } from './helpers/fake-bucket';
import { jpegHeader, webpHeader } from './helpers/images';

/** Stands in for clamd. Anything containing the marker is flagged; `down` makes every scan unavailable. */
const MARKER = 'REUNIR-TEST-FLAG';
class FakeScanner implements FileScanner {
    down = false;
    scanned: Uint8Array[] = [];
    async scan(source: ScanSource) {
        if (this.down) throw new ScannerUnavailable('connection');
        const parts: Uint8Array[] = [];
        if (source instanceof Uint8Array) parts.push(source); else for await (const piece of source.chunks) parts.push(piece);
        const bytes = Buffer.concat(parts);
        this.scanned.push(bytes);
        return bytes.includes(MARKER) ? { clean: false as const, signature: 'Reunir.Test.Flag' } : { clean: true as const };
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
test('the clamd client streams pieces from storage without holding the whole file, and stops once clamd answers', async () => {
    const clamd = await fakeClamd(p => p.includes(MARKER) ? 'stream: Reunir.Test.Flag FOUND' : 'stream: OK');
    try {
        const scanner = clamdScanner({ host: '127.0.0.1', port: clamd.port, chunkBytes: 700 });
        const whole = randomBytes(5000);
        async function* pieces() { for (let at = 0; at < whole.length; at += 1800) yield whole.subarray(at, at + 1800); }
        assert.deepEqual(await scanner.scan({ chunks: pieces(), size: whole.length }), { clean: true });
        assert(clamd.received.at(-1)!.equals(whole), 'pieces are re-cut into clamd chunks and arrive in order');
        await assert.rejects(scanner.scan({ chunks: (async function* () { yield Buffer.from('%PDF'); throw Object.assign(new Error('gone'), { code: 404 }); })(), size: 10 }),
            (e: unknown) => !(e instanceof ScannerUnavailable) && (e as { code?: number }).code === 404, 'a storage error is reported as itself, not as an unavailable scanner');
    } finally { await clamd.close(); }
    // clamd answers as soon as a stream passes its StreamMaxLength, without waiting for the end.
    const early = createServer(socket => { let seen = 0; socket.on('error', () => {}); socket.on('data', d => { seen += d.length; if (seen > 20_000) socket.end('INSTREAM size limit exceeded. ERROR\0', () => socket.destroy()); }); });
    await new Promise<void>(r => early.listen(0, '127.0.0.1', () => r()));
    try {
        let read = 0;
        async function* endless() { while (true) { read++; yield new Uint8Array(1000); } }
        const port = (early.address() as { port: number }).port;
        await assert.rejects(clamdScanner({ host: '127.0.0.1', port, timeoutMs: 5000 }).scan({ chunks: endless(), size: 10 ** 9 }), ScannerUnavailable);
        assert(read < 1000, 'reading stops once clamd has answered');
    } finally { early.close(); }
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
let db: Database, repo: WorkspaceRepository, app: ReturnType<typeof createApp>, bucket: FakeBucket, scanner: FakeScanner, queue: ScanQueue;
const logged: Record<string, unknown>[] = [];
const post = (path: string, body: unknown) => app.request(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, 'Idempotency-Key': randomUUID() }, body: JSON.stringify(body) });
const status = async (id: string) => (await db.query<{ status: string }>('SELECT status FROM upload_intents WHERE id=$1', [id])).rows[0].status;
const scanRow = async (id: string) => (await db.query<{ status: string; generation: string; attempts: number }>('SELECT status,generation,attempts FROM upload_scans WHERE upload_id=$1', [id])).rows[0];
/** One pass of the worker, as `npm run scan:worker` runs it, completing uploads for their uploaders. */
const work = () => scanWaitingUploads({ queue, storage: bucket, scanner, complete: uploadCompletion({ repository: repo, storage: bucket, scans: queue, remove: async (_, keys) => { for (const k of keys) await bucket.remove(k); } }), limit: 20, log: e => logged.push(e) });
async function start(body: Record<string, unknown>, bytes: Uint8Array, contentType: string) {
    const r = await post('/uploads', { ...body, contentType, sizeBytes: bytes.length });
    assert.equal(r.status, 201);
    const { id } = await r.json(), key = bucket.policies.at(-1)!.key;
    bucket.put(key, bytes, contentType);
    return { id: id as string, key, complete: () => post(`/uploads/${id}/complete`, {}) };
}
/** Completes once (the file waits), lets the worker scan it, then asks again as the browser does. */
async function scanned(u: { id: string; complete: () => Response | Promise<Response> }) {
    const first = await u.complete();
    assert.equal(first.status, 202); assert.deepEqual(await first.json(), { id: u.id, status: 'scanning' });
    assert.equal(await status(u.id), 'pending', 'nothing is usable while it waits');
    await work();
    return u.complete();
}
const pdf = (text: string) => new TextEncoder().encode(`%PDF-1.4\n% ${text}\n${'x'.repeat(5000)}`);
const jpeg = (tail = '') => { const b = new Uint8Array(9000); b.set(jpegHeader(1600, 900)); b.set(new TextEncoder().encode(tail), 8000); return b; };
const lesson = { purpose: 'lesson_resource', trackId: 'track_product', name: 'notes.pdf' };

before(async () => {
    db = await openDatabase('pglite:memory'); await migrate(db);
    repo = new WorkspaceRepository(db); await repo.seed(createSeed());
    bucket = new FakeBucket(); scanner = new FakeScanner(); queue = new ScanQueue(repo);
    app = createApp({ repository: repo, origin, resolveSession: async () => ({ id: DEMO_ADMIN, name: 'Amina' }), storage: bucket, scans: queue });
});
after(async () => db?.close());

test('capabilities say when uploads are scanned', async () => {
    assert.equal((await (await app.request('/api/account/capabilities')).json()).uploadScanning, true);
    const plain = createApp({ repository: new WorkspaceRepository(db), origin, resolveSession: async () => null, storage: bucket });
    assert.equal((await (await plain.request('/api/account/capabilities')).json()).uploadScanning, false);
});
test('completing reads only the first bytes; the worker streams the whole generation to the scanner, then it becomes ready', async () => {
    const bytes = pdf('clean'), u = await start(lesson, bytes, 'application/pdf');
    const first = await u.complete();
    assert.equal(first.status, 202);
    assert(bucket.reads.filter(r => r.key === u.key).every(r => r.bytes < bytes.length), 'the request never reads the whole file');
    assert.equal((await scanRow(u.id)).generation, bucket.objects.get(u.key)!.generation, 'the scan is pinned to the measured generation');
    assert.equal((await u.complete()).status, 202, 'asking again while it waits changes nothing');
    const pass = await work();
    assert.equal(pass.clean, 1);
    assert.deepEqual(Buffer.from(scanner.scanned.at(-1)!), Buffer.from(bytes), 'every byte was scanned, not just the signature');
    assert.deepEqual(bucket.streams.at(-1), { key: u.key, generation: bucket.objects.get(u.key)!.generation }, 'streamed from the generation it records');
    assert.equal(await status(u.id), 'ready', 'the worker completed it without the browser');
    const again = await u.complete();
    assert.equal(again.status, 200); assert.equal((await again.json()).upload.id, u.id);
});
test('a flagged lesson file is rejected and deleted, and says so every time it is asked about', async () => {
    const u = await start(lesson, pdf(MARKER), 'application/pdf');
    const done = await scanned(u), body = await done.json();
    assert.equal(done.status, 422); assert.equal(body.error.code, 'FILE_FLAGGED');
    assert.match(body.error.message, /virus scanner/);
    assert.equal(await status(u.id), 'rejected');
    assert(bucket.removed.includes(u.key)); assert(!bucket.objects.has(u.key));
    assert(logged.some(e => e.event === 'upload.scan.flagged' && e.signature === 'Reunir.Test.Flag' && e.uploadId === u.id));
    assert(!JSON.stringify(logged).includes('notes.pdf'), 'logs never carry the file name');
    bucket.put(u.key, pdf('a different file'), 'application/pdf');
    const again = await u.complete();
    assert.equal(again.status, 422, 'a flagged file cannot be completed again'); assert.equal(await status(u.id), 'rejected');
});
test('while the scanner is down the upload waits, unserved and undeleted, and is scanned once it is back', async () => {
    const u = await start(lesson, pdf('retry'), 'application/pdf');
    assert.equal((await u.complete()).status, 202);
    scanner.down = true;
    const pass = await work();
    assert.equal(pass.retried, 1);
    assert.equal(await status(u.id), 'pending'); assert(bucket.objects.has(u.key), 'nothing is deleted without a verdict');
    assert.equal((await scanRow(u.id)).status, 'queued');
    assert.equal((await u.complete()).status, 202, 'no verdict is never treated as clean');
    assert(logged.some(e => e.event === 'upload.scan.unavailable' && e.uploadId === u.id));
    assert.equal((await db.query<{ state: string }>("SELECT state FROM service_observations WHERE name='scan-worker'")).rows[0].state, 'error');
    scanner.down = false;
    await db.query("UPDATE upload_scans SET available_at=now() WHERE upload_id=$1", [u.id]);
    assert.equal((await work()).clean, 1);
    assert.equal(await status(u.id), 'ready');
    assert.equal((await db.query<{ state: string }>("SELECT state FROM service_observations WHERE name='scan-worker'")).rows[0].state, 'ok');
});
test('a file replaced after its scan was asked for is scanned again as it now stands', async () => {
    const u = await start(lesson, pdf('a harmless first file'.slice(0, MARKER.length)), 'application/pdf');
    assert.equal((await u.complete()).status, 202);
    const before = (await scanRow(u.id)).generation;
    bucket.put(u.key, pdf(MARKER), 'application/pdf');
    assert.equal((await u.complete()).status, 202);
    assert.notEqual((await scanRow(u.id)).generation, before, 'the newer generation replaces the request');
    await work();
    assert.equal(await status(u.id), 'rejected', 'the verdict belongs to the bytes that would be served');
});
test('a generation that vanishes before its scan is dropped, and the next completion measures the file again', async () => {
    const u = await start(lesson, pdf('vanishing'), 'application/pdf');
    assert.equal((await u.complete()).status, 202);
    const generation = bucket.objects.get(u.key)!.generation;
    bucket.objects.set(u.key, { ...bucket.objects.get(u.key)!, generation: String(Number(generation) + 1) });
    assert.equal((await work()).dropped, 1);
    assert.equal(await scanRow(u.id), undefined);
    assert.equal(await status(u.id), 'pending');
    assert.equal((await u.complete()).status, 202);
    await work();
    assert.equal(await status(u.id), 'ready');
});
test('a file that fails its quick checks is refused at once, without waiting for a scan', async () => {
    const u = await start(lesson, new TextEncoder().encode('not a pdf at all'.repeat(10)), 'application/pdf');
    const done = await u.complete();
    assert.equal(done.status, 400); assert.equal((await done.json()).error.code, 'FILE_MISMATCH');
    assert.equal(await scanRow(u.id), undefined);
});
test('cover pictures are scanned too', async () => {
    const clean = await start({ purpose: 'cover_image', subject: 'track', subjectId: 'track_story' }, jpeg(), 'image/jpeg');
    assert.equal((await scanned(clean)).status, 200);
    const flagged = await start({ purpose: 'cover_image', subject: 'track', subjectId: 'track_story' }, jpeg(MARKER), 'image/jpeg');
    const done = await scanned(flagged);
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
        const done = await scanned({ id, complete: () => post(`/uploads/${id}/complete`, {}) });
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
test('member attachments are scanned, served at the scanned generation, and a flagged one cannot be revived', async () => {
    const clean = await start({ name: 'plan.pdf' }, pdf('member'), 'application/pdf');
    assert.equal((await scanned(clean)).status, 200);
    const link = await (await app.request(`${base}/uploads/${clean.id}/download`)).json();
    assert.match(link.url, new RegExp(`generation=${bucket.objects.get(clean.key)!.generation}`), 'the download is pinned to what was scanned');
    const flagged = await start({ name: 'plan.pdf' }, pdf(MARKER), 'application/pdf');
    const done = await scanned(flagged);
    assert.equal(done.status, 422); assert.equal((await done.json()).error.code, 'FILE_FLAGGED');
    assert.equal(await status(flagged.id), 'rejected'); assert(!bucket.objects.has(flagged.key));
    bucket.put(flagged.key, pdf('a different file'), 'application/pdf');
    const again = await flagged.complete();
    assert.equal(again.status, 422); assert.equal(await status(flagged.id), 'rejected');
});
test('the worker completes for the uploader as they stand now: a removed member\'s file is not made ready', async () => {
    const u = await start(lesson, pdf('left'), 'application/pdf');
    assert.equal((await u.complete()).status, 202);
    await db.query("UPDATE members SET status='suspended' WHERE organization_id='org_code_black' AND user_id=$1", [DEMO_ADMIN]);
    try { await work(); }
    finally { await db.query("UPDATE members SET status='active' WHERE organization_id='org_code_black' AND user_id=$1", [DEMO_ADMIN]); }
    assert.equal(await status(u.id), 'pending');
    assert(logged.some(e => e.event === 'upload.scan.completion-refused' && e.uploadId === u.id));
    assert.equal((await u.complete()).status, 200, 'the recorded verdict still counts once they are back');
});
test('scan claims are leased, retried with growing waits, and abandoned after a day', async () => {
    assert.deepEqual([1, 2, 3, 5, 9].map(scanRetryDelayMs), [60_000, 120_000, 240_000, 900_000, 900_000]);
    const u = await start(lesson, pdf('stale'), 'application/pdf');
    assert.equal((await u.complete()).status, 202);
    const first = await queue.claim(5, () => 60_000), second = await queue.claim(5, () => 60_000);
    assert(first.jobs.some(j => j.uploadId === u.id)); assert(!second.jobs.some(j => j.uploadId === u.id), 'a held claim is not claimed twice');
    await db.query("UPDATE upload_scans SET lease_until=now()-interval '1 second' WHERE upload_id=$1", [u.id]);
    const third = await queue.claim(5, () => 60_000);
    assert(third.jobs.some(j => j.uploadId === u.id && j.attempts === 2), 'an expired lease is taken over');
    assert.equal(await queue.record(first.jobs.find(j => j.uploadId === u.id)!, { clean: true, thumbnailClean: null }), false, 'the earlier holder can no longer record a verdict');
    await db.query("UPDATE upload_scans SET status='queued',lease_token=NULL,lease_until=NULL,queued_at=now()-($2::double precision*interval '1 millisecond')-interval '1 minute' WHERE upload_id=$1", [u.id, SCAN_GIVE_UP_MS]);
    assert.equal((await queue.claim(5, () => 60_000)).abandoned, 1);
    assert.equal(await scanRow(u.id), undefined); assert.equal(await status(u.id), 'pending', 'an abandoned scan never makes a file usable');
});
