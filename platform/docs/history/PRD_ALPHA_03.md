# REUNIR · Product Requirements Document

Version 0.4 · 24 September 2026 · Purpose-led Alpha 03 (application 0.3.0). Requirements and actual delivery are distinguished below.

## 1. Product

**REUNIR is where people come together to become something, build something or achieve something.**

The community is the container. The deeper product is progress, creation, contribution, reputation and belonging through action. The fundamental product unit is transformation: what a person is becoming, what they are building, and what evidence exists that progress has happened.

Internally: **an operating system for purposeful communities**. Framework: **People + Purpose + Progress + Projects + Proof**. Code Black is the first community, not a special-case fork. REUNIR remains the working product name.

Each community should answer one or more of: what are these people becoming; what are they building; what are they trying to achieve? Not every community needs all three. Existing communities are not blocked while their owner articulates a purpose.

**Member loop:** Discover → Join → Learn → Do → Build → Prove → Teach → Lead. The full loop is a direction, not a claim that mentoring, leadership succession or discovery graphs are already built.

Home communicates the shared purpose and a next useful action. Conversation remains essential but is not the unavoidable centre of the application. Participation should build capability and belonging, not pressure people to maximise posting or scrolling.

This revision extends the existing application rather than replacing its architecture. See `DIRECTION_AUDIT_ALPHA_02.md` for the before/after audit and `PRODUCT_DOCTRINE.md` for preserved future concepts.

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

The delivery remains a working vertical-slice alpha, not all 86 proposed screens. Alpha 02 retains the foundation and adds the bounded purpose/evidence scope in section 16. It must be usable as a clearly labelled fictional browser demo before cloud accounts are configured, and have a real server/database path rather than only localStorage.

### Foundation

Organisations, memberships, roles, spaces, tenant context, validated inputs, identity adapter, migrations, seed data, health checks and structured errors. Browser demo and server mode are explicit and never silently interchangeable. Live configuration failures must not quietly show fictional data.

### Community

Purpose-led Home, separate Discussions and space feeds, create a text post, post types (update, question, resource, project update), comments, one reaction per person, saved posts, member directory, profiles, reporting and administrator moderation. Private spaces and their posts must be filtered at the API before rendering and searching.

### Learning

Track catalogue, track detail, ordered lessons, enrolment, text/resource lesson viewer and idempotent lesson completion. Progress is calculated from published lessons, never invented. Initial content is sample editorial material, labelled as such. Quizzes, advanced authoring and cohort schedules remain next-wave work unless independently tested in this build.

### Doing

Mission board and detail, join/submit, proof as text plus an optional safe HTTPS link, pending/approved/changes-requested review states. Members cannot approve their own work. Approved proof awards server-side, idempotent reputation entries. Project directory, project detail, join and project updates connect learning to visible work.

### Events and recognition

Upcoming events, detail, RSVP with duplicate prevention, calendar export and safe external meeting links. Recognition distinguishes contribution, learning and building. No invented earnings or externally verified skill claims.

### Operator tools

Overview, mission review queue, moderation queue, community settings and a small content-creation toolset. Clearly label any later-stage function rather than presenting a dead button as a feature.

## 5. Navigation

Desktop: compact community rail; Home, Paths & learning, Projects, Events, Your people, Discussions and Knowledge; contextual evidence and personal direction; global search and create action. Paths link to the retained course library and mission screens. No feed-first product lock-in.

Mobile: one readable content column, bottom navigation, collapsible spaces, no shrunken desktop dashboard.

Secondary: Missions, Community outputs, Notifications, Saved, Profile, Community settings and Administration. Mobile prioritises Home, Paths, Projects, Events and People, with the rest in the drawer. Messages now has a participant-private inbox. Opportunities remains on the roadmap. Owner/admin Member access is a separate administrative area.

## 6. Visual requirements

Charcoal backgrounds, softer raised surfaces, clear separators, restrained violet primary accent and domain-specific mint/amber/blue. Light typography with an editorial headline, generous spacing, readable body text, tactile cards and a small geometric REUNIR mark. Use the first community's content, not generic enterprise sustainability statistics.

A concise purpose feature should lead into the member’s chosen next step and active work, with relevant conversations still present. A single-purpose community should show its actual direction, not a forced three-part slogan. Course art and project previews give the interface visual energy without giant decorative scenery consuming the product. Show member faces/initials, useful tags and actual activity states. Animation must respect reduced-motion settings.

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

Existing tenant records: organisation, membership, space, space_membership, post, comment, reaction, bookmark, track, lesson, enrolment, lesson_completion, mission, mission_submission, project, project_member, project_update, event, event_rsvp, notification, report, reputation_entry, audit_event, outbox_event and media_object.

Additional explicit tenant records: purpose, path, milestone, path_enrolment, contribution, outcome, community_output and member_goal. Existing projects gain a nullable purpose relationship. Goals can reference a path and, when used as completion evidence, a specifically selected reviewed outcome.

Conceptual model: Person → Community → Purpose → Path → Project → Contribution → Outcome. This is not a mandatory linear journey; joining a project without taking a path is valid.

Business records use organization_id in SQL (organizationId in TypeScript). Content referring to a space must belong to the same organisation. Clients cannot choose an author, organisation, reviewer or points award. User identity comes from the verified server session.

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

## Implementation qualification (retained from Alpha 01)

Current data delivery uses bounded workspace snapshots rather than fully paginated endpoints. Alpha 03 implements personal invitations, a durable email outbox, password recovery and focused member-access administration. Real email delivery requires provider configuration and a scheduled worker; lifecycle export/deletion and privileged MFA remain unbuilt. File APIs are owner-private scaffolding, not an exposed member attachment feature. See BUILD_STATUS.md for tested delivery, missing cloud configuration and public-launch gates.


## 16. Alpha 02 purpose and evidence scope

### Purpose

Owners/admins can add, edit and archive purposes of kind Become, Build or Achieve. Each has a title and explanation. One direction is sufficient; the application also tolerates no purpose during migration/onboarding. Archiving preserves historical links. New goals/paths/projects choose active purposes. There is no backfill guessing a purpose from existing posts.

### Paths and milestones

A Path is not a renamed course. It has a purpose, optional space audience, draft/published state and ordered milestones. Each milestone references exactly one existing lesson, mission or project. Completion derives from a member’s lesson completion, approved mission submission or recognised project contribution. Joining a project or merely submitting work is insufficient. No new generic completion table or gamified rank is added.

Admins create a draft, link at least one milestone and publish. Private targets cannot be exposed to a broader audience; publication rechecks the targets. Published milestones remain stable in this release. Members enrol idempotently and may explore steps in any order. Complex prerequisites, path versioning, quantitative skills assessment and external credential validation remain later.

### Member goals and profiles

A goal is private by default, including from community-admin application snapshots. The member can explicitly share it with members of the same community, refine it or pause. One current goal per member/purpose is the initial bounded rule. A goal may exist without a selected path.

Completing a goal requires either a fully evidenced, enrolled linked path or an explicitly selected verified outcome belonging to that member and purpose. Completion records retain the time and selected outcome reference where applicable. The product does not infer achievement from arbitrary activity or make quantitative claims it cannot validate.

Profiles retain existing bio, skills, learning and project information, with new sections for shared/own goals, recognised contributions with reviewers and reviewed outcomes. Self-declared skills and reviewed work remain visibly different. Cross-community portability and public discovery are not implemented.

### Contributions, outcomes and outputs

A team member records concrete project work with text and an optional safe evidence link. It is pending until a project owner/admin other than the author recognises it. Changes can be requested; the author revises and resubmits. No new points or elevated access are awarded.

An Outcome states what changed and links exactly one approved own mission proof or recognised own contribution. A project-linked outcome uses the project's purpose when linked. A different community administrator reviews it separately. Sources cannot be reused to manufacture duplicate outcomes. This is a community review, not independent accreditation.

A Community output is an admin-published member-archive record derived from a verified outcome. It records kind, title, summary, source, purpose, project where applicable, publisher and time. Private project/mission evidence cannot be published to the wider community. The same outcome is not published twice. Public portfolios, multi-author output credits and real-world impact aggregation remain future work.

### Knowledge and ordinary community work

Knowledge currently collects authorised resource posts and links to courses and outputs. It is not a full wiki. Conversations, search, events, notifications, moderation and private spaces remain live parts of the existing product. Alpha 03 adds private direct messaging, invitation-based account creation, recovery and member-access controls. Broader member operations remain high-priority work.

## 17. Additional acceptance criteria

| ID | Requirement | Verification |
| --- | --- | --- |
| P01 | Preserve populated Alpha 01 data and original migration bytes | Upgrade and checksum tests |
| P02 | Add purpose explicitly; one direction is enough | Domain test and owner UI journey |
| P03 | No fictional data inserted into real community creation | Empty-tenant persistence test |
| P04 | Keep courses/lessons and derive path progress from their evidence | Domain, SQL and browser journey |
| P05 | Draft visibility, nonempty publication and audience checks | Negative domain tests and browser authoring |
| P06 | Private goals are absent from other profiles and admin snapshots | Domain, HTTP, SQL and browser checks |
| P07 | Goal completion has an explicit permissible evidence basis | Path/outcome completion and ownership tests |
| P08 | Contribution review preserves authorship and rejects self-review | Domain and database constraints |
| P09 | Outcome source is reviewed, owned and purpose-consistent | Domain and composite-key tests |
| P10 | Publication requires a verified, shareable source | Negative publication tests and browser flow |
| P11 | New collections inherit tenant RLS and safe runtime grants | Restricted-role tests |
| P12 | Old social/learning/project/event interactions still work | Retained 107 tests and 24 browser checks |
| P13 | Purpose-first navigation works at desktop and small phone sizes | Additional browser and overflow checks |
| P14 | No new mandatory service or dependency | Manifest comparison |
| P15 | Future graph/institutions/AI direction is preserved but not represented as shipped | Doctrine, audit and roadmap |

## 18. Future model preserved

Communities may eventually produce films, software, companies, research, books, campaigns, music, events and trained people. Their success should be described through outputs and member outcomes, with explicit counting and evidence standards, rather than only MAU or post volume.

A contribution graph may relate collaborators, delivered work, help, teaching and entrusted responsibility. Communities may develop curriculum, rituals, apprenticeships, alumni, archives and leadership succession. A later AI layer should help humans accomplish their goals together, using consent-aware context, rather than merely provide a chatbot.

None of advanced reputation, automated matching, mentor identification, funding, marketplace, public talent discovery, sophisticated credentials, AI orchestration or community health scoring is in the current release. Preserve the model; productise progressively. See `PRODUCT_DOCTRINE.md` for the complete boundaries.


## 15. Alpha 03: access and communication for a real pilot

This wave completes everyday pilot workflows without replacing purpose-led Home or the learning and evidence systems. Account identity stays global; community access remains membership scoped. No new mandatory database, messaging broker, socket server or AI provider is added.

### Personal invitations

Owners/admins invite a specific email as an ordinary member. New invitations replace the previous pending link for the same email. Tokens are cryptographically random, hashed in the invitation table, one-use, revocable and valid for seven days. Queued mail contains the full link only inside an encrypted payload; invitation lists never return the secret. The one-time creation response may show the personal link to the authorised inviter when manual sharing is necessary.

A recipient can create an account through Better Auth or sign in to their existing account before accepting. The accepted account email must match the invitation. The public Better Auth signup endpoint stays disabled. Invite-only signup uses a server-private provider factory, not a new password implementation. A token revoked during account creation can leave a non-member account, never grant community access.

Invite creation and mail enqueue commit together. Creation is not proof of delivery; the UI distinguishes queued/unconfigured/demo states. Never send bulk unsolicited invitations. A verified email flag is not silently assigned. General email-change verification and privileged MFA remain future security work.

### Password recovery

The library generates reset links with a 30-minute lifetime. Existing and unknown addresses receive the same public success shape. Mail is enqueued durably, rather than waiting for the external provider inside the request. Reset revokes previous sessions and is single-use. Redirects are constrained to the application origin. When transport is not configured, the endpoint returns an explicit unavailable result rather than pretending a recovery message was sent.

### Private conversations

This release supports one-to-one text conversations among active members of the same community. Each member pair has one thread per community. Message and conversation lists use cursor pagination, with 50 items per page. Messages have stable sequence ordering and idempotent sends. Read acknowledgements reference a delivered message and move forwards only. No message text enters the community feed, reputation ledger, activity outbox or general search.

Participants can block/unblock new messages without deleting their history. Reporting requires selecting a received message and a reason; this shares only that message excerpt and participants with moderators. Moderators cannot browse non-participant inboxes, and an involved moderator cannot resolve their own case. This is application privacy and database participant RLS, not end-to-end encryption from the server/database operator.

No group chat, attachments, typing indicator, read-status disclosure to senders, push/email message alerts or WebSocket presence is claimed. Live threads poll approximately every 10 seconds and inbox summaries every 15 seconds while the page is active. Plain-text rendering avoids executing HTML or automatically embedding URLs.

### Member access

Owners/admins can suspend and restore members with an audit reason and manage private-space access. The owner cannot be suspended/demoted in this interface; administrators cannot suspend peer admins. Only the owner can assign member/moderator/admin roles. Suspension preserves posts, reviewed work and history while denying subsequent authenticated community requests. Membership is rechecked after acquiring the transaction lock, not only before a potentially concurrent suspension.

Role assignment is a deliberate permission decision, never an automatic result of activity points. Ownership transfer, account deletion/export, appeals and full membership removal are not implemented in this wave.

### Acceptance and limits

The existing purpose and evidence journey must continue passing, as must tenant isolation, private goals, independent reviews, duplicate-output prevention and non-destructive migrations. New accounts, messages, invitations and recovery are checked with real Better Auth sessions and PostgreSQL tables. Preview personas and preview invitation rows are explicitly fictional; no preview action sends external email.

See BUILD_STATUS.md for exact verification results. A source release is not a public deployment. Live Neon pooling, hosted browser sessions, real email sender verification, cloud upload and backup/restore remain pilot gates.
