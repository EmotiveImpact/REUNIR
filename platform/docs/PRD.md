# REUNIR · Product Requirements Document

Version 0.12 · 3 October 2026 · Track instructors, Alpha 12 (application 0.12.0-alpha.1), on the approved v4 design. Requirements and actual delivery are distinguished below.

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
- REUNIR remains the working product name. The black-and-white interface direction in `UI_DESIGN_DIRECTION.md` supersedes earlier coloured-accent moodboards. The social, creator-led product direction remains.

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

Track catalogue, track detail, ordered lessons, enrolment, text/resource lesson viewer and idempotent lesson completion. Progress is calculated from published lessons, never invented. Initial content is sample editorial material, labelled as such. Knowledge checks arrived in Alpha 10 (see that section); cohort schedules remain next-wave work.

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

Black, white and neutral greys define the interface. Use flat dark surfaces, fine separators, clear white-on-dark hierarchy and restrained controls. Do not reintroduce the former violet/mint/amber/blue palette or decorative card glow. Preserve the existing responsive geometry and member workflows; this is not a new architecture or a completed editorial redesign. Original member imagery and evidence must not be recoloured by a whole-app filter. See `UI_DESIGN_DIRECTION.md` for the current contract and its source limitations.

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

Current data delivery uses bounded workspace snapshots rather than fully paginated endpoints. Alpha 03 implements personal invitations, a durable email outbox, password recovery and focused member-access administration. Real email delivery requires provider configuration and a scheduled worker; lifecycle export/deletion and privileged MFA remain unbuilt. Member file uploads remain owner-private; Alpha 09 releases only lesson files, through access-gated downloads (see the Alpha 09 section). See BUILD_STATUS.md for tested delivery, missing cloud configuration and public-launch gates.


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


## Alpha 04: operate the pilot without changing the product thesis

The community owner can open Pilot console to inspect redacted, tenant-scoped operational observations: configuration and privilege blockers, required-schema presence, invitation delivery totals, worker heartbeat, purpose and moderation cover, and unresolved human checks. Non-owner admins and members cannot read this API. Demonstration mode does not pretend to inspect cloud services. Missing services remain unknown or blocked, not zero-count successful states. Reports exclude personal evidence, private goals, message bodies and credentials.

Configuration and script inspection do not certify deployment. Hosted member journeys, actual receipt of mail, restore rehearsal and owner approval remain explicit external gates. No new reputation, graph, payment or AI system is introduced. Domain and authorisation primitives are retained.

Production startup rejects unsafe role capabilities and configuration. A new additive migration supports lease fencing and a minimal worker observation record. A redacted read-only CLI and a collision-aware Git import helper support release operations. Route splitting keeps the single-file evaluation preview separate from the deployed build. See BUILD_STATUS.md and RELEASE_GATES.md for current tests, artefacts and blockers; historical numbers elsewhere describe earlier milestones.


## Alpha 05: shared work becomes reviewed contribution

The project overview and showcase remain. A new team workspace at `/projects/:id/work` makes the project actionable: what needs to happen, who is doing it, what done looks like and what proof supports completion. Home stays purpose-led. There is no new top-level compulsory productivity dashboard.

### Member and lead journeys

A project lead or community administrator creates a task with a title, brief, 1–10 completion criteria, optional active project-member assignment, optional target date and normal/high priority. Unassigned work is open for a teammate to claim. An assignee can start work or release the task before proof exists. Board and list views share the same records, with All work, My work, Open to claim, Archive and task-text search.

Only the assignee submits proof. It creates an existing Contribution record, not a separate task submission. The existing project lead/community-admin review interface can request changes or recognise the contribution; the contributor cannot approve their own work. Resubmission updates the same evidence record. Task stage is derived from that review: Ready to start -> In progress -> In review -> Recognised, with requested changes returning to In progress.

There is no arbitrary drag-to-done action, no completion badge for claiming work and no second points ledger. A recognised task contribution can support the existing appropriate path/project milestone and separately reviewed outcome workflow; it does not certify completion of the entire project. A recognised task is not automatically published as a community output.

### Discussion and privacy

Plain-text notes belong to tasks. Team members with project/space access and authorised community administrators can read them. The author, project lead or an administrator can remove a note; its author and timestamp remain with a removal marker. Removal clears the stored body, rather than pretending a hidden note is retained for full moderation forensics. This release has no task-note reporting or appeals interface.

Task proof is deliberately visible to the authorised team while under review. The UI explains that audience before submission. Unrelated pending contributions keep their existing private-review filtering. Recognised contributions retain the project's existing visibility. General search includes authorised task briefs, not note bodies or pending proof text. Private goals and private conversations remain outside this task system.

### Integrity and acceptance

Task metadata changes require an expected version. Competing claims or edits cannot silently overwrite an earlier change. The existing request idempotency and tenant transaction protect retries. Assignment and the brief lock after the first proof submission so recognised evidence cannot be attached to silently rewritten work. Create a follow-up task for substantially different work.

Archive/restore preserve proof references and conversation attribution. Restoring a recognised task does not erase its reviewed state. At most 100 active tasks are allowed per project in this initial implementation; archive finished work before adding more. The existing global workspace read caps still apply, including archived work and notes. This is not an unlimited or fully realtime task-management platform.

The feature uses two normalised tables, no new runtime dependency, no new service and no new authentication model. Migrations 0001–0005 remain unchanged. Existing communities and older browser data gain empty collections, not fictional activity. Four example tasks appear only in a fresh demonstration seed.

### Research acceptance criterion

Significant slices record the exact source/commit or blob, what was learned, what existing code was reused, which files implement the decision and how it is tested. `research/reuse-register.json` and the new checker make those links inspectable. The checker verifies structure/paths, not legal clearance or test outcomes. Source imports are welcome when appropriately cleared; this slice imports zero donor application files and reuses REUNIR's existing review/transaction interfaces.

### Scope deliberately left for later

No attachments, drag-and-drop sorting, custom workflow designer, dependencies, recurring tasks, many-assignee credit splitting, automatic reminders, task-note reporting, external calendar synchronisation or live WebSocket collaboration is claimed. The next product investigation is creator authoring and reusable knowledge. Connected staging, source publication, account hardening, retention and pagination remain release/scale gates, not things this workboard solves.


## Creator-authoring recovery slice

The verified Alpha 05 implementation is retained. Creator studio adds private plaintext lesson drafts, explicit saved-version publishing, captured/published history, restore-as-draft, archive/restore and version-checked curriculum order. See `CREATOR_AUTHORING.md` for contracts, data model, privacy, compatibility and acceptance. No Tiptap integration, advanced rich editor, new dependency or re-platforming is claimed. Publication preserves old lesson completion IDs but does not retrofit revision-specific completion evidence.

The complete source remains in a verified local Git history and Library recovery artefacts. GitHub's recovery note is not the complete application. Resolve the source-publication gate before advertising a connected deployment or remote CI. See `SESSION_HANDOFF.md` at the repository root.


## Alpha 07: approved v4 in the working application

UI_DESIGN_DIRECTION.md is authoritative for the approved v4 direction. The far-left community rail, navigation-only contextual sidebar, single top-right account menu, portrait avatars, clean neutral controls and editorial Home are implemented in the React application. Three actual shadcn source components are used over Radix; the rest of the existing application is retained, not recreated as a disconnected mock.

PurposeHome reads existing authorised workspace data. Progress is calculated from lesson/proof evidence, not copied from an image. Admin controls remain permission-scoped, private goals/messages remain private, and routes for all six previous build waves remain accessible. No new data migration is introduced. Rich editing/media, staging operations and larger platform capabilities remain roadmap work.


## Alpha 09: private lesson resources

Creators attach files to lessons as part of the existing private draft: PDF, DOCX, PPTX, XLSX, JPEG, PNG or WebP, up to 10 MB each and 12 per lesson, with a learner-facing name and optional description. They can reorder, replace and remove files. Changes are saved privately, shown in the private preview and released only by explicit publication. Revision history keeps each version's files, and restoring a revision brings them back into the draft only. See `LESSON_RESOURCES.md` and `decisions/009-private-lesson-resources.md`.

| ID | Requirement | Verification |
| --- | --- | --- |
| R01 | Only active owners/admins upload, attach, replace, remove or discard lesson files | Domain, HTTP, database and browser tests |
| R02 | Draft and history files are private to authors; published files only to people who can currently open the lesson, track and space | Domain matrix, RLS, HTTP and connected browser |
| R03 | No cross-tenant access to files, intents or download links | Domain, database, HTTP, PostgreSQL CI |
| R04 | Uploads are bound to an exact key, type and size; completion verifies the stored signature and pins the generation | Storage adapter, HTTP and connected browser |
| R05 | Downloads are short-lived, attachment-only and never serve unverified or overwritten bytes | Real-SDK offline signing and HTTP tests |
| R06 | Stale editors cannot overwrite newer drafts or silently drop files | Domain and database tests |
| R07 | Replacement and removal reach learners only on publication; history keeps referenced files | Domain and browser journeys |
| R08 | Existing lessons, revisions, completions and member uploads upgrade unchanged | Migration 0009 upgrade tests |
| R09 | The fictional demo runs the same rules with browser-local bytes | Demo browser journey |

Malware scanning, real bucket verification, file previews, download analytics and assessments are outside this release. Downloads never count as completion or evidence.

## Alpha 10: knowledge checks

Creators add one optional knowledge check to a lesson inside the existing private draft: single choice, multiple choice, short answer and written response questions, an optional pass mark, an attempt limit and a choice about revealing answers. Learners who joined the track answer it below the lesson; the server scores it, and written answers wait for an owner or administrator to mark them and send feedback from the Community studio queue. Scores are private feedback, never reputation, completion or a credential. See `ASSESSMENTS.md` and `decisions/010-knowledge-checks.md`.

| ID | Requirement | Verification |
| --- | --- | --- |
| K01 | Only active owners/admins author checks, and checks follow draft, private preview, explicit publication, capture and restore | Domain, database and demo browser tests |
| K02 | Learners never receive correct options, accepted answers or explanations before the author's reveal rule allows them | Domain, HTTP, rendering, database snapshot and connected browser tests |
| K03 | Scoring happens only on the server and is deterministic; clients cannot send scores | Domain and HTTP tests |
| K04 | Answers to a check that changed since the learner opened it are refused, not scored | Domain, HTTP and connected browser tests |
| K05 | Attempts keep the quiz they answered and cannot be rewritten or deleted; only review fields change once | Column grants, RLS and PostgreSQL tests |
| K06 | Only an active owner/admin who is not the learner reviews, marking every written answer within its points | Domain, database (including suspended and demoted roles), HTTP and browser tests |
| K07 | Attempts are visible only to the learner and their community's owners/admins; no cross-tenant access | Domain, RLS, HTTP, PostgreSQL |
| K08 | Attempts change no completion, reputation or public profile | Domain and browser tests |
| K09 | Existing lessons, drafts, revisions and completions upgrade unchanged | Migration 0010 upgrade test |
| K10 | The fictional demo runs the same rules, including a seeded review queue | Demo browser journey |

Question banks, timers, partial credit, file answers, exports and an erasure procedure for attempts are outside this release. (Alpha 14 later added the learner's own export and an owner-authorised erasure procedure.)

## Alpha 11: cover images

Tracks and projects show a picture their community uploads, or a plain neutral panel. The decorative generated art and its text are retired: titles, categories and people always sit outside the picture, and only opaque status labels appear on it. Administrators set track covers; a project's owner or an administrator sets its cover. The browser resizes each picture to 1,600 pixels before upload, dropping metadata such as location, and a stored focal point keeps the chosen part in view at every size. See `COVERS.md` and `decisions/011-cover-images.md`.

| ID | Requirement | Verification |
| --- | --- | --- |
| C01 | Only active owners/admins change track covers; a project's owner or an active owner/admin changes its cover | Domain, HTTP, database, demo and connected browser tests |
| C02 | Covers are visible only where their track or project is: tenant, space access and track publication | Domain matrix, RLS, HTTP, connected browser and PostgreSQL tests |
| C03 | Uploads are bound to one subject and an exact key, type and size; completion checks signature and declared dimensions on the pinned generation, and refused objects are deleted | Domain, HTTP and connected browser tests |
| C04 | Pictures are resized in the browser and metadata such as location never reaches storage | Demo and connected browser tests |
| C05 | No text is drawn on a picture; the plain panel has no words; colours stay neutral and pictures keep their own colours | Monochrome, cover and design contract checks |
| C06 | The cover dialogue is labelled, keyboard operable and passes automated accessibility checks at desktop and phone widths | Demo and connected browser tests with axe |
| C07 | Removing a cover stops serving its bytes at once | HTTP and connected browser tests |
| C08 | Existing tracks, projects and uploads upgrade unchanged | Migration 0011 upgrade test |
| C09 | The fictional demo runs the same rules with browser-local bytes | Demo browser journey |

Server-side thumbnails, alt text fields, cropping tools, remote image URLs and covers for spaces, paths or events are outside this release. Removed pictures are pruned later rather than deleted at once; an operator erasure procedure is still open.

## Alpha 12: track instructors

Owners and administrators name instructors for a track. An instructor authors that track's lessons, files, knowledge checks and cover, and marks its knowledge checks, from a teaching page, without community-wide administrator rights. Being shown as a track's author grants nothing. See `INSTRUCTORS.md` and `decisions/012-track-instructors.md`.

| ID | Requirement | Verification |
| --- | --- | --- |
| I01 | Only active owners and administrators add or remove instructors, recorded in their own name | Domain, database, HTTP and both browser suites |
| I02 | Rights come only from explicit grants, never from being named as a track's author; upgrading grants nothing | Domain and migration 0012 upgrade tests |
| I03 | An instructor authors, publishes, reorders and manages files and the cover of their own tracks only | Domain, database, HTTP, demo and connected browser tests |
| I04 | An instructor sees answer keys and attempts, and reviews once, on their own tracks only, never their own attempt | Domain, database (forced RLS), HTTP, browser and PostgreSQL tests |
| I05 | Other tracks' drafts, files and attempts stay invisible to an instructor (not available, 404) | Domain, database and HTTP tests |
| I06 | Suspension ends an instructor's access at once; grants are added or removed, never rewritten | Domain, database, grants and PostgreSQL tests |
| I07 | No cross-tenant grants or access | Domain and database tests |
| I08 | Instructors work from an accessible teaching page; Community studio stays for the community team | Demo and connected browser tests with axe |
| I09 | The fictional demo previews an instructor with the same rules | Demo browser journey |

Invitations to accept, contributor roles beyond instructor, per-lesson grants and instructor-created tracks are outside this release.

## Alpha 13: cover library

People who may change a cover can upload their own picture or choose one from a small library their community supplies. Owners and administrators add up to 24 named pictures in Community settings and remove ones nothing uses. Choosing does not copy the picture, and each cover keeps its own focal point. See `COVERS.md` and `decisions/013-cover-library.md`.

| ID | Requirement | Verification |
| --- | --- | --- |
| L01 | Only active owners and administrators add or remove library pictures, recorded in their own name | Domain, database (forced RLS), HTTP, both browser suites and PostgreSQL tests |
| L02 | Anyone who may change a cover can choose a library picture; nobody else gains a cover right | Domain, HTTP, demo and connected browser tests |
| L03 | Every active member sees library pictures; other communities, visitors and unlisted uploads do not | Domain, RLS, HTTP and connected browser tests |
| L04 | Library uploads follow the verified pipeline: browser resize without metadata, exact policy, signature and dimension checks, deletion of refused files | Domain, HTTP and connected browser tests |
| L05 | A picture in use cannot be removed; removing an unused one deletes its record, upload and stored file | Domain, database, HTTP and both browser suites |
| L06 | Each picture has a short name that is its accessible name; choosing works by pointer and keyboard; the dialogues pass automated accessibility checks | Demo and connected browser tests with axe |
| L07 | Existing tracks, projects, covers and uploads upgrade unchanged | Migration 0013 upgrade test |
| L08 | The fictional demo offers one wordless library picture with the same rules | Demo browser journey and asset test |

Stock photo search, remote image addresses, renaming, tagging or searching the library, and libraries for other kinds of picture are outside this release.

## Alpha 14: learner records

Members download their own learning record from their profile. Operators can erase a learner's knowledge-check answers on a request an active owner authorised, and clear unused cover files. Review queues show 20 at a time with exact totals. See `LEARNER_RECORDS.md` and `decisions/014-learner-records.md`.

| ID | Requirement | Verification |
| --- | --- | --- |
| R01 | A member downloads only their own record for one community; nobody else, no visitor and no other community can | Domain, HTTP under the restricted role, demo and connected browser tests |
| R02 | The record includes every record that is the member's own, with titles, names and answer keys exactly as their screen shows them | Domain tests and the demo download check |
| R03 | Erasure needs an active owner's authorisation and a request reference, is a dry run unless confirmed, refuses partial erasure and keeps an audit entry with counts only | Database and PostgreSQL tests |
| R04 | Erasure works under forced row security without bypass; the runtime role can never delete attempts (Alpha 15: never anyone else's; only a person's own, while deleting their own account) | Database tests with a role without bypass, migration 0014 test, PostgreSQL check |
| R05 | Unused cover files are deleted before their records, and anything chosen again is kept | Database test |
| R06 | Review queues page 20 at a time, waiting answers oldest first, with exact totals and focus moved to new items | Demo browser check with 45 waiting answers |
| R07 | Existing rows upgrade unchanged | Migration 0014 upgrade test |

Account deletion, identity scrubbing, administrator exports of someone else's data and server-side queue pagination are outside this release. (Alpha 15 later added account deletion with identity scrubbing.)

## Alpha 15: account deletion

People delete their own account from **Your account**, after re-entering their password and typing "delete my account". Posts, comments and project work stay so conversations still make sense, shown as "Former member"; private things and their own learning record go; direct messages stay for the other person. Owners are refused. See `ACCOUNTS.md` and `decisions/015-account-deletion.md`.

| ID | Requirement | Verification |
| --- | --- | --- |
| D01 | Only the signed-in person deletes their own account, from the same origin, with their current password and the typed phrase; attempts are rate limited | HTTP tests, real Better Auth HTTP checks, connected browser check |
| D02 | One transaction across every community, suspended memberships included; each membership becomes the same scrubbed Former member record | Domain, database (restricted role) and PostgreSQL tests |
| D03 | Posts, comments, project work, lessons, files, covers, reports and sent messages stay; personal records, the learning record, private files, invitations to the address, queued mail, sessions and the account go | Domain and database tests |
| D04 | Owners are refused, with the communities named, and nothing changes | Domain, database, HTTP and browser tests |
| D05 | Row security admits only the person's own rows while the transaction is marked as their deletion; the runtime role cannot use the operator erasure | Database tests under the restricted role, migration 0014 and 0015 tests, PostgreSQL check |
| D06 | A former member reads as Former member with no photo, profile link or directory entry, gets no new notices, points, roles or messages, and cannot be restored | Domain tests, demo and connected browser checks |
| D07 | Claimed tasks without proof return to their teams; notices naming the person are reworded unless the name is shared; the audit entry holds counts only | Domain and database tests |
| D08 | The fictional demo runs the same rules in the browser and can be restarted | Demo browser check |

Ownership transfer, administrator-run deletion of someone else's account, deleting a person's posts with their account and rewriting mentions inside other people's posts are outside this release.
