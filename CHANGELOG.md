# 0.15.0-alpha.1: account deletion

- Delete your account: **Your account** in the account menu lists your communities and says what stays and what goes. After you re-enter your password and type "delete my account", the account is deleted in every community at once, in one transaction.
- Posts, comments, project work, lessons, files, covers and the messages you sent stay, shown as Former member: no name, photo or profile, no place in directories, search or pickers, and conversations with you become read-only for the other person.
- Your private goals, saved posts, notices, reactions, replies to events, learning record (enrolments, completed lessons, knowledge-check answers, points), instructor grants, private files, invitations to your address, queued mail, sessions, password and email are deleted. Claimed tasks without proof go back to their teams, and notices naming you are reworded unless they could be about someone else with the same or a longer name.
- Owners are refused, with the communities named, until ownership transfer exists. The fictional demo runs the same rules in the browser and can be restarted.
- Additive migration 0015: policies that admit only your own rows while your own deletion is under way, including your memberships of any status, instructor grants and knowledge-check attempts; a restrictive policy keeps the operator erasure from 0014 away from the application. Rerun `npm run db:grant-runtime` after migrating. Migrations 0001 to 0014 unchanged. No new runtime dependency.
- PR #5 (Alpha 11 to 14) was merged into main as `661fac9` after CI passed.
- Deployment remains deferred by the user.

# 0.14.0-alpha.1: learner records

- Download your learning record: on your own profile, a dated JSON file of the tracks you joined, the lessons you completed, your knowledge-check answers with marks, feedback and reviewer, and your mission work in that community. It includes everything that is yours, with titles, names and answer keys exactly as your screen shows them, and nothing about other members beyond who reviewed you.
- Owner-authorised erasure: `npm run db:erase-learner` erases one member's knowledge-check answers and the feedback notices about them on request, as a dry run unless `ERASE=yes`, refusing partial erasure and auditing the reference and counts only.
- `npm run db:prune-covers` lists and clears cover and library uploads nothing uses, deleting stored files before records and keeping anything chosen again.
- Review queues show 20 at a time, waiting answers oldest first, with exact totals beside each heading; focus moves to the first new item. The scored and reviewed lists no longer stop at 30.
- Additive migration 0014: one delete policy on attempts for the owner-authorised erasure, so it works under forced row security without bypass; the runtime role still cannot delete attempts. Migrations 0001 to 0013 unchanged. No new runtime dependency.
- Deployment remains deferred by the user.

# 0.13.0-alpha.1: cover library

- Covers can now come from a community cover library as well as an upload. The cover dialogue offers **Upload your own** or **Community library** whenever the library holds a picture; choosing one keeps its own focal point and does not copy the picture.
- Owners and administrators keep up to 24 named pictures under Community settings → Cover library: add one through the same in-browser preparation as covers, see how many covers use each, and remove unused ones, which deletes the stored file.
- Every active member can see library pictures; other communities, visitors and unlisted uploads cannot. A picture in use cannot be removed.
- Library options are native radio buttons named after their pictures, so they work from the keyboard and read clearly to screen readers.
- Additive migration 0013 with forced row security for the library and a restrictive policy for unlisted library uploads; migrations 0001 to 0012 unchanged. No new runtime dependency, no stock photo service.
- The demo library has one fictional picture: the bundled landscape, cropped so its caption does not show.
- The connected cover check now runs the live API under the restricted runtime role with forced row security.
- Deployment remains deferred by the user.

# 0.12.0-alpha.1: track instructors

- Owners and administrators name instructors for a track from an Instructors dialogue on the track page. The new instructor is notified.
- Instructors author their track's lessons, files, knowledge checks and cover, and mark its knowledge checks, from a new Teaching page. They cannot change other tracks, choose instructors or open Community studio.
- Rights come only from explicit grants; being shown as a track's author grants nothing, and upgrading grants nothing.
- One per-track rule in the domain and in row security; other tracks stay invisible to an instructor; suspension ends access at once; grants are added or removed, never rewritten.
- Additive migration 0012; migrations 0001 to 0011 unchanged. No new runtime dependency.
- The demo adds Preview as instructor (Idris Cole, product track).
- The connected instructor check runs the live API under the restricted runtime role with forced row security.
- Deployment remains deferred by the user.

# 0.11.0-alpha.1: cover images

- Upload your own cover for a track or project. Administrators set track covers; a project's owner or an administrator sets its cover.
- Choose or drop a picture, set the focal point by clicking or with keyboard-operable sliders, preview the banner, card and small crops, then save or remove.
- The browser resizes each picture to 1,600 pixels before upload, which also drops metadata such as location. PNG stays PNG when it fits, so transparent logos keep their transparency.
- Without a cover, a plain neutral panel with one muted icon shows. The generated art, its shapes and every word written on it are retired; titles stay below the picture.
- Uploads reuse the verified private pipeline: subject-bound intents, exact signed POST policies, signature and dimension checks on the pinned generation. Bytes come from an access-checked same-origin route with private caching and a sandboxing content security policy.
- Additive migration 0011 with a restrictive RLS policy for cover uploads; migrations 0001 to 0010 unchanged. No new runtime dependency.
- The connected resources and knowledge-check scans cover the whole learner page again, the monochrome suite checks the plain panel on a new track, and the design contract now checks every web stylesheet. This replaces the earlier contrast patch for text on custom covers, which never reached main.
- Fix: a project post in the feed always linked to Common Ground; it now links to the project it names.
- Deployment remains deferred by the user.

# 0.10.0-alpha.1: knowledge checks

- Add one optional knowledge check per lesson: single choice, multiple choice, short answer and written response, with an optional pass mark, attempt limit and answer-reveal rule.
- Checks follow the existing private draft, preview, publication, capture and restore; revision history records them.
- Score on the server only; learners never receive answer keys before the author's rule allows it; answers to a check that changed meanwhile are refused.
- Attempts keep the quiz they answered and are immutable apart from one review. Owners and administrators who are not the learner mark written answers and send feedback from a Knowledge checks tab in Community studio.
- Scores are private feedback: no reputation points, no automatic completion, no credentials.
- Additive migration 0010 with forced RLS, column-level review grants and no DELETE for the application role; migrations 0001 to 0009 unchanged. No new runtime dependency.
- Fix: `npm run dev` showed a blank page because a lazy page was declared above its React import; a static test now guards module order.
- Deployment remains deferred by the user.

# 0.9.0-alpha.1: private lesson resources

- Attach ordered, named and described files to lesson drafts; replace and remove them; release them only on publication.
- Revision history keeps each version's files; restoring a revision brings them back into the draft.
- Extend the existing upload-intent API and Google Cloud Storage adapter: track-scoped keys, signature checks, generation pinning, two-minute attachment downloads.
- One download rule for lessons, drafts and revisions, with a restrictive RLS policy in depth.
- Additive migration 0009; migrations 0001–0008 unchanged. No new runtime dependency.
- The fictional demo keeps file bytes in the browser and includes a generated sample worksheet.
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
