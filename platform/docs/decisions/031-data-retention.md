# Decision 031: data retention rules

Status: implemented in Alpha 31, verified locally; not deployed and not scheduled. Date: 3 October 2026.

## Problem

REUNIR kept every housekeeping record for ever: expired sign-in sessions and links, rate counters, the receipts that stop a request being applied twice, internal change events, records of mail already sent and the contents of mail that could not be delivered. None of them is useful after a short while, some hold personal details, and people had no single place that said how long anything is kept.

## Decision

- One list of rules, `RETENTION_DAYS` in `packages/contracts/src/retention.ts`, serves the job, the **How long things are kept** panel on Your account and [RETENTION.md](../RETENTION.md). What people are told is what the job does.
- The job clears housekeeping only. Accounts, profiles, posts, project work, lessons, messages, learning records, private goals, reviewed evidence and the audit trail are never cleared by it. They stay until the person deletes their account or the community removes them, as before.
- Records not tied to a community (sessions, links, rate counters, mail) are cleared directly. Each community's own records (request receipts, change events, read notices) are cleared inside that community's tenant context, so row security applies as for any request.
- Migration 0030 adds one read-only policy so the job can list communities when, and only when, its own transaction sets `app.worker` to `retention`, as the digest job does for notification settings. It also adds an index for clearing read notices.
- A dry run does the same work inside transactions that are rolled back, so its counts are exact. The script is a dry run unless `RETENTION=apply`; the scheduled route applies unless `?dry=1`.
- The job reports counts per rule, never contents, and records each run as `retention-job` in service observations.

## Defaults chosen where the brief was silent

- Periods: expired sessions, links and rate counters one day after expiry; request receipts 30 days; change events 90 days; sent and cancelled mail records 90 days (their contents are already cleared when sent); failed mail contents 30 days, the record 90; read notices 180 days. Unread notices are never cleared.
- Deleted content is not purged on a timer: the audit trail and reviewed evidence stay as long as the community exists, so decisions remain accountable and nothing reviewed is rewritten.
- Undelivered mail is counted from when it finally failed (`email_outbox.failed_at`, added by migration 0030 and set by the mail worker), not from when it was queued, so mail that waited a long time still keeps its contents for 30 days. (Found in review on PR #23.)
- The scheduler secret is required at launch even without mail, because the retention job needs it; the launch preflight fails without it. (Found in review on PR #23.)
- Nothing is scheduled. Operators choose a daily schedule with the existing `CRON_SECRET` arrangement (PILOT_OPERATIONS.md).

## Not decided here

- Per-community settings for these periods, and retention for the audit trail itself. Both need the owner's view and possibly legal advice before a wider pilot.
- Backups: their retention belongs to the database provider's settings and the deployment runbook.
