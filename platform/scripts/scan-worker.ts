/**
 * The virus scan worker (decision 042). Run it beside clamd, on the private network that reaches it, with the same
 * DATABASE_URL (the restricted runtime role), GCS_BUCKET and CLAMAV_HOST as the API. It needs no sign-in secret and serves
 * nothing. `--once` runs a single pass and exits, for a scheduler; otherwise it keeps polling until stopped.
 */
import './env';
import { setTimeout as sleep } from 'node:timers/promises';
import { openDatabase } from '../packages/db/src/connection';
import { WorkspaceRepository } from '../packages/db/src/repository';
import { requireSafeRuntimeRole } from '../packages/db/src/runtime-safety';
import { ScanQueue } from '../packages/db/src/scans';
import { scannerFromEnvironment } from '../apps/api/src/scanner';
import { googleStorage } from '../apps/api/src/storage';
import { uploadCompletion } from '../apps/api/src/uploads';
import { scanWaitingUploads } from '../apps/api/src/scan-worker';

const { DATABASE_URL, GCS_BUCKET, GCS_CREDENTIALS_JSON } = process.env;
const scanner = scannerFromEnvironment(process.env);
if (!DATABASE_URL || !GCS_BUCKET || !scanner) {
    console.error('Set DATABASE_URL, GCS_BUCKET and CLAMAV_HOST for the scan worker.');
    process.exit(2);
}
const once = process.argv.includes('--once');
const idleMs = Math.max(1000, Number(process.env.SCAN_WORKER_IDLE_MS) || 3000);
const db = await openDatabase(DATABASE_URL);
let stopping = false;
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => { stopping = true; });
try {
    if (process.env.NODE_ENV === 'production') await requireSafeRuntimeRole(db);
    const repository = new WorkspaceRepository(db), queue = new ScanQueue(repository), storage = googleStorage(GCS_BUCKET, GCS_CREDENTIALS_JSON);
    const complete = uploadCompletion({ repository, storage, scans: queue, remove: async (requestId, keys) => {
        for (const key of keys) {
            try { await storage.remove(key); }
            catch { console.error(JSON.stringify({ event: 'storage.remove.failed', requestId })); }
        }
    } });
    console.log(JSON.stringify({ event: 'scan-worker.started', once }));
    do {
        let pass;
        try { pass = await scanWaitingUploads({ queue, storage, scanner, complete }); }
        catch (error) {
            // A database or storage outage: say so without details that could carry keys, and try again after a pause.
            console.error(JSON.stringify({ event: 'scan-worker.pass-failed', reason: error instanceof Error ? error.name : 'error' }));
            await queue.observe('error').catch(() => {});
            if (once) process.exitCode = 1;
        }
        if (pass?.claimed) console.log(JSON.stringify({ event: 'scan-worker.pass', ...pass }));
        if (!once && !stopping && !pass?.claimed) await sleep(idleMs);
    } while (!once && !stopping);
} finally {
    await db.close();
}
