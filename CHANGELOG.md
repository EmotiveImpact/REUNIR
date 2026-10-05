# Changelog

Every release of REUNIR so far, newest first. Each release opens with a short plain-language summary of what changed for people using the app, followed by the technical details recorded at the time.

Alpha 01 to Alpha 07 were built and tested outside GitHub and reached main together in PR #1. From Alpha 08 onwards each release arrived on main through its own pull request, listed under its heading. Exact test runs, failed attempts and what remains unverified are in [platform/docs/BUILD_STATUS.md](platform/docs/BUILD_STATUS.md) and the files in [platform/docs/history](platform/docs/history).

Nothing in this list has been deployed. Deployment remains deferred by the owner.

## Alpha 41: pre-pilot hardening and current records (no version change), 5 October 2026

On a pull request from `claude/platform-review-b99gh7`, merged once its checks pass. Decision 041; no migration. The version stays 0.39.0-alpha.1.

**In plain language:** a review of the whole platform after every planned feature landed. Every test suite passed on main and no privacy or cross-community gap was found. Four small openings were closed so that one person cannot fill storage, set a name that skips the rules, or block other people's invitations, and the status notes now match what is on main.

Details:

- The original member upload route allows five unfinished uploads at once and fifty kept files per person per community (429 `UPLOADS_IN_PROGRESS`, 409 `UPLOAD_LIMIT`).
- Better Auth's own `/api/auth/update-user` returns 404, like `/api/auth/change-email`.
- Each invitation route (look up, accept, register) has its own global rate limit.
- `vercel.json` adds Strict-Transport-Security and Permissions-Policy. LAUNCH_RUNBOOK.md adds checks for a Content-Security-Policy and for the 30 second function limit when scanning large video.
- Records: Alpha 37 is recorded as merged; README files, ROADMAP.md and the runbook's migration count (33 files, with 0024 to 0027 and 0037 never used) match main.

## Alpha 37: uploaded lesson video (no version change), 3 October 2026

On main through [PR #31](https://github.com/EmotiveImpact/REUNIR/pull/31), merged on 4 October 2026 as `d726e8f`, whose tree is identical to the tested head `f8d0361`. Decision 037 and migration 0036, from the block allocated to courses and teaching. Alpha 39 is already on main, so the version stays 0.39.0-alpha.1.

**In plain language:** creators can now upload their own MP4 or WebM video to a lesson, alongside YouTube and Vimeo embeds. Learners press **Play** and watch it in the page; the video stays private to people who can open the lesson. It is off until whoever runs the server sets a size limit.

Details:

- `LESSON_VIDEO_MAX_MB` (1 to 500) switches video on and sets the largest file; unset or 0 keeps it off (403 `VIDEO_UPLOADS_OFF`), larger files get 413 `FILE_TOO_LARGE`. Other lesson files stay at 10 MB.
- Video is checked by its file signature like every lesson file and stored privately under the track.
- **Play** asks the server for a signed inline link valid for two hours, after the same access check as a download; downloads stay two-minute attachments (decision 037).
- Additive migration 0036 lets only lesson files declared as MP4 or WebM exceed 10 MB in upload intents, never 500 MB. No grant change.
- Video is scanned like every upload when a scanner is configured (Alpha 23). clamd refuses streams over 25 MB by default, so the launch preflight warns to raise `StreamMaxLength` when larger video is switched on; until then such uploads stay pending, never unscanned.
- The launch preflight, `.env.example` and LAUNCH_RUNBOOK.md cover `LESSON_VIDEO_MAX_MB`.

## 0.30.0-alpha.1 (Alpha 30): every form on the shared shadcn components, 3 October 2026

On main through [PR #32](https://github.com/EmotiveImpact/REUNIR/pull/32), merged as `ec9181d`. The package version stays at 0.39.0-alpha.1, set by Alpha 39.

**In plain language:** every form in the app now uses the same set of shared components for text boxes, labels, drop-down lists, tick boxes, choice buttons and on/off switches. Nothing looks different and nothing moves; keyboard and screen-reader behaviour is now consistent everywhere.

Details:

- Seven more adapted shadcn new-york-v4 components (Input, Textarea, Label, Native Select, Checkbox, Radio Group, Switch) over four exactly pinned Radix packages; notices, licences and register entries added.
- Field names, ids, labels, validation and submit handlers are unchanged. Show archive and showing answers after a knowledge check became switches.
- The dialogue keeps its native modal `dialog` with shadcn slots and a shadcn close button. File pickers and focal-point sliders stay native.
- New `test:browser:forms` in CI and a Python contract check (`scripts/test_forms_contract.py`). FORMS.md and decision 030 explain the choices.

## 0.29.0-alpha.1 (Alpha 29): files on project tasks and live project work, 3 October 2026

On main through [PR #27](https://github.com/EmotiveImpact/REUNIR/pull/27), merged as `2561a00`. The package version stays at 0.39.0-alpha.1, set by Alpha 39.

**In plain language:** project teams can now attach files to tasks, through the same private, checked upload path as lesson files. Workboards and open tasks update within a few seconds when a teammate changes something, and if someone changes a task you are editing, you are told who and choose whether to load their version or keep your own edits.

Details:

- **Task files:** up to 12 per task and 200 per project, the same types and 10 MB limit as lesson files, and the same virus scanning (Alpha 23) when a scanner is configured. Only people who can currently work on the project can download them; suspension ends access at once. The uploader, the project lead or an active owner or administrator can remove a file, and its stored copy is deleted once the change commits.
- Account deletion keeps attached files as Former member work and removes the person's unfinished uploads; `db:prune-covers` also clears stale task uploads.
- **Live project work:** the browser checks a small per-project change endpoint every 5 seconds while the tab is visible (304 when nothing changed), pauses when hidden and backs off on errors. No new infrastructure; server-sent events could replace it later behind the same hook.
- **Edit conflicts:** a task changed by someone else while you edit shows who changed it and when, keeps your text and waits for you to load theirs or keep yours. No presence indicator, by choice.
- Additive migration 0029 adds `upload_intents.task_id`, `project_tasks.updated_by` and four restrictive row-security policies; no grant change (decision 029). Task files go through Alpha 23 upload scanning on the shared upload path.
- New demo browser suite `npm run test:browser:task-files`. No new dependency.

## Alpha 36: instructors start their own tracks (no version change), 3 October 2026

On main through [PR #28](https://github.com/EmotiveImpact/REUNIR/pull/28), merged as `99e919a`. Decision 036 and migration 0035, from the block allocated to courses and teaching. Alpha 39 is already on main, so the version stays 0.39.0-alpha.1.

**In plain language:** someone who already teaches a whole track can now start a new track themselves instead of asking an administrator. The new track stays hidden from members until an owner or administrator publishes it. Administrators are told when a track is started, and the person who started it is told when it is published.

Details:

- **Start a track** on Learning and on the Teaching page for active instructors of at least one whole track. Contributors and lesson-only grants cannot (403 `TRACK_STARTER_REQUIRED`).
- The track starts unpublished, authored by its starter, with their own whole-track instructor grant. Only its teachers and the community's owners and administrators see it, marked **Not published**.
- **Publish track** (`track.publish`, owners and administrators) makes it visible, records `track.published` in the audit and tells the starter (decision 036).
- Additive migration 0035 adds one INSERT policy, `instructor_own_track`, that admits only that self-grant. No grant change.

## Alpha 34: crediting teammates on a contribution (no version change), 3 October 2026

On main through [PR #30](https://github.com/EmotiveImpact/REUNIR/pull/30), merged as `5f7b827`. This thread holds Alpha 31 to 34 and migrations 0030 to 0033, so this is Alpha 34 with decision 034 and migration 0033. Alpha 39 reached main first, so the application version stays 0.39.0-alpha.1.

**In plain language:** when you record a contribution to a project, you can now credit the teammates who did the work with you. Each person is asked first and only appears once they accept. Accepted credits show on the contribution ("With Nia James") and on the person's profile under Credited on. A credit is a thank-you, not evidence: it never counts towards milestones, goals, outcomes or roles.

Details:

- **Credit a teammate** on your own contribution: an active member of the project's team, with an optional short description such as "co-author". They accept or decline; either of you can later remove an accepted credit.
- Invitations, refusals and withdrawals are private to the two people involved. Administrators do not see them.
- Someone who declined, or removed their own credit, cannot be asked again by the author. At most 10 live credits per contribution.
- A person credited on a contribution cannot review it.
- Additive migration 0033: `contribution_credits` under forced row security, with column-level updates on the answer and withdrawal fields only. Deleting your account deletes every credit naming you.
- Community review, not accreditation (decision 034).

## Alpha 33: correcting and withdrawing reviewed evidence (no version change), 3 October 2026

On main through [PR #29](https://github.com/EmotiveImpact/REUNIR/pull/29), merged as `e930e39`. This thread holds Alpha 31 to 34 and migrations 0030 to 0033, so this is Alpha 33 with decision 033 and migration 0032. Alpha 39 reached main first, so the application version stays 0.39.0-alpha.1.

**In plain language:** you can now ask to correct a recognised contribution or verified outcome, and a reviewer decides, just as they did the first time. You or an administrator can also withdraw reviewed evidence that turned out to be wrong. Nothing is rewritten in secret: each item keeps a history of the wording that was reviewed, what changed, when and why.

Details:

- **Correct…** on a recognised contribution or verified outcome (author only). The project owner and administrators review a contribution's correction; administrators review an outcome's. Nobody reviews their own. The reviewed version stays until the correction is accepted, and a published output follows its outcome.
- **Withdraw…** (author or administrator, with a reason) is immediate and final. Withdrawn evidence stays visible, marked withdrawn, and stops counting towards path milestones, profiles, goals and the output archive. Outcomes built on a withdrawn contribution are withdrawn too, and a goal completed with one reopens.
- **History** on each item lists corrections, declined corrections and withdrawals with their reasons and responses. Waiting corrections are visible only to the author and the reviewers.
- Additive migration 0032: `withdrawn` joins the contribution and outcome statuses, and `evidence_changes` sits under forced row security. The runtime role may add a change and record its decision, never reword or delete one.
- Community review, not accreditation (decision 033).

## Alpha 32: appealing a hidden post (no version change), 3 October 2026

On main through [PR #26](https://github.com/EmotiveImpact/REUNIR/pull/26), merged as `f3efa39`. This thread holds Alpha 31 to 34 and migrations 0030 to 0033, so this is Alpha 32 with decision 032 and migration 0031. Alpha 39 (PR #21) reached main first, so the application version stays 0.39.0-alpha.1.

**In plain language:** when a moderator hides your post, you are now told, you can still see it, and you can ask for it to be looked at again. An owner or administrator who did not hide it decides, writes you a reply, and either restores the post or keeps it hidden. Appeals are private to you and the people who decide them.

Details:

- New **Appeals** page: your hidden posts, your appeals and their outcomes, and for owners and administrators the appeals waiting for a decision. The Moderation tab in the community studio lists open appeals.
- The person who hid the post, and the appellant, can never decide the appeal. If nobody else can, the appeal waits and both sides are told why.
- One open appeal per hiding; withdrawing allows another; a decided appeal closes that hiding.
- Additive migration 0031: `posts.moderated_by` and `posts.moderated_at`, and `moderation_appeals` under forced row security, with column-level updates on the decision fields only. Existing posts are not backfilled.
- Deleting your account removes your appeals; the decisions stay in the audit trail.
- Suspension, task-note removal and message reports are not appealable here (decision 032).

## Alpha 35: teaching grants for chosen lessons (no version change), 3 October 2026

On main through [PR #24](https://github.com/EmotiveImpact/REUNIR/pull/24), merged as `3c770b5`. The coordinator allocated Alpha 35 to 38 to courses and teaching, so this release is Alpha 35 with decision 035 and migration 0034. Alpha 39 reached main first, so the version stays 0.39.0-alpha.1 rather than going backwards.

**In plain language:** when you add someone to teach a track you can now give them only the lessons you choose instead of the whole track. They can write, publish and mark answers on those lessons and nothing else. New lessons, the lesson order and the track cover stay with people who have the whole track.

Details:

- **What they work on** in a track's Instructors dialogue: the whole track (the default) or chosen lessons, with a checkbox per lesson. The list names the lessons.
- Drafts, history, draft files, publishing and knowledge-check answers follow the chosen lessons; other drafts are not found (decision 035).
- Additive migration 0034 adds `track_instructors.lesson_ids` and scopes the draft, history, publishing and attempt policies to the listed lessons. Every existing grant keeps the whole track. No grant change.

## 0.28.0-alpha.1 (Alpha 28): collections of useful content, 3 October 2026

On main through [PR #25](https://github.com/EmotiveImpact/REUNIR/pull/25), merged as `94b130b`. Alpha 31 and Alpha 39 reached main first, so the package version stays at 0.39.0-alpha.1.

**In plain language:** communities can now gather useful material into collections such as "Start here". Owners, administrators and moderators pick posts, lessons, tracks, paths, projects, events, missions and community outputs, add short notes and choose the order, keeping a collection private until they publish it. Everyone sees only the items they already have access to, and one featured collection appears on Home.

Details:

- **Collections** in the second sidebar lists published collections; curators also see their drafts. A collection holds up to 50 items, each with an optional note of up to 280 characters and a manual order.
- Curators are active owners, administrators and moderators; suspension, demotion or account deletion ends curation at once. Every change is audited; nobody is notified.
- Items are filtered against each viewer's own view, so private spaces, hidden posts, unpublished lessons and missions on unpublished tracks, and other communities never leak, and a note disappears with its item. Goals, messages, bookmarks and scores can never be collected.
- At most one featured collection per community, checked by the database. A deleted account's collections stay, credited to Former member.
- Additive migration 0028 adds `collections` and `collection_items` with forced row security and column-limited updates (decision 028). Run `npm run db:grant-runtime` after migrating.
- New demo browser suite `npm run test:browser:curation`. No new dependency.

## 0.39.0-alpha.1 (Alpha 39): cover library management and small copies, 3 October 2026

On main through [PR #21](https://github.com/EmotiveImpact/REUNIR/pull/21), merged as `0a818fa`.

**In plain language:** administrators can rename and tag the pictures in the cover library, which now holds up to 60, and anyone choosing a cover can search the library by name or tag. Cards and lists now load a small copy of each cover, so pages with many covers load faster.

Details:

- Up to five tags per library picture; renaming and tagging are audited and need two-step sign-in when the server requires it.
- New covers wider than 480 pixels get a 480-pixel copy made in the browser and checked by the server; covers without one fall back to the full picture (decision 039).
- When a virus scanner is configured (Alpha 23), the small copy is scanned whole as well; a flagged copy is deleted and the picture keeps working at full size.
- Additive migration 0038; run `npm run db:grant-runtime` after migrating. No new runtime dependency.
- Parallel threads now take numbers from agreed blocks, and this one holds Alpha 39 to 40, migrations 0038 to 0039 and decisions 039 to 040, so this release is Alpha 39 with migration 0038 and decision 039. It was first opened as Alpha 23, then renumbered to Alpha 27 before the blocks were agreed; gaps in the sequence on main are expected.

## Alpha 23: virus scanning of uploads (no version change), 3 October 2026

On main through [PR #16](https://github.com/EmotiveImpact/REUNIR/pull/16), merged as `16b2768`. Alpha 23 was allocated to this slice before it was built; it reaches main after Alpha 31, so the version stays 0.31.0-alpha.1 rather than going backwards.

**In plain language:** once a virus scanner is connected, every file people upload (lesson files, cover pictures, library pictures and attachments) is checked before anyone can use it. A flagged file is deleted straight away and the uploader is told why. If the scanner is briefly unavailable, the upload simply waits and can be tried again.

Details:

- ClamAV's clamd is reached over TCP with its `INSTREAM` command (`CLAMAV_HOST`, `CLAMAV_PORT`); no new runtime dependency and no paid service.
- The whole stored file is scanned at the exact generation that is then recorded and served. Flagged files return 422 `FILE_FLAGGED` and are deleted; no verdict returns 503 `SCAN_UNAVAILABLE` and the upload stays pending.
- `UPLOAD_SCANNING` (`required` or `optional`, required by default in production): with a bucket and no scanner, a production server will not start. `npm run scan:check` tests a configured clamd with the EICAR test file (decision 023).
- `npm run launch:preflight` and LAUNCH_RUNBOOK.md cover the scanner: clamd runs on a private network beside the API, since Vercel functions cannot run it.
- A rejected member attachment can no longer be completed again. No database migration.

## 0.31.0-alpha.1 (Alpha 31): data retention rules, 3 October 2026

On main through [PR #23](https://github.com/EmotiveImpact/REUNIR/pull/23), merged as `b80fc04`. Numbering follows the project's allocation of 3 October 2026: this thread holds Alpha 31 to 34, decision records 031 to 034 and migrations 0030 to 0033, so data retention is Alpha 31, decision 031 and migration 0030 (first opened as Alpha 27 with migration 0023).

**In plain language:** REUNIR now clears its own housekeeping on a schedule: expired sign-in sessions and links, old rate counters, technical receipts, records of email already sent and notices people read long ago. What people make, reviewed evidence and the audit trail are never cleared by it. Your account has a new **How long things are kept** panel that says what is kept and for how long.

Details:

- One list of rules (`packages/contracts/src/retention.ts`) serves the job, the panel and `platform/docs/RETENTION.md` (decision 031).
- `npm run retention:run` is a dry run with exact counts; `RETENTION=apply` clears. An authenticated `GET /api/internal/retention` applies the rules on a schedule, `?dry=1` only counts. Counts per rule only, never contents.
- Additive migration 0030: a read-only policy so the job lists communities only as its own worker, and an index for read notices. Each community's records are cleared inside that community's tenant context.
- Nothing is scheduled; the operator chooses a daily schedule.

## 0.27.0-alpha.1 (Alpha 27): loading, error and empty screens, 3 October 2026

On main through [PR #22](https://github.com/EmotiveImpact/REUNIR/pull/22), merged as `f9f32d6`.

**In plain language:** the app now shows calm loading outlines instead of blank areas, and keeps its navigation when a page fails. Failures are explained in plain words with a Try again button, and there is a proper Not found page. Losing the connection, an ended session or a refused change is said clearly instead of silently. Empty lists tell "nothing here yet" apart from "nothing matches", and only offer a next step the person is actually allowed to take.

Details:

- Shared loading, error and empty pieces in `apps/web/src/components/states.tsx` and `states.css`, with the conventions in `platform/docs/STATES.md` (decision 027).
- Route error boundaries with Try again inside the app shell; the top-level boundary stays as the last resort. Unknown addresses show a Not found page.
- Offline and failed-refresh notices; a failed background refresh keeps the page instead of replacing the app. Failed commands, uploads and downloads show a marked error toast and keep what was typed.
- Empty states distinguish first run from no results, and actions appear only for roles that may take them.
- New demo browser suite `npm run test:browser:states`. No migration, no grant change, no new dependency.

## 0.26.0-alpha.1 (Alpha 26): confirming and changing your email address, 3 October 2026

On main through [PR #18](https://github.com/EmotiveImpact/REUNIR/pull/18), merged as `9b34cac`.

**In plain language:** people can now confirm their email address with a link, and accepting an invitation confirms it automatically. Once the app is live, an address has to be confirmed before it can sign in. Anyone can also move their account to a new email address: they enter their password, open the link sent to the new address, and their old address is told.

Details:

- **Email address** panel on Your account: the address, Confirmed or Not confirmed, **Send a confirmation link** and **Change email address…**.
- `EMAIL_VERIFICATION` (`required` or `optional`, required by default in production, applied only where mail can be sent): an unconfirmed address gets a fresh link instead of a session (decision 026).
- `POST /api/account/email` checks the password, then sends a confirmation link to the new address; the address changes only when it is opened. The current address gets a notice. Better Auth's own change-email route is closed.
- Changing or resetting the password cancels any change link asked for before it.
- The launch preflight also checks `EMAIL_VERIFICATION`.
- No migration and no new runtime dependency: Better Auth's own email verification and change-email flows, through the encrypted outbox.

## 0.25.0-alpha.1 (Alpha 25): contributor roles for teaching, 3 October 2026

On main through [PR #20](https://github.com/EmotiveImpact/REUNIR/pull/20), merged as `fab9510`. Alpha 26 (PR #18) reached main first, so the application version stayed 0.26.0-alpha.1.

**In plain language:** when you add someone to teach a track you can now make them a contributor instead of an instructor. Contributors write and save lesson drafts and attach files; the track's instructors decide when to publish them. Contributors do not see learners' quiz answers.

Details:

- **Instructor or Contributor** in a track's Instructors dialogue, with a role menu for each person. Instructor stays the default.
- Publishing, archiving, reordering, the track cover and knowledge-check review need an instructor or administrator (`INSTRUCTOR_REQUIRED`, decision 025).
- Additive migration 0023 adds `track_instructors.role` and role-aware policies for published revisions, attempts and invitations. Every existing grant stays an instructor's. No grant change.
- Database upgrade tests now count the migration files instead of a fixed number.

## 0.24.0-alpha.1 (Alpha 24): group conversations, 3 October 2026

On main through [PR #19](https://github.com/EmotiveImpact/REUNIR/pull/19), merged as `d62424d`.

**In plain language:** you can now start a private group conversation in Messages with two or more people from your community, up to 20 in all. Anyone in the group can add people and rename it, and anyone can leave. Someone added later only sees what is written after they join.

Details:

- **New group** in Messages: a name and at least two other active members. Groups show in the inbox by name, each message shows who wrote it, and **People** lists everyone, adds people, renames the group and leaves it. Only the person who started a group can remove others.
- Only the people in a group can read it; owners, administrators and moderators have no access to groups they are not in. A block stops two people adding each other but never pauses a group they share. Reporting a message in a group works as before.
- Additive migration 0022 adds `kind`, `title` and `created_by` to conversations, the `conversation_joins` table and row-security policies for late joiners and leaving (decision 024). Run `npm run db:grant-runtime` after migrating, for the new table's grant.
- No new runtime dependency.

## Launch kit (no version change), 3 October 2026

On main through [PR #17](https://github.com/EmotiveImpact/REUNIR/pull/17), merged as `f5ec8d3`.

**In plain language:** a step-by-step launch guide and an offline check of the launch settings, so the app is ready to switch on when you decide. Nothing was provisioned and nothing is live.

Details:

- `platform/docs/LAUNCH_RUNBOOK.md` walks through every launch step in order: the Neon database and restricted runtime role, migrations, the first owner, server settings, storage, mail, Vercel, hosted privacy checks, the mail and digest scheduler, backups with a restore rehearsal, monitoring, rollback, and the written approvals needed before inviting pilot members.
- `npm run launch:preflight` checks the shape of a production environment without printing a value or opening a connection, including `ADMIN_TWO_FACTOR`.
- No migration, no runtime code change, no new dependency.

## 0.22.0-alpha.1 (Alpha 22): cover picture descriptions, 3 October 2026

On main through [PR #15](https://github.com/EmotiveImpact/REUNIR/pull/15), merged as `ec4285d`.

**In plain language:** when you set a cover for a track or project you can now describe the picture, and people using a screen reader hear that description on the track's or project's own page.

Details:

- **Describe the picture (optional)**, up to 150 characters, in the cover dialogue. Cards and lists stay decorative because their titles sit beside the picture.
- A new picture starts without a description; moving the focal point keeps it (decision 022).
- No migration, no grant change, no new runtime dependency.

## 0.21.0-alpha.1 (Alpha 21): two-step sign-in, 3 October 2026

On main through [PR #14](https://github.com/EmotiveImpact/REUNIR/pull/14), merged as `b24095a`.

**In plain language:** anyone can now turn on two-step sign-in, using a code from an authenticator app or a one-time backup code. Owners and administrators need it before they can use their community tools when the server asks for it, which it does by default once the app is live.

Details:

- **Two-step sign-in** on Your account: turning it on needs the password and a correct code; ten backup codes are shown once. Turning it off and making new backup codes need the password.
- `ADMIN_TWO_FACTOR` (`required` or `optional`, required by default in production): without two-step sign-in, an owner or administrator keeps reads and everything a member or moderator can do, but owner and administrator actions return `TWO_FACTOR_REQUIRED` (decision 021).
- Additive migration 0021 adds `auth_user.two_factor_enabled` and `auth_two_factor`; run `npm run db:grant-runtime` after migrating, for the new table's grant.
- Uses Better Auth's own two-factor plugin; no new runtime dependency.

## 0.20.0-alpha.1 (Alpha 20): inviting someone new to teach a track, 3 October 2026

On main through [PR #13](https://github.com/EmotiveImpact/REUNIR/pull/13), merged as `c137f90`.

**In plain language:** owners and administrators can now invite someone by email to teach a track. When they accept, they join the community and can teach that track straight away.

Details:

- **Invite someone new to teach** in a track's Instructors dialogue; the invitation email and page name the track, and Member access shows "To teach".
- The grant is made in the inviting administrator's name, only while they still administer the community.
- Additive migration 0020 adds the invitation's optional track and one insert policy that also checks the accepting account's address (decision 020).
- No new runtime dependency.

## 0.19.0-alpha.1 (Alpha 19): notification settings and email digests, 3 October 2026

On main through [PR #12](https://github.com/EmotiveImpact/REUNIR/pull/12), merged as `648df31`.

**In plain language:** you can now choose which kinds of notices you get in each community, and ask for a daily or weekly email listing what you have not read. Notices about your own access always arrive.

Details:

- Four topics can be turned off per community: conversations, learning, projects and events. Muting stops new notices; earlier ones stay.
- Additive migration 0019 adds `notification_preferences`; members write only their own row, and the digest job reads only who is due.
- `GET /api/internal/digests` and `npm run digests:queue` queue digests through the encrypted outbox; nothing is scheduled or sent until a mail provider and scheduler are configured (decision 019).
- No new runtime dependency.

## 0.18.0-alpha.1 (Alpha 18): server pages for long lists, 3 October 2026

On main through [PR #11](https://github.com/EmotiveImpact/REUNIR/pull/11), merged as `a211a09`.

**In plain language:** notices, the knowledge-check review queues and the audit trail now load a page at a time, with "Show older" buttons and counts that stay exact, so busy communities stay quick.

Details:

- `GET /api/organisations/:slug/pages/:list` pages notices, the three review queues and the audit trail (administrators only) with opaque keyset cursors, 20 a page by default and at most 50.
- The snapshot carries the newest 30 notices, the newest 12 audit entries for administrators, only the person's own attempts and exact counts.
- Workspace reads skip the outbox, read the newest 100 audit entries and only the acting person's notices (decision 018).
- No migration, no grant change, no new runtime dependency.

## 0.17.0-alpha.1 (Alpha 17): loose ends after account deletion, 3 October 2026

On main through [PR #10](https://github.com/EmotiveImpact/REUNIR/pull/10), merged as `a924295`.

**In plain language:** when someone deletes their account, tasks they had claimed now go back to their teams in every community, even one where they had been suspended. Changing or removing a cover picture now deletes the old picture straight away instead of later.

Details:

- Deleting your own account releases claimed tasks without proof everywhere. Additive migration 0018 admits exactly those tasks while the transaction is marked as your own deletion; an update may only leave them unassigned, without proof and in "to do".
- A replaced or removed track or project cover loses its upload record in the same change, and its stored file is deleted straight after commit. Moving the focal point keeps it; library pictures stay in the library.
- A new PostgreSQL check covers a deletion that starts while an invitation acceptance holds the account.
- Mentions of a former member in other people's posts stay as written (decision 017).
- Migrations 0001 to 0017 unchanged; no grant changes; no new runtime dependency.

## 0.16.0-alpha.1 (Alpha 16): ownership transfer, 3 October 2026

On main through [PR #8](https://github.com/EmotiveImpact/REUNIR/pull/8), merged as `12ed75c`.

**In plain language:** a community owner can now hand their community to one of its administrators. The previous owner stays on as an administrator, and once they own no community they can delete their account.

Details:

- Hand over ownership: in **Members and access**, the owner opens an administrator's access settings and chooses **Hand over ownership…**, then re-enters their password and types the community's name. Five attempts in fifteen minutes are allowed.
- Ownership goes only to an active administrator of the same community; for anyone else the settings say to make them an administrator first. The previous owner becomes an administrator, which only the new owner can change.
- The new owner is told, and the audit records `member.owner.transferred` with both memberships. **Your account** now points owners to the handover instead of saying it is unavailable.
- The handover is its own route, not a workspace command, so it always needs the password. The fictional demo runs the same rules in the browser.
- Additive migration 0017: a unique index so a community can never hold two owners. Migrations 0001 to 0016 are unchanged and no new grants are needed.

## 0.15.0-alpha.1 (Alpha 15): account deletion, 3 October 2026

On main through [PR #6](https://github.com/EmotiveImpact/REUNIR/pull/6), merged as `cc806e7`.

**In plain language:** members can now delete their own account. Anything they shared with others stays in place under the name Former member, and everything private to them is removed. Community owners cannot delete their account yet, because they first need a way to hand the community to someone else.

Details:

- Delete your account: **Your account** in the account menu lists your communities and says what stays and what goes. After you re-enter your password and type "delete my account", the account is deleted in every community at once, in one transaction.
- Posts, comments, project work, lessons, files, covers and the messages you sent stay, shown as Former member: no name, photo or profile, no place in directories, search or pickers, and conversations with you become read-only for the other person.
- Your private goals, saved posts, notices, reactions, replies to events, learning record (enrolments, completed lessons, knowledge-check answers, points), instructor grants, private files, invitations to your address, queued mail, sessions, password and email are deleted. Claimed tasks without proof go back to their teams, and notices naming you are reworded unless they could be about someone else with the same or a longer name.
- Owners are refused, with the communities named, until ownership transfer exists. The fictional demo runs the same rules in the browser and can be restarted.
- Fixes found in review before the merge: no profile link for a former teammate, exact wording in the deletion dialogue and notice, and restarting the demo straight after deleting the first persona.
- Additive migration 0015: policies that admit only your own rows while your own deletion is under way, including your memberships of any status, instructor grants and knowledge-check attempts; a restrictive policy keeps the operator erasure from 0014 away from the application. Rerun `npm run db:grant-runtime` after migrating. Migrations 0001 to 0014 unchanged. No new runtime dependency.

## 0.14.0-alpha.1 (Alpha 14): learner records, 3 October 2026

On main through [PR #5](https://github.com/EmotiveImpact/REUNIR/pull/5), merged as `661fac9` together with Alpha 11 to 13.

**In plain language:** learners can download a copy of their own learning record. A community owner can erase one learner's quiz answers on request. Long review queues now load twenty items at a time instead of stopping at thirty.

Details:

- Download your learning record: on your own profile, a dated JSON file of the tracks you joined, the lessons you completed, your knowledge-check answers with marks, feedback and reviewer, and your mission work in that community. It includes everything that is yours, with titles, names and answer keys exactly as your screen shows them, and nothing about other members beyond who reviewed you.
- Owner-authorised erasure: `npm run db:erase-learner` erases one member's knowledge-check answers and the feedback notices about them on request, as a dry run unless `ERASE=yes`, refusing partial erasure and auditing the reference and counts only.
- `npm run db:prune-covers` lists and clears cover and library uploads nothing uses, deleting stored files before records and keeping anything chosen again.
- Review queues show 20 at a time, waiting answers oldest first, with exact totals beside each heading; focus moves to the first new item. The scored and reviewed lists no longer stop at 30.
- Additive migration 0014: one delete policy on attempts for the owner-authorised erasure, so it works under forced row security without bypass; the runtime role still cannot delete attempts. Migrations 0001 to 0013 unchanged. No new runtime dependency.

## 0.13.0-alpha.1 (Alpha 13): cover library, 3 October 2026

On main through [PR #5](https://github.com/EmotiveImpact/REUNIR/pull/5), merged as `661fac9`.

**In plain language:** each community can keep a small shared library of cover pictures, so people can pick a cover instead of uploading one every time.

Details:

- Covers can now come from a community cover library as well as an upload. The cover dialogue offers **Upload your own** or **Community library** whenever the library holds a picture; choosing one keeps its own focal point and does not copy the picture.
- Owners and administrators keep up to 24 named pictures under Community settings → Cover library: add one through the same in-browser preparation as covers, see how many covers use each, and remove unused ones, which deletes the stored file.
- Every active member can see library pictures; other communities, visitors and unlisted uploads cannot. A picture in use cannot be removed.
- Library options are native radio buttons named after their pictures, so they work from the keyboard and read clearly to screen readers.
- Additive migration 0013 with forced row security for the library and a restrictive policy for unlisted library uploads; migrations 0001 to 0012 unchanged. No new runtime dependency, no stock photo service.
- The demo library has one fictional picture: the bundled landscape, cropped so its caption does not show.
- The connected cover check now runs the live API under the restricted runtime role with forced row security.

## 0.12.0-alpha.1 (Alpha 12): track instructors, 3 October 2026

On main through [PR #5](https://github.com/EmotiveImpact/REUNIR/pull/5), merged as `661fac9`.

**In plain language:** owners can name instructors for a learning track. An instructor can write and mark the lessons in their own track without getting control of the rest of the community.

Details:

- Owners and administrators name instructors for a track from an Instructors dialogue on the track page. The new instructor is notified.
- Instructors author their track's lessons, files, knowledge checks and cover, and mark its knowledge checks, from a new Teaching page. They cannot change other tracks, choose instructors or open Community studio.
- Rights come only from explicit grants; being shown as a track's author grants nothing, and upgrading grants nothing.
- One per-track rule in the domain and in row security; other tracks stay invisible to an instructor; suspension ends access at once; grants are added or removed, never rewritten.
- Additive migration 0012; migrations 0001 to 0011 unchanged. No new runtime dependency.
- The demo adds Preview as instructor (Idris Cole, product track).
- The connected instructor check runs the live API under the restricted runtime role with forced row security.

## 0.11.0-alpha.1 (Alpha 11): cover images, 3 October 2026

On main through [PR #5](https://github.com/EmotiveImpact/REUNIR/pull/5), merged as `661fac9`.

**In plain language:** tracks and projects can have a real cover picture uploaded by the community. The old generated cover art, and the hard-to-read words printed on it, are gone.

Details:

- Upload your own cover for a track or project. Administrators set track covers; a project's owner or an administrator sets its cover.
- Choose or drop a picture, set the focal point by clicking or with keyboard-operable sliders, preview the banner, card and small crops, then save or remove.
- The browser resizes each picture to 1,600 pixels before upload, which also drops metadata such as location. PNG stays PNG when it fits, so transparent logos keep their transparency.
- Without a cover, a plain neutral panel with one muted icon shows. The generated art, its shapes and every word written on it are retired; titles stay below the picture.
- Uploads reuse the verified private pipeline: subject-bound intents, exact signed POST policies, signature and dimension checks on the pinned generation. Bytes come from an access-checked same-origin route with private caching and a sandboxing content security policy.
- Additive migration 0011 with a restrictive RLS policy for cover uploads; migrations 0001 to 0010 unchanged. No new runtime dependency.
- The connected resources and knowledge-check scans cover the whole learner page again, the monochrome suite checks the plain panel on a new track, and the design contract now checks every web stylesheet. This replaces the earlier contrast patch for text on custom covers, which never reached main on its own; its branch was folded into PR #5.
- Fix: a project post in the feed always linked to Common Ground; it now links to the project it names.

## 0.10.0-alpha.1 (Alpha 10): knowledge checks, 2 October 2026

On main through [PR #4](https://github.com/EmotiveImpact/REUNIR/pull/4), merged as `365e1c9`.

**In plain language:** lesson authors can add a short quiz to a lesson. Learners get private feedback on their answers, and written answers are marked by a person. Scores never turn into points, badges or credentials.

Details:

- Add one optional knowledge check per lesson: single choice, multiple choice, short answer and written response, with an optional pass mark, attempt limit and answer-reveal rule.
- Checks follow the existing private draft, preview, publication, capture and restore; revision history records them.
- Score on the server only; learners never receive answer keys before the author's rule allows it; answers to a check that changed meanwhile are refused.
- Attempts keep the quiz they answered and are immutable apart from one review. Owners and administrators who are not the learner mark written answers and send feedback from a Knowledge checks tab in Community studio.
- Scores are private feedback: no reputation points, no automatic completion, no credentials.
- Additive migration 0010 with forced RLS, column-level review grants and no DELETE for the application role; migrations 0001 to 0009 unchanged. No new runtime dependency.
- Fix: `npm run dev` showed a blank page because a lazy page was declared above its React import; a static test now guards module order.

## 0.9.0-alpha.1 (Alpha 09): private lesson resources, 2 October 2026

On main through [PR #3](https://github.com/EmotiveImpact/REUNIR/pull/3), merged as `788e5d7`.

**In plain language:** lessons can carry downloadable files such as worksheets. Only people allowed to see the lesson can download them, and files in a draft stay hidden until the lesson is published.

Details:

- Attach ordered, named and described files to lesson drafts; replace and remove them; release them only on publication.
- Revision history keeps each version's files; restoring a revision brings them back into the draft.
- Extend the existing upload-intent API and Google Cloud Storage adapter: track-scoped keys, signature checks, generation pinning, two-minute attachment downloads.
- One download rule for lessons, drafts and revisions, with a restrictive RLS policy in depth.
- Additive migration 0009; migrations 0001 to 0008 unchanged. No new runtime dependency.
- The fictional demo keeps file bytes in the browser and includes a generated sample worksheet.
- No storage bucket has been configured.

## 0.8.0-alpha.1 (Alpha 08): rich lesson authoring, 2 October 2026

On main through [PR #2](https://github.com/EmotiveImpact/REUNIR/pull/2), merged as `016c16e`.

**In plain language:** lesson authors get a proper editor with headings, lists, quotes, code, links, images and videos. Older plain-text lessons keep working.

Details:

- Add Tiptap formatting, headings, lists, quotes, code, links and labelled image/video blocks.
- Keep private draft/preview/publish/revision boundaries and legacy lessons.
- Add bounded structured content, safe React rendering and opt-in external media.
- Add nullable migration 0008 and rich-content database/browser regressions.

## 0.7.0-alpha.1 (Alpha 07): approved v4 design, 2 October 2026

On main through [PR #1](https://github.com/EmotiveImpact/REUNIR/pull/1), merged as `6238d7b`. This was the first time the complete application reached GitHub; it carried everything from Alpha 01 to Alpha 07.

**In plain language:** the app took on the approved v4 design: a cleaner two-sidebar layout, search in the header, one account menu in the top right, and a Home page whose progress and activity come from real community records rather than placeholder figures.

Details:

- Approved v4 shell and purpose-led Home integrated into the existing React app.
- Actual attributed shadcn Button, Avatar and Dropdown Menu, Tailwind utility integration, clean two-sidebar navigation, global header search, one account menu, fixture-safe natural portraits and mobile drawer focus and Escape handling.
- Existing routes and seven migrations preserved. Progress and activity read original authorised records, not mock-up statistics.
- Added v4 browser checks and refreshed moved-control regression selectors.
- Fix found in CI: connected password fields now have an exact accessible label, with the password guidance linked as their description.

## 0.6.0-alpha.1 (Alpha 06): Creator studio and monochrome interface, 27 September 2026

**In plain language:** owners and administrators got a Creator studio for writing lessons privately, previewing them and publishing when ready, with a full history they can restore from. The whole interface moved to black, white and neutral grey.

Details:

- Creator studio at `/learn/:id/studio`: private drafts, manual save, plain-text preview, explicit publication of a saved version, immutable content snapshots, restore as draft, archive and restore, and version-checked curriculum order.
- Drafts and history are invisible to members and general search. Revision writes are append-only for the restricted runtime role. Existing completions and points are untouched.
- Migration 0007 for creator authoring; earlier migrations unchanged.
- Monochrome continuation: black-and-white interface contract, neutral styling, backwards-compatible settings, contrast fixes and 15 new presentation-browser checks plus eight contract checks. No backend, domain, migration or runtime dependency changes in that patch.

## 0.5.0 (Alpha 05): project workspaces, 24 September 2026

**In plain language:** projects gained a shared task board where people can claim tasks, track due dates and attach evidence of finished work for review.

Details:

- Added project workspaces with board and list views, assignment and claiming, version-aware edits, completion criteria, due dates, task notes, archive and restore, and authorised task search.
- Task evidence reuses the existing contribution lifecycle and review screens, then the existing path and outcome system.
- Added migration 0006 with typed tenant, project, assignee and evidence relations and row policies; the original five migrations are unchanged.
- Added a checked research-to-build register and a targeted six-platform review, plus the HumHub Tasks optional reference. No new runtime dependency, donor application source import or live deployment.

## 0.4.0 (Alpha 04): pilot operations, 24 September 2026

**In plain language:** community owners got a Pilot console for checking that their community is running smoothly, and outgoing email became more reliable.

Details:

- Added an owner-only Pilot console with redacted, scoped operational observations and JSON export.
- Added runtime configuration and role guards, a read-only migration and configuration CLI, and additive migration 0005.
- Fenced email claims against late completion, cancellation and newer leases; quarantined exhausted uncertain attempts.
- Split production routes and runtime chunks while preserving the one-file fictional preview.
- Added a source manifest, a collision-aware publication helper and a versioned offline Git handover.
- Verified 276 application tests, 102 demo-browser checks, 17 HTTP checks and 10 helper tests.

## 0.3.0 (Alpha 03): invitations, accounts and messages, 24 September 2026

**In plain language:** people can be invited to a community by a personal link, reset a forgotten password and send each other private messages. Owners can manage roles, private spaces and suspensions.

Details:

- Added personal, revocable, one-use invitations and ordinary-member account creation around Better Auth.
- Added password recovery, session revocation and an encrypted durable mail queue with a bounded provider adapter.
- Added participant-private one-to-one messages, cursor pagination, sequence-based reads, retry-safe sending, blocking and selected-message reports.
- Added focused member administration: owner-only role assignment, private-space access and reasoned reversible suspension.
- Added migrations 0003 and 0004; migrations 0001 and 0002 and customer content are unchanged.
- Verification: 230 automated tests, 85 demo browser checks and 12 real local HTTP checks.

## Alpha 02: purposes, paths and evidence, 24 September 2026

**In plain language:** a community can describe what its members are working towards. Members can follow paths with milestones, keep private goals, contribute to projects and have that work reviewed, and see a record of what the community has produced.

Details:

- Purpose-led Home and personal next step; the independent Discussions route is retained.
- Optional Become, Build and Achieve purposes, paths with evidence-linked milestones and private member goals.
- Project contributions with review and feedback; outcomes with separate verification; a member-visible output archive and profile evidence.
- Knowledge navigation, permission-scoped path and output search, and responsive mobile flows.
- Added eight normalised domain collections and fifteen commands without replacing authentication or persistence.
- Added migration 0002; migration 0001 is unchanged. Existing communities receive no invented purposes.
- Path progress reuses existing completion and proof records. Goal completion records a completed path or the member's explicitly selected reviewed outcome.
- Full suite 177 passing, with the original 107 checks preserved.

## Alpha 01: the first working community app, 24 September 2026

**In plain language:** the first version of the app. It already had the everyday parts of an online community: a home feed, discussion spaces, posts with comments and reactions, a learning catalogue with lessons, missions, projects, events, member profiles, notifications and search, plus basic admin tools.

Details:

- React and Vite web app, shared validated domain commands, a Hono API, Better Auth email and password sessions, normalised PostgreSQL persistence and migration and provisioning tools.
- Member experience: home and feed, spaces, post detail, comments, reactions, saves and reporting, learning catalogue and lesson reader, missions with proof, project directory and team updates, events with RSVP and calendar export, people and profiles, notifications and search.
- Admin views: proof review, moderation, settings and basic creation of spaces, tracks, lessons, missions and events.
- Two independent fictional communities, Code Black and Studio North, in the browser demo. A live-mode community created from the command line starts empty.
- Verification: 107 automated tests and 24 desktop and mobile browser journey checks passed.
