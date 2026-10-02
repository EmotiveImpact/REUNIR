# Direction audit: Alpha 01 to purpose-led Alpha 02

24 September 2026. The baseline is the supplied Alpha 01 source, not an assumed remote application. The full original 107-test suite was run before changes. The application was not rewritten.

## Existing assets worth preserving

React/Vite, Hono, Better Auth, shared strict commands, parameterised PostgreSQL persistence, tenant memberships, private-space checks, transactional idempotency/outbox, learning completion, mission reviews, project membership/updates and browser/live adapters were usable foundations. Their records and routes remain.

The design weakness was a feed-led home. The modelling gaps were purpose, paths distinct from courses, explicit project contribution evidence, outcomes, outputs and member goals. Treating those as post types or opaque metadata would have made permission checks and evidence integrity less clear.

## Audit and smallest implementation change

| Concept | Alpha 01 | Alpha 02 decision and implementation |
| --- | --- | --- |
| Person | Auth user + tenant membership/profile | Retain. No duplicate identity or public cross-community profile. |
| Community | Organisation and scoped membership | Retain. Code Black stays a tenant, not a fork. |
| Purpose | No first-class record | Add typed become/build/achieve records with active/archive status. Owner/admin configuration. |
| Path | Tracks/lessons only | Add a path referencing a purpose, optional space, milestones and enrolment. Do not rename or duplicate tracks. |
| Milestone | Lesson completion and proof existed separately | Add ordered, typed references to one existing lesson, mission or project. Derive completion from its real evidence. |
| Project | Project, team and updates | Retain. Add one nullable purpose relationship. |
| Contribution | Joining/updating projects, but no reviewed work record | Add author, project, written evidence, optional safe link, review state, reviewer and feedback. |
| Outcome | No explicit result record | Add a result linked to exactly one reviewed mission submission or recognised contribution. Separate admin review. |
| Member goal | No explicit private intention | Add private-by-default goal, optional path, pause/complete state and an explicit completion outcome reference when used. |
| Community output | Showcase implied by projects | Add authenticated, community-wide archive entries derived from verified outcomes, not likes or a project status alone. |
| Home | Feed/composer-led | Purpose-led Home; feed preserved in Discussions and existing Spaces. |
| Profile | Bio, skills, existing activity | Add shared/own goals, recognised contributions and reviewed outcomes without deleting the old profile. |
| Knowledge | Resource posts existed | An authorised resource view plus course/output links. Full institutional knowledge tools remain later. |
| Contribution graph | Transactional event outbox | Keep outbox and explicit relational links. No graph service, AI matching or score inference. |

## Scope of change

One additive migration, **0002_purpose_progress.sql**, creates eight tables: purposes, paths, milestones, path_enrolments, contributions, outcomes, community_outputs and member_goals. Existing projects receive nullable purpose_id. Existing submissions gain a composite author key so outcome evidence can preserve authorship. Migration 0001 remains byte-for-byte unchanged.

The original 22 command variants are retained; 15 purpose/evidence command variants are added. All travel through the existing authentication, validation, domain, transaction, idempotency and visibility boundaries. No new runtime dependency, database provider or mandatory external service was introduced.

Primary changed areas: `packages/contracts/src/index.ts`; `packages/domain/src/purpose.ts`, `access.ts` and the existing engine; `packages/db/migrations/0002_purpose_progress.sql`, migration runner, table descriptors and runtime grants; `apps/web/src/pages/purpose.tsx`, existing project/profile pages, navigation and styles.

## Guardrails that changed the implementation

A completed lesson, an approved mission, a recognised contribution, an outcome and a published output are distinct records. Joining cannot masquerade as contributing. New work does not earn automatic bonus points. Contribution and outcome authors cannot review their own work, including administrators. Feedback-requested work must be resubmitted before review.

A goal is not marked complete simply because any outcome shares its purpose. The member explicitly selects their reviewed outcome or finishes the linked enrolled path. Composite keys preserve purpose, source ownership and tenant identity. Goal text never enters the event payload; private goals are removed even from the application admin's snapshot.

A published path cannot silently acquire new requirements. Current published milestone lists are stable; create another path for a materially different journey. Draft authoring and publishing recheck target visibility. A private target cannot be exposed through a broader path audience. Private evidence cannot be promoted to a community-wide output by clicking Publish.

## Regression and upgrade approach

The old member/community flow is still exercised through browser tests: post/reply/save/reaction, private spaces, course completion, proof review, project creation/updates, events, search, tenant switching and small screens. The additional journey exercises purpose setup, draft/published paths, goals, contribution review, outcome review and publication.

A populated 0001 database is upgraded in a test. Existing post text, project title, member profile and revision are unchanged; the project's purpose is null and the new collections are empty. The old browser storage namespace is retained and normalised additively, without resetting user activity or inventing evidence.

Final results and scope limitations are in `BUILD_STATUS.md` and the Alpha 02 evidence folder. Automated checks are not a production capacity benchmark, legal certification or independent penetration test.

## What was deliberately not built

No arbitrary transformation graph, credentials engine, AI orchestration, marketplace, funding, mentor discovery, public talent network or expanded gamification. Messaging and email invitations remain real delivery work, not decorative cards. No live Neon database, Vercel deployment or Google bucket was altered by this release.

The next priority is a connected pilot and dependable everyday participation: account lifecycle, safe invitation/recovery, member operations, moderation, followed by private messaging with tested membership boundaries. Broad workspace snapshots remain a disclosed pilot limit, not a permanent scaling strategy.
