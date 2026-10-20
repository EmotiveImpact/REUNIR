# Ferven roadmap

## Product mission, not a new scope

People + Purpose + Progress + Projects + Proof. People join to become, build or achieve something. Code Black is the first tenant, not a hard-coded fork. Keep the full product doctrine in PRODUCT_DOCTRINE.md and the researched reuse decisions. No artificial engagement score grants permissions or credentials.

## Built and preserved

| Wave | Delivered implementation | Remaining boundary |
| --- | --- | --- |
| Alpha 01 | Communities, spaces/posts/comments, learning, missions, projects, events, notifications, search and moderation | Local engineering alpha, not a hosted launch |
| Alpha 02 | Purpose, paths, milestones, private goals, contributions, reviewed outcomes and outputs | Community review, not accreditation or portable credentials |
| Alpha 03 | Invitations/recovery, durable mail queue, participant-private 1:1 messaging, blocking/reporting and member access | Email needs configured delivery; no group chat/MFA |
| Alpha 04 | Pilot console, runtime privilege guards, fenced retries and release tooling | Observations are not production certification |
| Alpha 05 | Project workboards, assignments, task discussion and existing proof review | Task files and live board updates followed in Alpha 29 (decision 029); no files on notes, presence or server push |
| Alpha 06 | Private lesson drafts, explicit publishing, revision history, restore-as-draft and ordering | Plain text/resource links; no rich blocks/private attachments |
| Alpha 07 | Approved v4 shell/Home in the actual React application, shadcn Button/Avatar/Menu, photo fixtures and responsive navigation | Not a full replacement of every form with shadcn; hosted pilot remains separate |
| Alpha 08 | Rich lesson editing with Tiptap, safe external images and YouTube/Vimeo, compatible rich and plain revisions | External media only; no uploads |
| Alpha 09 | Private lesson files: ordered, named, described, replaceable and removable, following draft, preview, publication and revision; verified uploads and access-gated downloads | No malware scanning; real bucket, IAM and CORS unverified |
| Alpha 10 | Knowledge checks in lessons: four question kinds, server-side scoring, private attempts, a review queue with marks and feedback, answer reveal under the author's rule | Not credentials or reputation; no question banks, timers, partial credit, exports or erasure procedure |
| Alpha 11 | Uploaded track and project covers with a focal point, or a plain panel; decorative art and text on pictures retired | No server-side thumbnails or alt text field; removed pictures are pruned later, not erased at once |
| Alpha 12 | Explicit track instructors who author and review one track from a teaching page, with RLS in depth | No invitations, contributor roles, per-lesson grants or instructor-created tracks |
| Alpha 13 | A community cover library: administrators add named pictures; anyone who may change a cover uploads their own or chooses one | Up to 24 pictures; no stock search, renaming or tagging |
| Alpha 14 | Members download their own learning record; owner-authorised erasure of a learner's answers and clearing of unused cover files; review queues paged with exact totals | No account deletion or identity scrubbing; queue paging is in the interface, not the server |
| Alpha 15 | People delete their own account; posts, comments and project work stay as Former member, private things and the learning record go, messages stay for the other person; owners refused | No ownership transfer; mentions inside other people's posts stay; hosted Better Auth and real email unverified |
| Alpha 16 | Owners hand a community to an administrator with their password and the community's name; the previous owner stays as an administrator and can then delete their account | Only to an existing administrator; the new owner is told, not asked; hosted Better Auth unverified |
| Alpha 17 | Deleting an account hands back claimed tasks everywhere, suspended communities included; replaced covers are erased at once; the deletion-during-acceptance case is tested | Mentions in other people's posts stay as written; real bucket deletion unverified |
| Alpha 18 | Notices, knowledge-check review queues and the audit trail load a page at a time with exact counts; workspace reads stop growing with those histories | Posts, tasks and other collections still load with the snapshot; no archive of old notices yet |
| Alpha 19 | Members turn off notice topics per community and may get a daily or weekly email digest of unread notices; access notices always arrive | No mail provider or scheduler configured; no per-notice switches or quiet hours |
| Alpha 20 | Owners and administrators invite someone new by email to teach one track; accepting makes them a member and that track's instructor | Only while the sender still administers; one track per invitation; no contributor roles or instructor-created tracks |
| Alpha 21 | Two-step sign-in with an authenticator app and backup codes for anyone; owners and administrators need it to use their authority when the server requires it (the production default) | No passkeys, QR code or trusted devices; recovery without backup codes is an operator task; hosted Better Auth unverified |
| Alpha 22 | Whoever may change a track or project cover can describe the picture; the track's or project's own page announces it to screen readers | No descriptions for library pictures themselves, automatic descriptions or translations |
| Alpha 23 | Every upload is scanned with ClamAV before it can be used when a scanner is configured; flagged files are deleted, and uploads wait while the scanner is unavailable. Required by default in production | No rescanning when signatures update, no quarantine; a real clamd is unverified |
| Alpha 24 | Members start named group conversations of up to 20 people; anyone in a group adds people and renames it, the starter removes people, anyone leaves; people added later read only what follows | No join or leave lines, mentions, attachments or new-message notices; blocks stop adding but never pause a group |
| Alpha 25 | Teaching grants name a role: instructors publish and review, contributors write a track's drafts and files for them | No contributor invitations, per-lesson grants or instructor-created tracks yet |
| Alpha 26 | People confirm their email address by a link, and invitations confirm it; when the server requires it (the production default) an unconfirmed address cannot sign in; anyone changes their address with their password and a link to the new one | Needs a mail sender; no confirmation step at the old address; invitations already sent stay with the old address; real delivery unverified |
| Alpha 27 | Calm loading outlines, route error boundaries that keep navigation with Try again, a Not found page, offline and failed-refresh notices, marked command failures and role-aware empty states (STATES.md) | Not yet guided by real pilot observations; connected-mode offline and expired-session screens are unit-tested, not browser-tested |
| Alpha 28 | Owners, administrators and moderators curate collections such as "Start here" from posts, tracks, lessons, paths, projects, events, missions and outputs, with notes and order; one is featured on Home | Items show only to people who can already see them; no notifications, tags or cross-community collections |
| Alpha 29 | Project teams attach files to tasks through the verified private upload path; boards and open tasks refresh within seconds, and edit conflicts name who changed the task | Polling, not push; no presence; real bucket and a real scanner on task files unverified |
| Alpha 30 | Every form uses the shared shadcn components: Input, Textarea, Label, Native Select, Checkbox, Radio Group, Switch and Button (FORMS.md) | The dialogue stays a native modal `dialog` with shadcn slots; file pickers and focal-point sliders stay native; legacy element styles still set the look |
| Alpha 31 | Housekeeping is cleared on a schedule by one list of rules (sessions, links, rate counters, request receipts, change events, finished mail, read notices); Your account says how long everything is kept | The same periods for every community; the audit trail is kept for the life of the community; nothing is scheduled until the operator chooses |
| Alpha 32 | The author of a hidden post is told, still sees it, and can appeal; an owner or administrator who did not hide it decides, replies, and restores or keeps it hidden | Hidden posts only; one level of appeal; no time limit; suspension and message reports are not appealable here |
| Alpha 35 | A teaching grant covers the whole track or lessons an administrator chooses; drafts, publishing and answer review follow the chosen lessons | No lesson grants by invitation; new lessons, order and cover stay with whole-track grants |
| Alpha 36 | Instructors of a whole track start new tracks, unpublished until an administrator publishes them | No archiving or deleting by instructors, no publishing without an administrator |
| Alpha 37 | Creators upload MP4 and WebM lesson video that learners play in the lesson; off until the operator sets a limit of up to 500 MB | No transcoding or captions; scanning large video needs clamd's stream limit raised |
| Alpha 39 | Administrators rename and tag cover library pictures (up to 60); the picker filters by name or tag; cards and lists load a 480-pixel copy checked by the server | No stock search or backfilled copies for existing covers; real bucket signing for the second policy unverified |
| Alpha 33 | Authors ask to correct reviewed evidence and a reviewer decides; authors or administrators withdraw it with a reason; each item keeps its history | Withdrawal cannot be undone; mission proof has no correction history; no community-wide change log |
| Alpha 34 | Authors credit teammates on a contribution; each person accepts or declines; accepted credits show on the contribution and the person's profile and never count as evidence | Project team members only; contributions only; no moderation of credit descriptions; no public or cross-community display |
| Alpha 41 | Pre-pilot review: every suite passed on main; member uploads bounded, Better Auth's update-user route closed, invitation limits split by route, HSTS and Permissions-Policy headers | Scanning moved out of the upload request in Alpha 42 |
| Alpha 42 | Virus scanning runs in a separate worker beside clamd, not in the upload request: files wait as being checked, large videos are streamed to the scanner, and the upload completes even if the person leaves the page | One worker, polling; no rescanning when signatures update; files over clamd's stream limit wait unscanned; real clamd, bucket and worker host unverified |
| Alpha 44 | Feeds (conversation, spaces, Saved, Knowledge) and archived tasks load a page at a time; the snapshot carries a window of posts and only active tasks | The server still reads every post, comment and reaction into memory and refuses past 5,000 rows in a table (see the next slices) |
| Alpha 46, 47 | Staging launch prepared: `.env.staging.example`, `launch:secrets`, `launch:smoke`, STAGING_LAUNCH.md; a scan host package and Cloud Scheduler steps for Vercel Hobby | Nothing provisioned; uploads wait for the owner to approve the scan host |
| Alpha 48 | Lessons lead with their video, full width, above the reading | No chapters, captions or resume position |
| Alpha 50 | October audit, security: invitations lapse with their sender's authority, per-visitor invitation limits first, `TRUSTED_IP_HEADER`, two-step sign-in for every admin file power, a report-only Content-Security-Policy | The policy is enforced only after a clean staging run |
| Alpha 51 | October audit, app: failures shown inside dialogues, an access-changed screen, video error recovery, focus and titles on page change, announced states, a 9px type floor | Not tried with a real screen reader; the browser's own confirm dialogue remains in 14 places |
| Alpha 52 | October audit, records: status notes, READMEs, roadmap and runbook match main; the source manifest is regenerated by `publish_source.py --write-manifest` | |
| Alpha 53 | Feeds paged in SQL: a window of posts per request, feed pages and post counts from the database, so posts, replies and appreciations have no 5,000-row ceiling | Other collections keep the 5,000-row limit |
| Alpha 54 | Leaving and removal from project teams (migration 0048), WebVTT captions on lesson videos, and lesson videos that pick up where this browser stopped | Positions do not follow a learner between devices; embedded videos keep their own players |
| Alpha 55 | One confirmation box across the app in place of the browser's own, with named actions and Cancel first | None |
| Alpha 56 | Partial marks on multiple-choice questions, chosen per question by the author | Question banks and timers stay parked |
| Alpha 57 | Chapters on uploaded lesson videos, typed by the author and listed under the video for learners | Embedded videos keep their own players' chapters |
| Alpha 58 | Appeals for suspensions, made from the account and decided by an owner or administrator who did not suspend, and one second look at a closed message report | Appeals against removal from a community |
| Alpha 59 | Credits on outcomes, with consent, shown on the outcome, its archived output and the credited person's profile | Public portfolios and credits across communities |
| Alpha 60 | Usage counts per part of a community, with no person recorded, small counts hidden and an opt-out | Distinct visitors, exports and per-community keeping periods |
| Alpha 61 | Every visible use of the old name says Ferven: the app, mark, emails, calendar export and two-step issuer | Internal names (`reunir` package, `REUNIR_` settings, logs) unchanged by design |
| Alpha 62 | Tidier People cards and plain panels for tracks and projects without a picture | None |
| Alpha 63 | Readable text on phones: nothing under 11 pixels, generated by `scripts/phone_type.py` | Laptops and desktops unchanged |
| Alpha 64 | The demo calendar follows today, so upcoming events and recent activity always show | A saved demo keeps its dates until it is reset |
| Alpha 65 | Link previews for shared Ferven links and add to home screen on phones | Clean web addresses left out on purpose: sign-in tokens stay after `#` |
| Alpha 66 | Records and code tidied: short current handover and status, history archived unchanged | No behaviour change |

UI_DESIGN_DIRECTION.md records the approved interface. Do not restart design exploration or discard existing routes while implementing the next feature.

## Deployment waits for the owner

The owner will create the staging accounts and run hosted tests. Product work continues without treating deployment as a prerequisite or claiming it is done. Every release is merged into main through its own pull request once GitHub Actions passes; CHANGELOG.md lists them and BUILD_STATUS.md records the evidence. The demo at https://ferven.vercel.app follows main.

## Release work when deployment resumes: make the pilot operable

1. **Source publication completed:** PR #1 contains the full Alpha 07 tree, verified against recovered checkpoint `76b31ab` and fetched back without differences. Preserve historical transport/dependency branches without merging them into the app. Never force-push or overwrite parallel work.
2. **Application and PostgreSQL CI completed:** run 36964804738 passed all application, HTTP, demo-browser, connected-browser and PostgreSQL checks on commit `75b3f2b`. PR #1 tracks the final source integration. Dependency-resolution CI is no longer the only remote evidence.
3. Connect the intended dedicated Neon staging database, run every migration in `packages/db/migrations` (38 files on main at Alpha 66, ending at `0051_usage_counts.sql`) and the restricted-runtime grants. Do not reuse another application's database or put migration credentials on the web server.
4. Connect a live-mode Vercel staging build, verified transactional sender and scheduled mail worker. Provision the real owner, use approved Code Black content and receive actual invitation/recovery messages.
5. Complete hosted-browser two-person/two-tenant privacy tests, backups and restore rehearsal, monitoring and support/moderation responsibility. Only then invite a small consented Code Black pilot.

## Next product slices

In order, once the owner is ready:

1. **Launch staging** (STAGING_LAUNCH.md) and run the hosted checks the code cannot prove alone: real sign-up and email, two-person and two-community privacy, backups and a restore rehearsal (LAUNCH_RUNBOOK.md).
2. **Enforce the Content-Security-Policy** after a clean staging run; it is report-only until then.
3. **A small, consented Code Black pilot.** Let what members actually do decide the next features, and refine loading, error and empty screens (STATES.md) from what they see.

Product work that can continue without the owner, smallest first:

- **Scale:** posts, replies and appreciations are paged in SQL (Alpha 53), but other collections still load into memory and refuse past 5,000 rows a table. Page them the same way before a large community joins.
- **Trust:** appeals against removal from a community (suspensions and message reports are appealable since Alpha 58).
- **Pictures:** smaller copies for covers uploaded before Alpha 39, and descriptions for the cover library's own pictures.
- **Parked until pilots ask:** question banks and timers, distinct-visitor counts, exports of usage counts, public portfolios and credits across communities.

## Commercial platform stage

Owner onboarding, custom-domain verification, paid memberships and entitlements, tenant quotas, operational billing/support, migrations between hosting options and independently reviewed security/privacy. A reusable tenant model is already present; it does not mean these commercial operations are finished.

## Preserved long-term mission, deliberately deferred

Curated institutional knowledge; programme/cohort rituals; mentorship, apprenticeships, alumni and leadership succession; contribution relationships and consented portable proof profiles; outcome-based reporting; AI that helps people find relevant human collaborators and work. Funding, marketplaces, cross-community discovery and sophisticated credentials are not this release's completion criteria.

No arbitrary percentage describes the entire vision. Track each slice as implemented, verified locally, verified remotely, deployed or operated with real members.
