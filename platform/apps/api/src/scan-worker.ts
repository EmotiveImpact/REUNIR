import { randomUUID } from 'node:crypto';
import { DomainError } from '../../../packages/contracts/src/index';
import { scanLeaseMs, scanRetryDelayMs, type ScanJob, type ScanQueue } from '../../../packages/db/src/scans';
import { ScannerUnavailable, scanTimeoutMs, type FileScanner, type ScanVerdict } from './scanner';
import { isMissingObject, type PrivateStorage } from './storage';
import type { CompleteUpload } from './uploads';

export interface ScanPass { claimed: number; clean: number; flagged: number; retried: number; dropped: number; abandoned: number }
type Log = (event: Record<string, unknown>) => void;
const defaultLog: Log = event => console.log(JSON.stringify(event));
/** The default clamd allowance (30 s, plus 1 s a MiB), used to size a claim's lease. */
const allowanceMs = (size: number) => scanTimeoutMs({ timeoutMs: 30_000, msPerMegabyte: 1_000 }, size);

/**
 * One pass of the scan worker (decision 042): claim waiting scans, stream each pinned generation from storage to the
 * scanner, record the verdict, then complete the upload for the person who made it, exactly as their own retry would.
 * Logs carry the upload and community IDs and a flagged file's signature name; never a file name or its contents.
 */
export async function scanWaitingUploads({ queue, storage, scanner, complete, limit = 5, log = defaultLog }: {
    queue: ScanQueue;
    storage: PrivateStorage;
    scanner: FileScanner;
    complete: CompleteUpload;
    limit?: number;
    log?: Log;
}): Promise<ScanPass> {
    const pass: ScanPass = { claimed: 0, clean: 0, flagged: 0, retried: 0, dropped: 0, abandoned: 0 };
    const { jobs, abandoned } = await queue.claim(limit, size => scanLeaseMs(allowanceMs(size)));
    pass.claimed = jobs.length; pass.abandoned = abandoned;
    if (abandoned) log({ event: 'upload.scan.abandoned', count: abandoned });
    let unavailable = false;
    for (const job of jobs) {
        const where = { organizationId: job.organizationId, uploadId: job.uploadId };
        // Once the scanner has failed in this pass, the rest wait for the next one rather than each timing out in turn.
        if (unavailable) { await queue.retry(job, 0); pass.retried++; continue; }
        let main: ScanVerdict, thumbnailClean: boolean | null = null;
        try {
            main = await scanObject(storage, scanner, job.objectKey, job.generation, job.sizeBytes);
            if (job.thumbnail && main.clean) {
                // A small copy that has gone is simply dropped; the picture itself was scanned.
                try { thumbnailClean = (await scanObject(storage, scanner, job.thumbnail.objectKey, job.thumbnail.generation, job.thumbnail.sizeBytes)).clean; }
                catch (error) { if (!isMissingObject(error)) throw error; thumbnailClean = false; }
            }
        } catch (error) {
            if (isMissingObject(error)) {
                await queue.drop(job); pass.dropped++;
                log({ event: 'upload.scan.changed', ...where });
                continue;
            }
            unavailable = true;
            await queue.retry(job, scanRetryDelayMs(job.attempts)); pass.retried++;
            log({ event: 'upload.scan.unavailable', ...where, attempts: job.attempts, reason: error instanceof ScannerUnavailable ? error.message : 'error' });
            continue;
        }
        if (!main.clean) log({ event: 'upload.scan.flagged', ...where, signature: main.signature });
        if (!(await queue.record(job, { clean: main.clean, thumbnailClean }))) { log({ event: 'upload.scan.superseded', ...where }); continue; }
        if (main.clean) pass.clean++; else pass.flagged++;
        await finish(complete, job, log);
    }
    await queue.observe(unavailable ? 'error' : 'ok');
    return pass;
}

/** Reads one exact generation in pieces where storage can, so a large video is never held whole. */
async function scanObject(storage: PrivateStorage, scanner: FileScanner, key: string, generation: string, size: number): Promise<ScanVerdict> {
    if (storage.stream) return scanner.scan({ chunks: storage.stream(key, generation), size });
    return scanner.scan(await storage.head(key, size, generation));
}

/** Completes the upload as its uploader. Refusals are expected (a flagged file, an expired upload, a role since removed). */
async function finish(complete: CompleteUpload, job: ScanJob, log: Log) {
    try { await complete(job.slug, job.userId, job.uploadId, randomUUID()); }
    catch (error) {
        if (error instanceof DomainError) {
            if (error.code !== 'FILE_FLAGGED') log({ event: 'upload.scan.completion-refused', organizationId: job.organizationId, uploadId: job.uploadId, code: error.code });
            return;
        }
        log({ event: 'upload.scan.completion-failed', organizationId: job.organizationId, uploadId: job.uploadId });
    }
}
