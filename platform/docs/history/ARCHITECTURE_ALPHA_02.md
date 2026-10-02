# REUNIR Alpha 02 architecture

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

Within a community, writes lock the organisation row. Reads take a shared lock to avoid a mixed snapshot. Only changed records are inserted/updated/deleted. The business write, audit record, reputation award, outbox event and idempotency receipt commit in the same transaction. The worker that actually delivers external notifications/webhooks is not implemented.

## Idempotency and integrity

The API requires an idempotency key for domain commands and stores a normalised request digest. A repeated key with the same body returns a current authorised snapshot without replaying the mutation. A changed body under the same key is a conflict. Independently, unique constraints prevent duplicate membership joins, completions, reactions and rewards.

Mission and outcome reviews require an admin. Project contributions may be reviewed by the project owner or an admin. No author can review their own proof, contribution or outcome. Reputation uses a source-keyed ledger rather than arbitrary client-supplied totals.

## Browser correctness

TanStack Query keys contain the community and actor. A successful mutation removes other cached actor views for that community. Demo role changes invalidate inactive views. This fixes the stale approval seen during browser testing. Search only searches content already filtered for the current actor.

Native dialog handles focus containment and Escape, with explicit focus return. Reduced motion, visible focus, mobile navigation and automatic home-page accessibility checks are included. Automatic checks are not a complete accessibility certification.

## Deliberate scale limit

The first database implementation reads a bounded workspace rather than querying each page independently. Bounds are 5,000 rows per table and 20,000 total snapshot records. This makes the first product loop testable and transactions comprehensible, but it is not the final read architecture. Use cursor-paginated domain endpoints, batched enrichment and separate analytical projections before larger communities or large activity histories.

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

Migration `0001_foundation.sql` is unchanged. `0002_purpose_progress.sql` is additive. The runner discovers ordered version files, takes the existing advisory lock, checks already-applied digests and applies missing files inside one transaction. This runner supports the fixed simple DDL files in this repository; procedural SQL bodies need a parser/runner extension rather than naive semicolon splitting.

Existing customer content is not backfilled into invented purposes, paths, goals or outputs. Browser demo state keeps its existing namespace and gains empty new collections. An explicit demo reset is available, never performed automatically on upgrade.

Runtime grants are allowlisted. An existing deployment must run `db:grant-runtime` using its separate migration credential after migration. It refuses elevated/owning/inherited runtime roles and does not change passwords or grant migration-history access. See SETUP for the staging/backup/upgrade sequence.

## Current UI surfaces

Home is purpose-led; Discussions retains the original feed. `/learn` and `/missions` remain. `/paths` and `/paths/:id` organise learning and work; `/outputs` presents reviewed results; `/knowledge` collects authorised resource posts. Existing project/profile/settings components gain focused evidence/purpose sections rather than being replaced.

The interactive preview is compiled from the same React source and shared domain rules. It is still a fictional browser demo, not an authenticated cloud deployment. Browser role switching exists only in explicit demo mode.
