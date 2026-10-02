# 0.9.0-alpha.1: private lesson resources

- Attach ordered, named and described files to lesson drafts; replace and remove them; release them only on publication.
- Revision history keeps each version's files; restoring a revision brings them back into the draft.
- Extend the existing upload-intent API and Google Cloud Storage adapter: track-scoped keys, signature checks, generation pinning, two-minute attachment downloads.
- One download rule for lessons, drafts and revisions, with a restrictive RLS policy in depth.
- Additive migration 0009; migrations 0001–0008 unchanged. No new runtime dependency.
- The fictional demo keeps file bytes in the browser and includes a generated sample worksheet.
- Custom covers on tracks and projects created in the app keep AA text contrast at every width. The connected resources check scans the whole learner page again, and the monochrome suite now checks a newly created track.
- Deployment remains deferred by the user; no bucket has been configured.

# 0.8.0-alpha.1: rich lesson authoring

- Add Tiptap formatting, headings, lists, quotes, code, links and labelled image/video blocks.
- Keep private draft/preview/publish/revision boundaries and legacy lessons.
- Add bounded structured content, safe React rendering and opt-in external media.
- Add nullable migration 0008 and rich-content database/browser regressions.
- Deployment remains deferred by the user.

# Change log

## 0.7.0-alpha.1, 2 October 2026

Approved v4 shell and purpose-led Home integrated into the existing React app. Actual attributed shadcn Button/Avatar/Dropdown Menu, Tailwind utility integration, clean two-sidebar navigation, global header search, one account menu, fixture-safe natural portraits and mobile drawer focus/Escape. Existing routes and seven migrations preserved. Progress/activity read original authorised records, not mock-up statistics. Added v4 browser checks and refreshed moved-control regression selectors. Full source publication and hosted pilot remain separate gates.

# REUNIR changes

## Alpha 05 / 0.5.0 / 24 September 2026

Added project workspaces with board/list views, assignment/claiming, version-aware edits, completion criteria, due dates, task notes, archive/restore and authorised task search. Task evidence reuses the existing contribution lifecycle and review UI, then the existing path/outcome system. Added migration 0006 with typed tenant/project/assignee/evidence relations and row policies; original five migrations are unchanged. Added a checked research-to-build register and targeted six-platform review, plus the HumHub Tasks optional reference. No new runtime dependency, donor application source import or live deployment.

# Changelog

## Alpha 04 · 24 September 2026

- Added owner-only Pilot console with redacted, scoped operational observations and JSON export.
- Added runtime configuration/role guards, read-only migration/config CLI and additive migration 0005.
- Fenced email claims against late completion, cancellation and newer leases; quarantined exhausted uncertain attempts.
- Split production routes/runtime chunks while preserving the one-file fictional preview.
- Added source manifest, collision-aware publication helper and versioned offline Git handover.
- Verified 276 application tests, 102 demo-browser checks, 17 HTTP checks and 10 helper tests.
- Connected-browser gate remains environment-blocked; external PostgreSQL CI and all cloud integrations remain unverified.
- No full remote application push, merge or deployment claimed.

## Alpha 03 · 24 September 2026

- Added personal, revocable, one-use invitations and ordinary-member account creation around Better Auth.
- Added password recovery, session revocation and an encrypted durable mail queue with a bounded provider adapter.
- Added participant-private one-to-one messages, cursor pagination, sequence-based reads, retry-safe sending, blocking and selected-message reports.
- Added focused member administration: owner-only role assignment, private-space access and reasoned reversible suspension.
- Kept purpose-led Home, paths, private goals, projects, contribution/outcome review and community outputs.
- Added migrations 0003/0004; migrations 0001/0002 and customer content are unchanged.
- Verification: 230 automated tests, 85 demo browser checks, 12 real local HTTP checks. Connected-browser gate blocked by sandbox policy and retained for staging.
- Updated PRD, architecture, operations, security and source handover. No live cloud deployment, real email delivery, complete application push or merge was performed.

## Alpha 02 · 24 September 2026

### Product and experience
- Purpose-led Home and personal next step; independent Discussions route retained.
- Optional Become / Build / Achieve purposes, paths with evidence-linked milestones and private member goals.
- Project contributions with review and feedback; outcomes with separate verification; member-visible output archive and profile evidence.
- Knowledge navigation, permission-scoped path/output search and responsive mobile flows.
- Existing course, mission, post, project, event, notification and moderation systems retained.

### Architecture and migration
- Added eight normalised domain collections and fifteen commands without replacing authentication or persistence.
- Added migration 0002; migration 0001 is unchanged. Existing communities receive no invented purposes.
- Added ordered checksum verification, explicit safe runtime-table grant upgrades and author/purpose/source relational constraints.
- Path progress reuses existing completion and proof records. Goal completion records a completed path or the member's explicitly selected reviewed outcome.
- No new mandatory runtime dependency, queue, graph store, AI service or scoring engine.

### Verification and delivery
- Original 107 automated checks preserved; full suite now 177 passing.
- Original 24 browser checks preserved; new purpose journey has 34 passing checks.
- Five tested views have no observed automated accessibility violations, with limitations preserved in reports.
- Actual browser preview, updated PRD/doctrine/audit/architecture, screenshots and source archive delivered locally.
- No live cloud connection, deployment, application source push or main merge performed.


## Alpha 06 monochrome continuation, 27 September 2026

Black-and-white interface contract, neutral styling, backwards-compatible settings, contrast fixes and 15 new presentation-browser checks plus eight contract checks. No backend, domain, migration or runtime dependency changes. Full-source GitHub publication remains blocked in this execution environment. See BUILD_STATUS.md for exact verification.
