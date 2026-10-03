# REUNIR Alpha 05 architecture

## One product, two explicit data modes

The React client uses a data adapter: either fictional browser-persisted data or the same-origin live API. It never infers a production identity from a supplied user or role header. A live connection failure never triggers demo fallback.

`packages/contracts` holds strict input schemas and domain types. `packages/domain` holds the pure state transitions and permission filtering. The demo uses the same transition logic, while the API obtains identity from Better Auth, re-reads membership, runs the transition and persists it transactionally.

## Modules

- `apps/web`: React, Vite, TanStack Query, React Router, Lucide, original components/styles and sample content.
- `apps/api`: Hono, authentication, validation, scoped application endpoints and an optional Google storage adapter.
- `packages/db`: normalised SQL schema, Drizzle auth tables, parameterised domain persistence, migrations and row-level security.
- `apps/worker`: reserved future boundary. It is not a running job service.
- `api/index.ts`: Vercel Node function adapter.
- `scripts`: development, provisioning, migration, preview bundling and browser verification.

## Database boundary

A verified session identifies the actor. Organisation slug resolution requires active membership. A transaction sets `app.user_id` and `app.organization_id` locally. Tenant-table RLS and composite foreign keys prevent accidental cross-tenant relationships. Application permissions additionally restrict individual private spaces, review powers and ownership within a tenant. RLS alone is not a complete fine-grained policy engine.

The runtime role must not own tenant tables or bypass RLS. Separate administrative credentials apply migrations and provision initial accounts. Database credentials never reach the client.

Within a community, writes lock the organisation row. Reads take a shared lock to avoid a mixed snapshot. Only changed records are inserted/updated/deleted. The business write, audit record, reputation award, outbox event and idempotency receipt commit in the same transaction. General notification/webhook delivery remains unimplemented. Alpha 03 adds a separate encrypted invitation/recovery email outbox and bounded delivery worker.

## Idempotency and integrity

The API requires an idempotency key for domain commands and stores a normalised request digest. A repeated key with the same body returns a current authorised snapshot without replaying the mutation. A changed body under the same key is a conflict. Independently, unique constraints prevent duplicate membership joins, completions, reactions and rewards.

Mission and outcome reviews require an admin. Project contributions may be reviewed by the project owner or an admin. No author can review their own proof, contribution or outcome. Reputation uses a source-keyed ledger rather than arbitrary client-supplied totals.

## Browser correctness

TanStack Query keys contain the community and actor. A successful mutation removes other cached actor views for that community. Demo role changes invalidate inactive views. This fixes the stale approval seen during browser testing. Search only searches content already filtered for the current actor.

Native dialog handles focus containment and Escape, with explicit focus return. Reduced motion, visible focus, mobile navigation and automatic home-page accessibility checks are included. Automatic checks are not a complete accessibility certification.

## Deliberate scale limit

The first database implementation reads a bounded workspace rather than querying each page independently. Bounds are 5,000 rows per table and 20,000 total snapshot records. This makes the first product loop testable and transactions comprehensible, but it is not the final read architecture. Use cursor-paginated domain endpoints, batched enrichment and separate analytical projections before larger communities or large activity histories. Since Alpha 18, notices, the knowledge-check review queues and the audit trail page from `GET /api/organisations/:slug/pages/:list` with keyset cursors; the snapshot carries a window of each plus exact counts, and workspace reads skip the outbox and read only the newest audit entries and the acting person's notices (decision 018).

No heavy video processing, custom WebSocket server, Redis dependency, AI billing loop or arbitrary third-party plugin execution is part of this alpha.

## Reuse

Authentication, query caching, routing, validation, SQL drivers, browser testing and object-store signing reuse mature packages. The application reflects product patterns from the six research references without pretending their whole codebases have been merged. Future direct source reuse is reviewed per component and recorded; an AGPL-compatible product is a legitimate commercial choice, not automatically excluded.


## Purpose model: extension, not replacement

`purpose.ts` extends the existing pure domain engine. Shared access helpers were extracted into `access.ts` and re-exported so old imports remain valid. The existing Hono command endpoint, auth session, tenant transaction, idempotency receipt and outbox handle new commands unchanged. No new dependency or mandatory service is introduced.

Relations are explicit: Purpose → Paths → Milestones; Purpose → Projects → Contributions; reviewed MissionSubmission or Contribution → Outcome → CommunityOutput; Membership → MemberGoal → optional Path / selected completion Outcome. Auth identity remains global; profile and permissions remain membership scoped.

Eight new tables use composite tenant keys, foreign keys and forced RLS. Projects receive nullable purpose_id. Outcome-source foreign keys preserve source ownership. Goals preserve purpose and owner equality when linked to an outcome. Milestones have exactly one lesson/mission/project target, positive unique position and no duplicated source within a path. Contribution/outcome status checks require a distinct reviewer and timestamp for reviewed states. These checks reinforce, but do not replace, domain authority and visibility rules.

No `Transformation` superclass, arbitrary-purpose JSON document or graph database is necessary now. Future output credits, mentorship, curriculum versions and recommendation projections can extend these IDs and event boundaries.

## Evidence lifecycle and visibility

Contribution: submitted → recognised OR changes_requested → author resubmission. Outcome: submitted → verified OR changes_requested → author resubmission. Published outputs are derived from verified outcomes with shareable source scope. A review is community judgement, not external certification. Revocation, appeals and immutable review-history UI remain later hardening work.

Path progress is derived, not directly edited. Published milestone lists are stable. Lesson completion proves that in-app action only; mission approval and project recognition have explicit reviewers. Path enrolment does not enrol every linked course automatically. The user follows existing course access and enrolment rules.

Goals are private by default and absent from other actors' snapshots even when the actor is a community administrator. Shared goals are member-scoped. Completion either references the fully evidenced linked enrolled path or a specifically chosen verified outcome with matching author and purpose. Goal text does not enter outbox payloads. This is application access control, not encryption from database operators.

Visibility of paths, evidence, goals with hidden evidence links and output cards follows source visibility. Search receives only the authorised snapshot and deliberately does not index private goals. Tenant RLS enforces tenant scope; fine-grained within-tenant privacy is enforced by the domain and verified in tests, not claimed as per-member DB row policies.

## Upgrade mechanics

Migration `0001_foundation.sql` is unchanged. `0002_purpose_progress.sql` is unchanged. Alpha 03 adds `0003_pilot_access.sql` and `0004_private_messaging.sql`. The runner discovers ordered version files, takes the existing advisory lock, checks already-applied digests and applies missing files inside one transaction. This runner supports the fixed simple DDL files in this repository; procedural SQL bodies need a parser/runner extension rather than naive semicolon splitting.

Existing customer content is not backfilled into invented purposes, paths, goals or outputs. Browser demo state keeps its existing namespace and gains empty new collections. An explicit demo reset is available, never performed automatically on upgrade.

Runtime grants are allowlisted. An existing deployment must run `db:grant-runtime` using its separate migration credential after migration. It refuses elevated/owning/inherited runtime roles and does not change passwords or grant migration-history access. See SETUP for the staging/backup/upgrade sequence.

## Current UI surfaces

Home is purpose-led; Discussions retains the original feed. `/learn` and `/missions` remain. `/paths` and `/paths/:id` organise learning and work; `/outputs` presents reviewed results; `/knowledge` collects authorised resource posts. Existing project/profile/settings components gain focused evidence/purpose sections rather than being replaced.

The interactive preview is compiled from the same React source and shared domain rules. It is still a fictional browser demo, not an authenticated cloud deployment. Browser role switching exists only in explicit demo mode.


## Pilot access and messaging boundaries

`apps/api/src/invitations.ts` owns token creation, inspection, account-email binding, expiry and acceptance. It uses the same verified tenant transaction boundary for administrative actions. Token-based inspection sets only a transaction-local `app.invitation_hash`; acceptance resolves the organisation, locks it and rechecks the invitation before granting ordinary membership. Invitation tokens never serve as general API credentials.

`apps/api/src/mail.ts` provides a durable AES-256-GCM-encrypted outbox and Resend transport. A dedicated stable EMAIL_ENCRYPTION_KEY is recommended; the auth secret is only a fallback. Workers claim jobs with SKIP LOCKED and a two-minute lease; failure returns a bounded retry with generic diagnostics, and five attempts exhaust a job. Provider idempotency uses the outbox row ID. Sent payloads are cleared. A revoke invalidates the token even when a sending email can no longer be recalled.

`packages/db/src/messaging.ts` is deliberately outside the all-community Workspace object. It uses dedicated typed SQL tables and cursor endpoints. Message lists and read markers use a bigint sequence, not timestamp ordering. Thread metadata supports deep links independently of the first inbox page. Queries require an active member and a participant check; forced database policies independently constrain conversations/messages to participants. There is no administrator override to list somebody else's inbox. Since Alpha 24 a conversation is either a direct thread or a named group of up to 20 people (migration 0022, decision 024); groups share the same tables, routes and polling, with `conversation_joins` holding the join point of people added later.

Reporting stores only the submitted excerpt and attribution. Report access is restricted by API role checks and DB policies. The dedicated report queue is not a route into the underlying inbox. Server/database operators still have privileged access to stored plaintext message text; no E2EE claim is made.

Conversation and block writes lock their thread. Ordinary community mutation keeps its previous organisation write lock; message operations take a shared organisation lock and recheck membership after waiting. This retains safety for membership changes without loading private messages into the shared domain snapshot.

The frontend keys inbox, messages and reports by community and signed-in person, resets the thread component across route/person changes, keeps a retry key for an unchanged failed draft, and uses polling rather than a persistent serverless socket. Re-entering an old deep link fetches its participant-scoped detail instead of depending on the first 50 inbox rows.

New schema tables: invitations, email_outbox, conversations, messages, message_receipts, member_blocks and message_reports. The operational mail queue is not exposed through Workspace or general member endpoints. Runtime grants now explicitly include these tables and the messages identity sequence. Migrations must precede grants, which must precede the new runtime.


## Alpha 04 operational observation boundary

`apps/api/src/operations.ts` runs inside the existing membership/tenant transaction and additionally requires the owner role. It returns only counts and redacted checks. `packages/contracts/src/operations.ts` distinguishes pass, warning, blocked and unverified. No schema setting called 'ready' is mutable by an admin. Service observations contain a worker name, state and timestamps, not tenant content. Invitation counts have an explicit organisation predicate; global account-recovery jobs are excluded.

`config.ts` is a pure environment-name/value-presence inspector with redacted output. Production startup reuses its fatal guards. Runtime database safety inspects role capabilities, memberships, database and public object ownership, and schema CREATE privileges. Public liveness returns only process response and release version; it does not become a database readiness assertion.

Mail lease tokens fence post-send writes against cancellation or a newer claimant. Stable provider idempotency keys are retained, exhausted uncertain attempts are quarantined and terminal failures remain visible independently of the last successful poll. Queue and heartbeat are deliberately not mail-receipt proof. Concurrency of real pooled PostgreSQL connections is a separate supplied CI gate, not established by the embedded test engine.

Browser pages load by route; the account-access page is lazy too. Shared React/query runtime chunks are reused. `--mode standalone` intentionally forces demo data and inlines dynamic imports for a genuinely self-contained preview. Normal deployment mode never forces demo if VITE_DATA_MODE=live was set for its build. The current snapshot limits and member permission filters are unchanged.

### Primary design references

PostgreSQL role/security behaviour: https://www.postgresql.org/docs/current/ddl-rowsecurity.html (owners/superusers and BYPASSRLS require particular care). Vercel scheduling and bearer security: https://vercel.com/docs/cron-jobs/manage-cron-jobs (overlaps, duplicate deliveries, and configured schedule are not equivalent to an application heartbeat). These are platform references, not claims that this release is deployed to either provider.


## Alpha 05 project work boundary

`ProjectTask` and `TaskNote` are first-class tenant records, stored in `project_tasks` and `task_notes` by the existing repository TableSpecs. The task has a project, assignee, title, brief, criteria, optional date, priority, version and optional `contribution_id`. The note has a task/project, session-derived author, plain text and removal state. The UI lives in a route-split project-work page under the existing project.

`packages/domain/src/project-work.ts` uses the existing command dispatcher, membership checks and outbox. `task.submit` calls the existing purpose/contribution submit or resubmit handler. `taskStage` derives review/recognition from that linked contribution; only pre-submission todo/doing is independently stored. The shared EvidenceReview component is reused without a second review endpoint.

### Concurrency and relations

The repository's tenant mutation transaction/lock and request receipts are retained. Task mutations check `expectedVersion`; mismatch is a conflict, not last-write-wins. Notes do not increment the plan version. Review changes alter the contribution state, so a task's displayed stage is recalculated from the latest state rather than synchronising duplicate status columns.

Migration 0006 creates composite tenant/project relations. An assignee must be a member of that same project. A linked contribution must belong to that project and its assignee; a contribution cannot be attached to two tasks. Notes must reference the same tenant/project/task. Migrations 0001–0005 are byte-identical to the previous source. Run explicit runtime grants after migration for an existing restricted role.

FORCE ROW LEVEL SECURITY on both new tables restricts rows by tenant, active actor, project/team authority and permitted space. Specific write operations, self-review restrictions and version transitions additionally require application policy. RLS is not presented as a complete per-action permission system. Tests separately execute restricted-role queries instead of assuming superuser tests establish row isolation.

### Filtering and discovery

Only authorised project-team members, project leads and permitted community administrators receive task plans/notes. Related pending task proof becomes visible to that team; unrelated pending submissions retain earlier review visibility. The global search uses the already filtered task collection, indexes title/brief only and opens a task deep link in its project. It does not index notes, private goals, inboxes or pending evidence bodies.

### Cost and limitations

No extra service or runtime dependency. The existing bounded workspace snapshot persists; tasks are not independently paginated in this slice. Active tasks are limited to 100 per project, but archived task/note growth still contributes to the workspace caps. Near-term scale work remains focused pagination and measured database concurrency. Reviews continue to mean community judgement rather than independent credentials. The proof-to-path/outcome link reuses existing semantics; a recognised task does not claim a whole project is finished.

### Research provenance

See `research/reuse-register.json` and `research/notes/10_RESEARCH_TO_BUILD_ALPHA_05.md`. HumHub Tasks informed assignments, review and state; Frappe's inspected submission class reinforces authenticated ownership/graded review; ClassroomIO's layering supports the existing shared-contract boundary; OpenCircle/LearnHouse informed contextual typed conversation. These are targeted source references, not transplanted applications or freshly audited whole repos.


## Creator authoring, recovered Alpha 06

`packages/domain/src/authoring.ts` extends the existing command system. `lesson_drafts` and append-only `lesson_revisions` are added by migration 0007 with tenant-scoped composite foreign keys and owner/admin policies. Existing lessons remain the member-facing published model. Publication copies a whitelisted content snapshot; restore changes the draft only. Deferred uniqueness supports atomic curriculum position swaps. Runtime grants permit revision insertion and reading but reject revision mutation/deletion. The learner's existing lesson completion identity is preserved. See `CREATOR_AUTHORING.md` for precise limits. This is still the existing modular monolith, not another LMS or editor service.


## Monochrome presentation boundary

The current interface contract lives in UI_DESIGN_DIRECTION.md. It changes CSS and the settings presentation, not the persisted domain. Existing organisation accent values remain valid and are preserved on save, while the interface renders neutral styles. No migration, identity change, role change or asset recolouring is required. The stylesheet never filters the whole app to make evidence appear monochrome.


## Alpha 07 presentation integration

The existing React Router routes, workspace context, domain commands, Hono API, Better Auth and PostgreSQL persistence remain. Shared release reporting advances to 0.7.0-alpha.1; no business-rule or database migration change accompanies the design.

The new `components/ui` directory contains attributed shadcn/Radix Button, Avatar and Dropdown Menu adaptations. Tailwind's theme/utilities are enabled through its Vite adapter without global preflight, avoiding an unreviewed reset of existing forms. `v4.css` is scoped over retained neutral styling. Home derives next steps via `pathProgress` and the permission-filtered workspace. The top-right non-modal account menu centralises previously duplicated actions. Demo portrait data is gated to explicit demo mode; connected accounts use only their own avatar URL or a neutral fallback.

No new service, queue, database engine, authentication provider, graph store or server-side rendering rewrite is introduced. Domain-level component migration can happen progressively rather than hiding the working app behind a mock-up.
