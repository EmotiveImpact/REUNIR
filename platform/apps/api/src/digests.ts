import type { Database } from '../../../packages/db/src/connection';
import { setContext } from '../../../packages/db/src/repository';
import { DIGEST_ITEMS, DIGEST_PERIOD_MS, type DigestFrequency } from '../../../packages/contracts/src/notifications';
import type { MailQueue } from './mail';

interface Due { organization_id: string; user_id: string; digest: Exclude<DigestFrequency, 'off'>; since: Date }
interface Notice { title: string; body: string; href: string; created_at: Date }

/** The email for one member and community. Plain text, with absolute links into the application only. */
export function digestEmail(community: string, origin: string, frequency: 'daily' | 'weekly', notices: Notice[], total: number) {
    const lines = notices.slice(0, DIGEST_ITEMS).map(n => `- ${n.title}\n  ${n.body}\n  ${new URL(n.href.startsWith('/') ? n.href : '/', origin).toString()}`);
    const rest = total - lines.length;
    return {
        subject: `Your ${frequency} ${community} digest: ${total} ${total === 1 ? 'notice' : 'notices'} you have not read`,
        text: [`Here is what you have not read in ${community}.`, '', ...lines, ...(rest > 0 ? ['', `And ${rest} more in REUNIR.`] : []), '',
            `Read them all: ${new URL('/notifications', origin)}`, `Change or stop these emails from Notification settings on that page.`].join('\n'),
    };
}

/**
 * Queues digest emails for members who asked for them and whose period has passed. Each member is handled in their own
 * tenant context, so row security applies as for any request; only the list of who is due is read across communities.
 * The mail queue then sends as usual. Runs from the scheduled internal route; never started automatically.
 */
export class DigestService {
    constructor(private readonly db: Database, private readonly mail: MailQueue, private readonly origin: string) {}

    async run(now = new Date(), limit = 100) {
        if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new Error('Digest batch must be an integer from 1 to 500.');
        const due = await this.db.transaction(async sql => {
            await sql.query("SELECT set_config('app.worker','digest',true)");
            const rows = await sql.query<Due>(`SELECT organization_id,user_id,digest,coalesce(last_digest_at,updated_at) AS since FROM notification_preferences
                WHERE digest<>'off' AND coalesce(last_digest_at,updated_at) <= $1::timestamptz - (CASE digest WHEN 'daily' THEN $2::bigint ELSE $3::bigint END * interval '1 millisecond')
                ORDER BY coalesce(last_digest_at,updated_at),organization_id,user_id LIMIT $4`, [now.toISOString(), DIGEST_PERIOD_MS.daily, DIGEST_PERIOD_MS.weekly, limit]);
            return rows.rows;
        });
        let queued = 0, quiet = 0, skipped = 0;
        for (const d of due) {
            const outcome = await this.db.transaction(async sql => {
                await setContext(sql, d.organization_id, d.user_id);
                // Lock the row and re-check, so two overlapping runs queue one digest.
                const row = (await sql.query<{ since: Date; digest: string }>('SELECT coalesce(last_digest_at,updated_at) AS since,digest FROM notification_preferences WHERE organization_id=$1 AND user_id=$2 FOR UPDATE', [d.organization_id, d.user_id])).rows[0];
                if (!row || row.digest === 'off' || new Date(row.since).getTime() !== new Date(d.since).getTime()) return 'skipped';
                const member = (await sql.query("SELECT 1 FROM members WHERE organization_id=$1 AND user_id=$2 AND status='active'", [d.organization_id, d.user_id])).rows[0];
                const account = (await sql.query<{ email: string }>('SELECT email FROM auth_user WHERE id=$1', [d.user_id])).rows[0];
                const stamp = () => sql.query('UPDATE notification_preferences SET last_digest_at=$3 WHERE organization_id=$1 AND user_id=$2', [d.organization_id, d.user_id, now.toISOString()]);
                if (!member || !account) { await stamp(); return 'skipped'; }
                const notices = (await sql.query<Notice>('SELECT title,body,href,created_at FROM notifications WHERE organization_id=$1 AND user_id=$2 AND read_at IS NULL AND created_at>$3 ORDER BY created_at DESC,id DESC LIMIT $4', [d.organization_id, d.user_id, new Date(d.since).toISOString(), DIGEST_ITEMS])).rows;
                const total = (await sql.query<{ n: number }>('SELECT count(*)::int AS n FROM notifications WHERE organization_id=$1 AND user_id=$2 AND read_at IS NULL AND created_at>$3', [d.organization_id, d.user_id, new Date(d.since).toISOString()])).rows[0].n;
                await stamp();
                if (!total) return 'quiet';
                const community = (await sql.query<{ name: string }>('SELECT name FROM organisations WHERE id=$1', [d.organization_id])).rows[0]?.name ?? 'your community';
                const email = digestEmail(community, this.origin, d.digest, notices, total);
                await this.mail.enqueue({ to: account.email, ...email }, sql, d.organization_id);
                return 'queued';
            });
            if (outcome === 'queued') queued++; else if (outcome === 'quiet') quiet++; else skipped++;
        }
        return { due: due.length, queued, quiet, skipped };
    }
}
