import { RETENTION_RULES, retentionCutoff, type RetentionCounts, type RetentionRule } from '../../contracts/src/retention';
import type { Database, SQL } from './connection';
import { setContext } from './repository';

/** Thrown inside a dry run's transaction so that everything it counted is rolled back. */
class DryRun extends Error { constructor(readonly counts: Partial<RetentionCounts>) { super('dry run'); } }

/**
 * The housekeeping in RETENTION_DAYS, cleared on schedule. Records that are not tied to a community (sessions, links, rate
 * counters, mail) are cleared directly; each community's own records (receipts, change events, read notices) inside that
 * community's tenant context, so row security applies as for any request. The job lists communities and nothing else across
 * tenants (migration 0023). A dry run does the same work and rolls it back, so its counts are exact.
 */
export class RetentionJob {
    constructor(private readonly db: Database) {}

    async run(now = new Date(), apply = false): Promise<{ applied: boolean; counts: RetentionCounts; communities: number }> {
        const counts = Object.fromEntries(RETENTION_RULES.map(r => [r, 0])) as RetentionCounts;
        const cut = (rule: RetentionRule) => retentionCutoff(rule, now).toISOString();
        const add = (partial: Partial<RetentionCounts>) => { for (const [k, n] of Object.entries(partial)) counts[k as RetentionRule] += n ?? 0; };
        const step = async (fn: (sql: SQL) => Promise<Partial<RetentionCounts>>) => {
            try { add(await this.db.transaction(async sql => { const done = await fn(sql); if (!apply) throw new DryRun(done); return done; })); }
            catch (error) { if (error instanceof DryRun) add(error.counts); else throw error; }
        };
        const n = async (sql: SQL, query: string, params: unknown[]) => (await sql.query(query, params)).rows.length;
        if (apply) await this.observe('running');
        try {
            await step(async sql => ({
                expiredSessions: await n(sql, 'DELETE FROM auth_session WHERE expires_at<$1 RETURNING id', [cut('expiredSessions')]),
                expiredLinks: await n(sql, 'DELETE FROM auth_verification WHERE expires_at<$1 RETURNING id', [cut('expiredLinks')]),
                rateCounters: await n(sql, 'DELETE FROM request_limits WHERE window_start<$1 RETURNING key', [cut('rateCounters')])
                    + await n(sql, 'DELETE FROM auth_rate_limit WHERE last_request<$1 RETURNING id', [retentionCutoff('rateCounters', now).getTime()]),
                // Contents of undelivered mail go first; finished records, failed ones included, later.
                failedMailContents: await n(sql, "UPDATE email_outbox SET payload='' WHERE status='failed' AND payload<>'' AND created_at<$1 RETURNING id", [cut('failedMailContents')]),
                finishedMail: await n(sql, "DELETE FROM email_outbox WHERE status IN ('sent','cancelled','failed') AND coalesce(sent_at,created_at)<$1 RETURNING id", [cut('finishedMail')]),
            }));
            const communities = await this.db.transaction(async sql => {
                await sql.query("SELECT set_config('app.worker','retention',true)");
                return (await sql.query<{ id: string }>('SELECT id FROM organisations ORDER BY id')).rows.map(r => r.id);
            });
            for (const organizationId of communities)
                await step(async sql => {
                    await setContext(sql, organizationId, '');
                    return {
                        requestReceipts: await n(sql, 'DELETE FROM command_receipts WHERE organization_id=$1 AND created_at<$2 RETURNING request_key', [organizationId, cut('requestReceipts')]),
                        changeEvents: await n(sql, 'DELETE FROM outbox WHERE organization_id=$1 AND created_at<$2 RETURNING id', [organizationId, cut('changeEvents')]),
                        readNotices: await n(sql, 'DELETE FROM notifications WHERE organization_id=$1 AND read_at IS NOT NULL AND read_at<$2 RETURNING id', [organizationId, cut('readNotices')]),
                    };
                });
            if (apply) await this.observe('ok');
            return { applied: apply, counts, communities: communities.length };
        } catch (error) {
            if (apply) await this.observe('error').catch(() => {});
            throw error;
        }
    }

    private async observe(state: 'running' | 'ok' | 'error') {
        await this.db.query(`INSERT INTO service_observations(name,state,last_attempt_at,last_success_at) VALUES('retention-job',$1,now(),CASE WHEN $1='ok' THEN now() END)
            ON CONFLICT(name) DO UPDATE SET state=EXCLUDED.state,last_attempt_at=CASE WHEN $1='running' THEN now() ELSE service_observations.last_attempt_at END,last_success_at=CASE WHEN $1='ok' THEN now() ELSE service_observations.last_success_at END`, [state]);
    }
}
