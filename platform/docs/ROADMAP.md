# REUNIR roadmap after track instructors

## Product mission, not a new scope

People + Purpose + Progress + Projects + Proof. People join to become, build or achieve something. Code Black is the first tenant, not a hard-coded fork. Keep the full product doctrine in PRODUCT_DOCTRINE.md and the researched reuse decisions. No artificial engagement score grants permissions or credentials.

## Built and preserved

| Wave | Delivered implementation | Remaining boundary |
| --- | --- | --- |
| Alpha 01 | Communities, spaces/posts/comments, learning, missions, projects, events, notifications, search and moderation | Local engineering alpha, not a hosted launch |
| Alpha 02 | Purpose, paths, milestones, private goals, contributions, reviewed outcomes and outputs | Community review, not accreditation or portable credentials |
| Alpha 03 | Invitations/recovery, durable mail queue, participant-private 1:1 messaging, blocking/reporting and member access | Email needs configured delivery; no group chat/MFA |
| Alpha 04 | Pilot console, runtime privilege guards, fenced retries and release tooling | Observations are not production certification |
| Alpha 05 | Project workboards, assignments, task discussion and existing proof review | No task file uploads or realtime collaboration |
| Alpha 06 | Private lesson drafts, explicit publishing, revision history, restore-as-draft and ordering | Plain text/resource links; no rich blocks/private attachments |
| Alpha 07 | Approved v4 shell/Home in the actual React application, shadcn Button/Avatar/Menu, photo fixtures and responsive navigation | Not a full replacement of every form with shadcn; hosted pilot remains separate |
| Alpha 08 | Rich lesson editing with Tiptap, safe external images and YouTube/Vimeo, compatible rich and plain revisions | External media only; no uploads |
| Alpha 09 | Private lesson files: ordered, named, described, replaceable and removable, following draft, preview, publication and revision; verified uploads and access-gated downloads | No malware scanning; real bucket, IAM and CORS unverified |
| Alpha 10 | Knowledge checks in lessons: four question kinds, server-side scoring, private attempts, a review queue with marks and feedback, answer reveal under the author's rule | Not credentials or reputation; no question banks, timers, partial credit, exports or erasure procedure |
| Alpha 11 | Uploaded track and project covers with a focal point, or a plain panel; decorative art and text on pictures retired | No server-side thumbnails or alt text field; removed pictures are pruned later, not erased at once |
| Alpha 12 | Explicit track instructors who author and review one track from a teaching page, with RLS in depth | No invitations, contributor roles, per-lesson grants or instructor-created tracks |
| Alpha 13 | A community cover library: administrators add named pictures; anyone who may change a cover uploads their own or chooses one | Up to 24 pictures; no stock search, renaming or tagging |

UI_DESIGN_DIRECTION.md records the approved interface. Do not restart design exploration or discard existing routes while implementing the next feature.

## Deployment deferred by the user

The user will clone, deploy and run hosted tests later. Continue product development without treating deployment as a prerequisite or claiming it is complete. Alpha 08 added rich lesson editing, safe external media and compatible revisions (RICH_LESSONS.md); PR #2 was merged after CI run 36969054997 passed. Alpha 09 added private lesson resources (LESSON_RESOURCES.md); PR #3 was merged after CI runs 37061204163 and 37061210244 passed. Alpha 10 added knowledge checks (ASSESSMENTS.md); PR #4 was merged after CI runs 37067079371 and 37067083907 passed. Alpha 11 added cover images (COVERS.md), Alpha 12 track instructors (INSTRUCTORS.md) and Alpha 13 the cover library (COVERS.md), all on PR #5; BUILD_STATUS.md records their local and remote verification. A hosted bucket needs the storage steps in SETUP.md when deployment resumes.

## Release work when deployment resumes: make the pilot operable

1. **Source publication completed:** PR #1 contains the full Alpha 07 tree, verified against recovered checkpoint `76b31ab` and fetched back without differences. Preserve historical transport/dependency branches without merging them into the app. Never force-push or overwrite parallel work.
2. **Application and PostgreSQL CI completed:** run 36964804738 passed all application, HTTP, demo-browser, connected-browser and PostgreSQL checks on commit `75b3f2b`. PR #1 tracks the final source integration. Dependency-resolution CI is no longer the only remote evidence.
3. Connect the intended dedicated Neon staging database, run the twelve existing migrations and restricted-runtime grants. Do not reuse another application's database or put migration credentials on the web server.
4. Connect a live-mode Vercel staging build, verified transactional sender and scheduled mail worker. Provision the real owner, use approved Code Black content and receive actual invitation/recovery messages.
5. Complete hosted-browser two-person/two-tenant privacy tests, backups and restore rehearsal, monitoring and support/moderation responsibility. Only then invite a small consented Code Black pilot.

## Next product slices

**Creator Studio:** Rich editing and safe external media (Alpha 08), private lesson resources with lesson/space access inheritance (Alpha 09) and knowledge checks with private attempts and reviewed feedback (Alpha 10) are implemented. Instructor-scoped authoring and review followed in Alpha 12. Next: a paginated review queue, a learner's export of their own attempts, and an operator procedure for erasing a learner's answers and removed covers. Question banks, partial credit and timers wait for real pilot needs.

**Everyday reliability:** page-level cursor pagination beyond messages, notification preferences/digests, useful content curation. Course and project art is now uploaded by each community (Alpha 11); smaller renditions for thumbnails can follow real usage. Improve loading/error/empty states through real pilot observations.

**Account and trust operations:** privileged MFA, general email verification/change, export/deletion and retention, ownership transfer, moderator appeals/escalation, reviewed-evidence correction/revocation history and consented multi-contributor credits.

## Commercial platform stage

Owner onboarding, custom-domain verification, paid memberships and entitlements, tenant quotas, operational billing/support, migrations between hosting options and independently reviewed security/privacy. A reusable tenant model is already present; it does not mean these commercial operations are finished.

## Preserved long-term mission, deliberately deferred

Curated institutional knowledge; programme/cohort rituals; mentorship, apprenticeships, alumni and leadership succession; contribution relationships and consented portable proof profiles; outcome-based reporting; AI that helps people find relevant human collaborators and work. Funding, marketplaces, cross-community discovery and sophisticated credentials are not this release's completion criteria.

No arbitrary percentage describes the entire vision. Track each slice as implemented, verified locally, verified remotely, deployed or operated with real members.
