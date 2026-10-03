# Decision 018: server pages for long lists

Status: implemented in Alpha 18, verified locally; not deployed. Date: 3 October 2026.

## Problem

Every page of the browser received the whole community snapshot. Notices, the knowledge-check review queues and the audit trail grow without limit, so a busy community would send ever larger snapshots and eventually reach the snapshot bounds (5,000 rows per table, 20,000 in total), at which point the community stops working.

## Decision

- **Pages, not snapshots, for the four growing lists.** Notices, the three knowledge-check queues (waiting, scored, reviewed) and the audit trail are read a page at a time from `GET /api/organisations/:slug/pages/:list`, 20 by default and at most 50 a page. Unknown lists return 404; the audit trail is for owners and administrators only.
- **Keyset cursors.** A cursor is an opaque position (time and id), so items added while someone reads never shift or repeat a page. Offsets are refused. A cursor that is not ours is refused with `INVALID_CURSOR`.
- **The snapshot carries a window and exact totals.** The newest 30 notices, the newest 12 audit entries for administrators, the person's own knowledge-check attempts and a `summary` of exact counts (unread notices, each review queue, waiting answers per track, the full audit length). Badges and tabs read the summary, so they stay right however long the lists grow.
- **Reads stop growing too.** A workspace read skips the outbox, reads only the newest 100 audit entries and only the acting person's own notices. Domain rules only add to those collections and writes are differences, so what is not read is never touched. Account deletion and operator erasure still read in full, because they remove records.
- **The demo pages the same way.** The browser demo runs the same domain paging over its fictional data.

## Not decided here

Archiving old notices and audit entries (data retention) and paging other collections, such as posts and project tasks, follow when real usage shows they are needed.
