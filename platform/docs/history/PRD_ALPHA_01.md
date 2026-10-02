# REUNIR · Product Requirements Document

Version 0.2 · 24 September 2026 · Implementation baseline, not a claim of completion.

## 1. Product

REUNIR gives independent communities one place to connect, learn and make things together. Code Black is the first community, not the name of the software or a special-case fork. Community owners can eventually run their own branded instance or buy managed hosting.

**Product promise:** Your people. Real progress.

**Member loop:** Join a community → find a conversation → learn something useful → take a mission → submit proof → receive feedback → build with others.

The member home is an active social space. It is not a corporate reporting dashboard. Content, people and the next useful action take priority over vanity metrics.

## 2. Confirmed direction and latest decisions

- React + TypeScript + Vite for the web application.
- Neon PostgreSQL for managed durable data, with ordinary PostgreSQL compatibility for self-hosting.
- Hono TypeScript API, shared validation, modular monolith, explicit database migrations.
- Vercel is the intended initial deployment target. No persistent WebSocket server or long-running video job is assumed to run inside a Vercel request.
- Google Cloud Storage is the initial optional cloud-upload adapter. It is object storage, not Google Drive. Bucket credentials must never enter VITE_* variables or the browser bundle.
- Retain a provider boundary for another object store later. No cloud bucket is created without a configured project and credentials.
- Reuse well-maintained libraries and properly licensed upstream code. Do not reimplement authentication, rich browser primitives or infrastructure solely to claim originality.
- Record copied/adapted source, commit, applicable licence, modifications and required notices. Research code is not automatically cleared for shipping. AGPL is not a ban on commercial software; adoption requires an intentional licensing model.
- Latest direction supersedes the earlier blanket clean-room-only recommendation. The six reference repositories remain separate and deletable.
- Redis is deferred until a measured workload requires it. PostgreSQL transactions and a transactional outbox support the first release. This reduces mandatory services while preserving the future worker boundary.
- REUNIR remains the working product name. The latest dark, social, creator-led moodboard is a direction, not an immutable set of pixels.

## 3. People and permissions

| Role | Needs | Permissions |
| --- | --- | --- |
| Visitor | Understand the product and explore a fictional demo | No access to private tenant data |
| Member | Talk, learn, submit work, join projects and attend events | Access granted spaces; manage own posts and submissions |
| Moderator | Keep discussions useful and safe | Review reports and hide inappropriate posts, not change owner settings |
| Instructor | Publish learning and review work | Owner/admin manages curriculum in the first slice; instructor is a later scoped role |
| Admin | Run a community | Spaces, learning, missions, events, invitations, member management and branding |
| Owner | Control the organisation | All admin powers and future billing/ownership controls |

All roles are scoped to organisation memberships. A role in Code Black gives no authority in another tenant. Client-side navigation is not an authorisation boundary.

## 4. Initial release scope

The first delivery is a working vertical-slice alpha, not all 86 proposed screens. It must be usable as a clearly labelled fictional browser demo before cloud accounts are configured, and have a real server/database path rather than only localStorage.

### Foundation

Organisations, memberships, roles, spaces, tenant context, validated inputs, identity adapter, migrations, seed data, health checks and structured errors. Browser demo and server mode are explicit and never silently interchangeable. Live configuration failures must not quietly show fictional data.

### Community

Home and space feed, create a text post, post types (update, question, resource, project update), comments, one reaction per person, saved posts, member directory, profiles, reporting and administrator moderation. Private spaces and their posts must be filtered at the API before rendering and searching.

### Learning

Track catalogue, track detail, ordered lessons, enrolment, text/resource lesson viewer and idempotent lesson completion. Progress is calculated from published lessons, never invented. Initial content is sample editorial material, labelled as such. Quizzes, advanced authoring and cohort schedules remain next-wave work unless independently tested in this build.

### Doing

Mission board and detail, join/submit, proof as text plus an optional safe HTTPS link, pending/approved/changes-requested review states. Members cannot approve their own work. Approved proof awards server-side, idempotent reputation entries. Project directory, project detail, join and project updates connect learning to visible work.

### Events and recognition

Upcoming events, detail, RSVP with duplicate prevention, calendar export and safe external meeting links. Recognition distinguishes contribution, learning and building. No invented earnings or externally verified skill claims.

### Operator tools

Overview, mission review queue, moderation queue, community settings and a small content-creation toolset. Clearly label any later-stage function rather than presenting a dead button as a feature.

## 5. Navigation

Desktop: compact community rail; community/sidebar with Home, Learn, Missions, Projects, Events and Members; context-sensitive right column; global search and create action.

Mobile: one readable content column, bottom navigation, collapsible spaces, no shrunken desktop dashboard.

Secondary: Notifications, Saved, Profile, Community settings and Administration. Messages and Opportunities belong in the roadmap until a real implementation is delivered.

## 6. Visual requirements

Charcoal backgrounds, softer raised surfaces, clear separators, restrained violet primary accent and domain-specific mint/amber/blue. Light typography with an editorial headline, generous spacing, readable body text, tactile cards and a small geometric REUNIR mark. Use the first community's content, not generic enterprise sustainability statistics.

A concise welcome feature should lead immediately into the social composer/feed. Course art and project previews give the interface visual energy without giant decorative scenery consuming the product. Show member faces/initials, useful tags and actual activity states. Animation must respect reduced-motion settings.

Keyboard focus, labelled inputs, semantic buttons, accessible dialogues, contrast and mobile overflow checks are release requirements, not polish deferred indefinitely.

## 7. Architecture

```
React/Vite web
    ├── explicit local demo adapter (fictional data, browser persistence)
    └── same-origin /api
           ├── Better Auth identity
           ├── Hono validation and tenant authorisation
           ├── domain services + transactional persistence
           ├── Neon/PostgreSQL
           └── private object storage (Google Cloud adapter)
```

Source layout: platform/apps/web, platform/apps/api, platform/apps/worker, platform/packages/contracts, platform/packages/db, platform/packages/domain. Prefer a small number of cohesive modules to artificial microservices.

Use parameterised queries, bounded reads with a later paginated-domain API, explicit allowlists for client-editable fields, transaction-protected writes and immutable event/reputation records. Organisation and space access are separate decisions. Tenant equality is also enforced on relational foreign keys where applicable.

## 8. Data model

Global: user, account, session, verification (authentication only).

Tenant: organisation, membership, space, space_membership, post, comment, reaction, bookmark, track, lesson, enrolment, lesson_completion, mission, mission_submission, project, project_member, project_update, event, event_rsvp, notification, report, reputation_entry, audit_event, outbox_event and media_object.

Business records use organisation_id. Content referring to a space must belong to the same organisation. Clients cannot choose an author, organisation, reviewer or points award. User identity comes from the verified server session.

## 9. Security and privacy baseline

1. Deny unauthenticated protected API calls; deny unknown/removed memberships.
2. Derive tenant context from a verified membership for the requested organisation slug. Never trust an arbitrary tenant header.
3. Check private-space visibility on reads, writes, nested resources and search.
4. Validate every mutation and cap input/request size; render user text without HTML injection.
5. Reject unsafe URLs and isolate external links. Do not execute submitted code.
6. Use HttpOnly, Secure-in-production, SameSite session cookies and origin checks for cookie-authenticated mutations.
7. Keep secrets out of source, logs, screenshots, fixtures and browser bundles. Environment example contains placeholders only.
8. Production starts fail closed without the required database/auth configuration. Demo identities are never accepted on production APIs.
9. Uploads use tenant-prefixed, server-generated keys, private buckets, short-lived signed URLs and allowed MIME/size limits. Verify completed object metadata before exposing an attachment.
10. Admin mutations are audited. Reputation awards are deduplicated, and review transitions are enforced server-side.
11. PostgreSQL row-level security is defence in depth where enabled and tested; do not claim that merely adding organisation_id constitutes database isolation.
12. Operational rate limiting, verified email delivery, backups/restore rehearsal, monitoring and an external security review are public-launch gates.

## 10. Hosting and cost controls

Deploy the Vite output and same-origin API using Vercel, or run the Node server against any suitable Postgres host. Neon connection URL remains server-only. Use the pooled endpoint for application connections and a separate migration credential when required.

No mandatory AI, paid video pipeline or real-time provider in the first slice. Start events with external meeting links. Budget controls for storage, email, compute and video must be explicit before paid memberships launch. Managed software is not zero-maintenance simply because its code is open source.

## 11. Deliberate exclusions

Native mobile apps; native conferencing; video transcoding; production DMs/presence; subscriptions/payouts; SCORM; certificates with accreditation claims; arbitrary plugins; SAML; autonomous AI tutors; cross-tenant public discovery; algorithmic recommendation feeds; deep business analytics. None should be implied by a decorative card.

## 12. Acceptance criteria

| ID | Requirement | Evidence |
| --- | --- | --- |
| A01 | Application builds as React/Vite with strict TypeScript | Build/typecheck logs |
| A02 | Member can create a post, comment, react and bookmark | Domain/API/browser tests |
| A03 | Learning progress persists and completion is idempotent | Tests + reload |
| A04 | Member submits proof; admin reviews; points award once | State-machine and concurrent/duplicate tests |
| A05 | Project joins and event RSVPs cannot duplicate | Domain and persistence tests |
| A06 | Foreign-tenant/private-space identifiers cannot leak content | Negative API tests |
| A07 | Browser preview works without credentials and says Demo | Desktop/mobile browser checks |
| A08 | Live mode never falls back silently to seed/demo data | Failure-path test |
| A09 | Modal focus, mobile layout and keyboard navigation work | Browser/accessibility checks |
| A10 | PRD, setup, migrations, environment example and limitations ship | File manifest |
| A11 | No credentials or imported uncleared upstream assets ship | Source/secret review |
| A12 | Cloud deployment is reported only after a real URL is verified | Deployment record or explicit not-deployed status |

## 13. Build order

**Wave 1:** PRD, repository baseline, shared contracts, seed dataset, domain rules and database schema.

**Wave 2:** Responsive social app with connected Home, Learn, Missions, Projects, Events, Members, profile and admin.

**Wave 3:** Production API adapters, authentication, PostgreSQL persistence, migration/seed tools and storage interface.

**Wave 4:** Automated domain, API, persistence, browser and accessibility tests; handover; cloud integration when the relevant account can be selected securely.

## 14. Decisions still requiring the owner

Before public launch: confirm branding/domain; intended membership pricing; invite-only versus open registration; content and moderation policy; final owner email; production database project; Google Cloud bucket/project and approved region; transactional email sender; Vercel project/domain. None blocks source development or the fictional preview.

## 15. Reference/reuse ledger

Roost: social product shape and project showcase; its README's MIT claim alone is not final licence clearance.
OpenCircle: channel/timeline mental model, not automatic code import.
ClassroomIO: typed validation/service/query layering and cohort workflows; root AGPL notice overrides any assumption based only on package metadata.
LearnHouse: editor and lesson structure; enterprise modules have separate conditions.
Frappe Learning: course/chapter/lesson and review workflow benchmark.
HumHub: space permissions, content containers and configurable community structure.

These references inform the product. Actual imported library/source notices live in THIRD_PARTY_NOTICES.md. A future explicit AGPL adoption or commercial licence is a valid option, not a forbidden one.

## Technical source references

- Hono on Vercel: https://hono.dev/docs/getting-started/vercel
- Vite guide: https://vite.dev/guide/
- Better Auth Drizzle adapter: https://better-auth.com/docs/adapters/drizzle
- Neon PostgreSQL/serverless documentation: https://neon.com/docs
- Google Cloud Storage signed URLs: https://docs.cloud.google.com/storage/docs/access-control/signed-urls

These references support integration choices, not a claim that cloud configuration has already been completed.

## Alpha 01 implementation qualification

Current data delivery uses bounded workspace snapshots rather than fully paginated endpoints. Some operator capabilities in the role vision, including emailed invitations and broad member administration, remain next-wave work. File APIs are owner-private scaffolding, not an exposed member attachment feature. See BUILD_STATUS.md for tested delivery, missing cloud configuration and public-launch gates.
