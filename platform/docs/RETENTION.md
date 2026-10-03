# Data retention

How long REUNIR keeps things. The rules live in `packages/contracts/src/retention.ts`; the retention job, this page and the **How long things are kept** panel on Your account all read the same list.

## What people make

| What | Kept | Why |
| --- | --- | --- |
| Your account, profile and sign-in | Until you delete your account | Deleting it removes them in every community at once. |
| Posts, comments, project work, lessons and messages you sent | As long as the community keeps them | Other people rely on them. If you delete your account they stay, shown as Former member. |
| Your learning record, private goals and saved posts | Until you delete your account | An owner can also authorise erasing your knowledge-check answers on request. |
| Reviewed evidence and the audit trail | As long as the community exists | Reviews and decisions stay accountable. Nothing reviewed is rewritten. |

## Housekeeping the job clears

| Record | Cleared |
| --- | --- |
| Sign-in sessions | 1 day after they expire (sessions last seven days and renew daily while used) |
| Confirmation and password reset links | 1 day after they expire |
| Rate counters | 1 day after they were last touched |
| Request receipts (stop a request being applied twice) | 30 days |
| Internal change events | 90 days |
| Sent and cancelled mail records | 90 days (contents are cleared when sent or cancelled) |
| Contents of mail that could not be delivered | 30 days after it finally failed; the record itself at 90 |
| Notices you have read | 180 days after you read them. Unread notices stay. |

Queued mail is never touched.

## Running it

`npm run retention:run` is a dry run: it prints counts per rule and changes nothing. `RETENTION=apply npm run retention:run` clears them. On a server, an authenticated `GET /api/internal/retention` with `Authorization: Bearer <CRON_SECRET>` applies the rules, and `?dry=1` only counts. Schedule it once a day, which needs `CRON_SECRET` even on a server without mail; see [PILOT_OPERATIONS.md](PILOT_OPERATIONS.md). Nothing is scheduled by this release.

The job uses the normal runtime role. It lists communities through one read-only policy that applies only when its own transaction says it is the retention worker (migration 0023), then clears each community's records inside that community's tenant context.

## Known limits

- The periods are the same for every community. Per-community settings are not built.
- The audit trail is kept for the life of the community. A retention period for it needs a decision by the owner.
- Database backups follow the provider's own retention settings.
