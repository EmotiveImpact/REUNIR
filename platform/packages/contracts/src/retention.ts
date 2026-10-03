/**
 * How long REUNIR keeps things. Records people made or rely on stay until they or their community remove them; the
 * housekeeping records below are cleared on a fixed schedule by the retention job. One list serves the job, Your account
 * and RETENTION.md, so what people are told is what the job does.
 */

export const DAY_MS = 864e5;

/** Housekeeping the retention job clears, with how long each is kept first, in days. */
export const RETENTION_DAYS = {
    /** After a sign-in session has expired. Sessions last seven days and renew daily while used. */
    expiredSessions: 1,
    /** After a confirmation or password reset link has expired. */
    expiredLinks: 1,
    /** After a rate counter was last touched. */
    rateCounters: 1,
    /** Receipts that stop a repeated request being applied twice. */
    requestReceipts: 30,
    /** Internal change events recorded with each change; nothing reads them after the change. */
    changeEvents: 90,
    /** Sent and cancelled mail records. Their contents are already cleared when sent or cancelled. */
    finishedMail: 90,
    /** Contents of mail that could not be delivered, kept for an operator to look into; then cleared. */
    failedMailContents: 30,
    /** Notices after they were read. Unread notices stay. */
    readNotices: 180,
} as const;
export type RetentionRule = keyof typeof RETENTION_DAYS;
export const RETENTION_RULES = Object.keys(RETENTION_DAYS) as RetentionRule[];

/** What the job did, or would do, per rule. */
export type RetentionCounts = Record<RetentionRule, number>;

/** People-facing wording: what is kept, for how long, and why. Shown on Your account and in RETENTION.md. */
export const RETENTION_POLICY: { what: string; kept: string; why: string }[] = [
    { what: 'Your account, profile and sign-in', kept: 'Until you delete your account', why: 'Deleting it removes them in every community at once.' },
    { what: 'Posts, comments, project work, lessons and messages you sent', kept: 'As long as the community keeps them', why: 'Other people rely on them. If you delete your account they stay, shown as Former member.' },
    { what: 'Your learning record, private goals and saved posts', kept: 'Until you delete your account', why: 'An owner can also authorise erasing your knowledge-check answers on request.' },
    { what: 'Reviewed evidence and the audit trail', kept: 'As long as the community exists', why: 'Reviews and decisions stay accountable. Nothing reviewed is rewritten.' },
    { what: 'Notices you have read', kept: `${RETENTION_DAYS.readNotices} days after you read them`, why: 'Unread notices stay until you read them.' },
    { what: 'Sign-in sessions, confirmation and reset links', kept: 'Until they expire, then a day', why: 'Sessions last seven days while you use them; links last 30 minutes to 24 hours.' },
    { what: 'Email we sent you', kept: `Contents until sent; the record ${RETENTION_DAYS.finishedMail} days`, why: `Undelivered mail keeps its contents ${RETENTION_DAYS.failedMailContents} days so it can be looked into.` },
    { what: 'Technical records of requests and changes', kept: `${RETENTION_DAYS.requestReceipts} to ${RETENTION_DAYS.changeEvents} days`, why: 'They stop a request being applied twice and are then cleared.' },
];

/** The cut-off for a rule: anything older than this is cleared. */
export const retentionCutoff = (rule: RetentionRule, now: Date) => new Date(now.getTime() - RETENTION_DAYS[rule] * DAY_MS);
