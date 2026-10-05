import { randomUUID } from 'node:crypto';
import type { Database, SQL } from './connection';
import type { WorkspaceRepository } from './repository';

/** What the scanner has said about one upload's stored generation, as a request sees it. */
export interface ScanState {
    status: 'queued' | 'scanning' | 'clean' | 'flagged';
    generation: string;
    thumbnailGeneration: string | null;
    /** Only once scanned, and only for an upload with a small copy: false when that copy is to be dropped. */
    thumbnailClean: boolean | null;
}
/** The stored generation a request asks to have scanned, and its small copy's when it passed its own checks. */
export interface ScanRequest {
    generation: string;
    sizeBytes: number;
    thumbnail?: { objectKey: string; generation: string; sizeBytes: number } | null;
}
/** One claimed scan. `lease` proves this worker still holds it when the verdict is recorded. */
export interface ScanJob {
    organizationId: string;
    slug: string;
    uploadId: string;
    userId: string;
    objectKey: string;
    generation: string;
    sizeBytes: number;
    thumbnail: { objectKey: string; generation: string; sizeBytes: number } | null;
    attempts: number;
    lease: string;
}
export interface ScanVerdictRecord { clean: boolean; thumbnailClean: boolean | null }
/** A scan with no verdict after this long is given up; the upload stays unserved and a new completion asks again. */
export const SCAN_GIVE_UP_MS = 24 * 60 * 60 * 1000;
/** How long a worker holds a claimed scan: twice its scan allowance and a minute for reading it from storage. */
export const scanLeaseMs = (scanAllowanceMs: number) => 2 * scanAllowanceMs + 60_000;
/** Waits after an unavailable scanner: one minute, doubling, never more than fifteen. */
export const scanRetryDelayMs = (attempts: number) => Math.min(15, 2 ** Math.max(0, attempts - 1)) * 60_000;

const iso = (x: unknown) => x == null ? null : x instanceof Date ? x.toISOString() : String(x);

/**
 * The scan queue (migration 0040). Requests ask for and read scans inside their own community's tenant transaction. The
 * worker's transactions set `app.worker` to 'scanner', which lets them see scan rows and community slugs and nothing else.
 */
export class ScanQueue {
    constructor(private readonly repository: WorkspaceRepository) {}
    private get db(): Database { return this.repository.db; }

    /** The uploader's own scan state for one upload, or null when none has been asked for. */
    async state(slug: string, userId: string, uploadId: string): Promise<ScanState | null> {
        return this.repository.within(slug, userId, false, async (sql, org) => {
            const r = await sql.query<{ status: ScanState['status']; generation: string; thumbnail_generation: string | null; thumbnail_clean: boolean | null }>(
                'SELECT s.status,s.generation,s.thumbnail_generation,s.thumbnail_clean FROM upload_scans s JOIN upload_intents u ON u.organization_id=s.organization_id AND u.id=s.upload_id WHERE s.organization_id=$1 AND s.upload_id=$2 AND u.user_id=$3',
                [org.id, uploadId, userId]);
            const row = r.rows[0];
            return row ? { status: row.status, generation: row.generation, thumbnailGeneration: row.thumbnail_generation, thumbnailClean: row.thumbnail_clean } : null;
        });
    }

    /**
     * Asks for the given generation to be scanned. An existing request for the same generations is left alone; one for an
     * earlier generation starts again, so a verdict always belongs to the bytes that will be served.
     */
    async request(slug: string, userId: string, uploadId: string, wanted: ScanRequest): Promise<void> {
        await this.repository.within(slug, userId, true, async (sql, org) => {
            const t = wanted.thumbnail ?? null;
            const r = await sql.query(`INSERT INTO upload_scans(organization_id,upload_id,user_id,object_key,generation,size_bytes,thumbnail_object_key,thumbnail_generation,thumbnail_size_bytes)
                SELECT u.organization_id,u.id,u.user_id,u.object_key,$4,$5,$6,$7,$8 FROM upload_intents u WHERE u.organization_id=$1 AND u.id=$2 AND u.user_id=$3 AND u.status='pending'
                ON CONFLICT (organization_id,upload_id) DO UPDATE SET generation=EXCLUDED.generation,size_bytes=EXCLUDED.size_bytes,
                    thumbnail_object_key=EXCLUDED.thumbnail_object_key,thumbnail_generation=EXCLUDED.thumbnail_generation,thumbnail_size_bytes=EXCLUDED.thumbnail_size_bytes,
                    status='queued',thumbnail_clean=NULL,attempts=0,queued_at=now(),available_at=now(),lease_until=NULL,lease_token=NULL,scanned_at=NULL
                WHERE upload_scans.generation IS DISTINCT FROM EXCLUDED.generation OR upload_scans.thumbnail_generation IS DISTINCT FROM EXCLUDED.thumbnail_generation
                RETURNING upload_id`,
                [org.id, uploadId, userId, wanted.generation, wanted.sizeBytes, t?.objectKey ?? null, t?.generation ?? null, t?.sizeBytes ?? null]);
            return r.rows.length;
        });
    }

    /** In the worker's own transaction, where row security admits scan rows and community slugs across communities. */
    private async asWorker<T>(fn: (sql: SQL) => Promise<T>): Promise<T> {
        return this.db.transaction(async sql => {
            await sql.query("SELECT set_config('app.worker','scanner',true)");
            return fn(sql);
        });
    }

    /**
     * Claims up to `limit` waiting scans, oldest first, including any whose previous worker's lease has run out. Scans that
     * have waited past `SCAN_GIVE_UP_MS` are removed instead and counted in `abandoned`.
     */
    async claim(limit: number, leaseMsFor: (sizeBytes: number) => number): Promise<{ jobs: ScanJob[]; abandoned: number }> {
        return this.asWorker(async sql => {
            const abandoned = (await sql.query("DELETE FROM upload_scans WHERE status IN ('queued','scanning') AND queued_at<now()-($1::double precision*interval '1 millisecond') RETURNING upload_id", [SCAN_GIVE_UP_MS])).rows.length;
            const due = await sql.query<Record<string, unknown>>(`SELECT s.*,o.slug FROM upload_scans s JOIN organisations o ON o.id=s.organization_id
                WHERE (s.status='queued' AND s.available_at<=now()) OR (s.status='scanning' AND s.lease_until<now())
                ORDER BY s.available_at,s.queued_at LIMIT $1 FOR UPDATE OF s SKIP LOCKED`, [limit]);
            const jobs: ScanJob[] = [];
            for (const row of due.rows) {
                const lease = randomUUID(), size = Number(row.size_bytes) + Number(row.thumbnail_size_bytes ?? 0);
                await sql.query("UPDATE upload_scans SET status='scanning',attempts=attempts+1,lease_token=$3,lease_until=now()+($4::double precision*interval '1 millisecond') WHERE organization_id=$1 AND upload_id=$2",
                    [row.organization_id, row.upload_id, lease, leaseMsFor(size)]);
                jobs.push({
                    organizationId: String(row.organization_id), slug: String(row.slug), uploadId: String(row.upload_id), userId: String(row.user_id),
                    objectKey: String(row.object_key), generation: String(row.generation), sizeBytes: Number(row.size_bytes),
                    thumbnail: row.thumbnail_object_key ? { objectKey: String(row.thumbnail_object_key), generation: String(row.thumbnail_generation), sizeBytes: Number(row.thumbnail_size_bytes) } : null,
                    attempts: Number(row.attempts) + 1, lease,
                });
            }
            return { jobs, abandoned };
        });
    }

    /** Records a verdict. False when this worker no longer holds the scan (it was asked for again, or its lease was taken). */
    async record(job: ScanJob, verdict: ScanVerdictRecord): Promise<boolean> {
        return this.asWorker(async sql => (await sql.query(
            "UPDATE upload_scans SET status=$4,thumbnail_clean=$5,scanned_at=now(),lease_token=NULL,lease_until=NULL WHERE organization_id=$1 AND upload_id=$2 AND lease_token=$3 AND status='scanning' RETURNING upload_id",
            [job.organizationId, job.uploadId, job.lease, verdict.clean ? 'clean' : 'flagged', job.thumbnail ? verdict.thumbnailClean !== false : null])).rows.length > 0);
    }

    /** Puts a claimed scan back to wait, after a scanner that gave no verdict. */
    async retry(job: ScanJob, delayMs: number): Promise<void> {
        await this.asWorker(sql => sql.query(
            "UPDATE upload_scans SET status='queued',lease_token=NULL,lease_until=NULL,available_at=now()+($4::double precision*interval '1 millisecond') WHERE organization_id=$1 AND upload_id=$2 AND lease_token=$3 AND status='scanning'",
            [job.organizationId, job.uploadId, job.lease, delayMs]));
    }

    /** Removes a claimed scan whose stored generation has gone. A later completion measures the file again. */
    async drop(job: ScanJob): Promise<void> {
        await this.asWorker(sql => sql.query("DELETE FROM upload_scans WHERE organization_id=$1 AND upload_id=$2 AND lease_token=$3 AND status='scanning'", [job.organizationId, job.uploadId, job.lease]));
    }

    /** How many scans wait in one community, and since when. Counts only; never keys or names. */
    async backlog(sql: SQL, organizationId: string): Promise<{ waiting: number; oldestQueuedAt: string | null }> {
        const r = await sql.query<{ waiting: number; oldest: unknown }>("SELECT count(*)::int AS waiting,min(queued_at) AS oldest FROM upload_scans WHERE organization_id=$1 AND status IN ('queued','scanning')", [organizationId]);
        return { waiting: r.rows[0]?.waiting ?? 0, oldestQueuedAt: iso(r.rows[0]?.oldest) };
    }

    /** The worker's heartbeat for the pilot checklist: 'ok' after a pass, 'error' when the scanner gave no verdict. */
    async observe(state: 'ok' | 'error'): Promise<void> {
        await this.db.query(`INSERT INTO service_observations(name,state,last_attempt_at,last_success_at) VALUES('scan-worker',$1,now(),CASE WHEN $1='ok' THEN now() END)
            ON CONFLICT(name) DO UPDATE SET state=EXCLUDED.state,last_attempt_at=now(),last_success_at=CASE WHEN $1='ok' THEN now() ELSE service_observations.last_success_at END`, [state]);
    }
}
