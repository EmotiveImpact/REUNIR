# Latest: Alpha 48 lessons lead with their video

5 October 2026, on `claude/staging-launch-l1c2la` (PR #39), after PR #38 (page colour, main `d4393cd`). Read decisions/048-lesson-video-stage.md and the top of BUILD_STATUS.md. No migration. Numbering: Alpha 48 to 49, decisions 048 to 049, migrations 0046 to 0047 belong to this thread; Alpha 49, decision 049 and both migrations are unused. Next: merge PR #39 once CI is green, then republish the shared demo. Not built: chapters, captions upload, playback position.

# Current continuation: Alpha 42 virus scanning in the background

Read AGENTS.md, platform/docs/BUILD_STATUS.md, decisions/042-background-scanning.md, decisions/023-upload-scanning.md, SETUP.md section 6 and LAUNCH_RUNBOOK.md first. UI_DESIGN_DIRECTION.md remains authoritative. Continue the existing React/Vite + Hono + Better Auth + PostgreSQL application; do not rebuild completed features.

## Where the source is

- Base: main `fd3e587` (PR #35, Alpha 44 paged posts and archived tasks, after PR #34 Alpha 46 and PR #33 Alpha 41), merged into `claude/background-scanning-pxfq5c`. Version 0.39.0-alpha.1. The owner approved, on 3 October 2026, merging each change into main with a normal merge commit once its checks pass. Never force-push.
- Numbering: this thread holds Alpha 42 to 43, decisions 042 to 043 and migrations 0040 to 0041. Alpha 42, decision 042 and migration 0040 are used; Alpha 43, decision 043 and migration 0041 are free. Paged loading and other threads hold their own blocks.

## What is done

Uploads are no longer scanned inside the completion request. Completion does the quick checks, records the stored generation in `upload_scans` (migration 0040) and answers 202 `scanning`. `npm run scan:worker`, run beside clamd, streams that generation to clamd, records the verdict and completes the upload as its uploader. The browser keeps asking while it waits. The API never connects to clamd, so Vercel no longer needs a private network for uploads.

## Run it

```sh
cd platform
npm ci
VITE_DATA_MODE=demo npm run dev   # fictional demo at http://127.0.0.1:5173
```

The demo has no scanner and is unchanged. Against a server with a bucket and `CLAMAV_HOST`, run `npm run db:migrate` (applies 0040), `npm run db:grant-runtime`, then `npm run scan:worker` beside clamd.

Checks from `platform/`: `npm run typecheck`, `npm test`, `npm run test:http`, `npm run build`, `npm run bundle:preview`, every `npm run test:browser:*` script, and `npm run test:postgres` against a fresh disposable loopback database named `reunir_ci`. From the repository root: `python3 -m unittest discover -s scripts -p "test_*.py"` and `python3 scripts/check_research.py`. Set `CHROMIUM_PATH` when Playwright's own browser is not installed.

## Next

Staging launch is prepared (Alpha 46 and 47, decisions 046 and 047). The owner said go on Vercel Hobby on 5 October 2026, confirmed Frankfurt, and email starts on Resend's test sender until a domain is bought; uploads wait for approval of the scan host in platform/deploy/scan-host. platform/docs/STAGING_LAUNCH.md lists the shape, costs and owner-only steps, then `npm run launch:smoke` checks the site. Deployment stays deferred until the owner says go: prepare, never provision. Recommended order after staging: a Content-Security-Policy tried on staging; privacy-respecting analytics; appeals against suspensions and message reports; removing someone from a project team; credits on outcomes; question banks, timers and partial marks once pilots ask. The business stage and the long-term vision stay parked.

1. Nothing scanned against a real clamd, bucket or worker host yet. When uploads are switched on for staging, choose a small always-on container host for clamd and the worker (LAUNCH_RUNBOOK.md section 6), then confirm a clean upload, the EICAR file and a scanner outage end to end.
2. Not decided: rescanning stored files when signatures update, quarantine instead of deletion, files larger than clamd's `StreamMaxLength`, more than one worker.
3. Deployment remains deferred by the owner: prepare everything needed to switch on, but provision nothing.


---
## Historical Alpha 44 handover: posts and archived tasks a page at a time

Read AGENTS.md, platform/docs/BUILD_STATUS.md, CHANGELOG.md, decisions/044-paged-posts-and-tasks.md, decisions/018-server-pages-for-long-lists.md, LAUNCH_RUNBOOK.md and ROADMAP.md first. UI_DESIGN_DIRECTION.md remains authoritative. Continue the existing React/Vite + Hono + Better Auth + PostgreSQL application; do not rebuild completed features.

### Where the source is

- Base: main `9d7dcff`, the merge of PR #33 (Alpha 41), with main `2edf0b0` (PR #34, Alpha 46 staging launch prepared) merged in. Version 0.39.0-alpha.1.
- This slice: Alpha 44 on `claude/paged-loading-bu4poc`. The owner approved, on 3 October 2026, merging each change into main with a normal merge commit once its checks pass. Never force-push.
- Numbering: this slice holds Alpha 44 to 45, decisions 044 to 045 and migrations 0042 to 0043; it used Alpha 44 and decision 044 and no migration. Background scanning and the staging launch are being built in parallel threads with their own blocks.

### What is done

Feeds (conversation, spaces, Saved, Knowledge) page posts from the server; the snapshot carries a window of posts and only active tasks; archived tasks page per project; one post or archived task can be read alone for links. Every suite passed locally.

### Run it

```sh
cd platform
npm ci
VITE_DATA_MODE=demo npm run dev   # fictional demo at http://127.0.0.1:5173
```

Checks from `platform/`: `npm run typecheck`, `npm test`, `npm run test:http`, `npm run build`, `npm run bundle:preview`, every `npm run test:browser:*` script (including `test:browser:paging`), and `npm run test:postgres` against a fresh disposable loopback database named `reunir_ci` with no leftover `reunir_*` roles. From the repository root: `python3 -m unittest discover -s scripts -p "test_*.py"` and `python3 scripts/check_research.py`. Set `CHROMIUM_PATH` when Playwright's own browser is not installed.

### Next

Merge Alpha 44 once green. Deployment stays deferred until the owner says otherwise: prepare, never provision. Later, if a community approaches 5,000 posts, read posts in SQL a page at a time as the audit trail is. The business stage and the long-term vision stay parked.

Alpha 44 (paged posts and archived tasks) is on main. Later, if a community approaches 5,000 posts, read posts in SQL a page at a time as the audit trail is.

---
## Historical Alpha 41 handover: pre-pilot review


Read AGENTS.md, platform/docs/BUILD_STATUS.md, CHANGELOG.md, decisions/041-pre-pilot-hardening.md, LAUNCH_RUNBOOK.md and ROADMAP.md first. UI_DESIGN_DIRECTION.md remains authoritative. Continue the existing React/Vite + Hono + Better Auth + PostgreSQL application; do not rebuild completed features.

### Where the source is

- Base: main `d726e8f`, the merge of PR #31 (Alpha 37 uploaded lesson video). Every item on the original build list is merged. Version 0.39.0-alpha.1.
- This slice: Alpha 41, a pre-pilot review on `claude/platform-review-b99gh7`. The owner approved, on 3 October 2026, merging each change into main with a normal merge commit once its checks pass. Never force-push.
- Numbering: Alpha 41 and decision 041 are used. The next free numbers are Alpha 42, decision 042 and migration 0039 (0024 to 0027 and 0037 were never used and stay unused).

### What is done

Every suite passed on main. The review found no cross-community or private-data gap. Alpha 41 bounds the unused member upload route, closes Better Auth's own update-user route, splits invitation rate limits by route, adds HSTS and Permissions-Policy to `vercel.json`, and brings the records up to date. No migration.

### Run it

```sh
cd platform
npm ci
VITE_DATA_MODE=demo npm run dev   # fictional demo at http://127.0.0.1:5173
```

Checks from `platform/`: `npm run typecheck`, `npm test`, `npm run test:http`, `npm run build`, `npm run bundle:preview`, every `npm run test:browser:*` script, and `npm run test:postgres` against a fresh disposable loopback database named `reunir_ci` with no leftover `reunir_*` roles. From the repository root: `python3 -m unittest discover -s scripts -p "test_*.py"` and `python3 scripts/check_research.py`. Set `CHROMIUM_PATH` when Playwright's own browser is not installed.

### Next

Nothing is in progress. Deployment stays deferred until the owner says otherwise: prepare, never provision. Recommended order when the owner chooses: the staging launch (LAUNCH_RUNBOOK.md); scanning outside the upload request, since Vercel stops a request at 30 seconds; a Content-Security-Policy tried on staging; server-side pages for posts and tasks; privacy-respecting analytics; appeals against suspensions and message reports; removing someone from a project team; credits on outcomes; question banks, timers and partial marks once pilots ask. The business stage and the long-term vision stay parked.

---
## Historical Alpha 37 handover: uploaded lesson video
- Outcome: [PR #31](https://github.com/EmotiveImpact/REUNIR/pull/31), merged into main on 4 October 2026 as `d726e8f`.

Read AGENTS.md, platform/docs/BUILD_STATUS.md, LESSON_RESOURCES.md, decisions/037-lesson-video.md, INSTRUCTORS.md, LAUNCH_RUNBOOK.md and ROADMAP.md first. UI_DESIGN_DIRECTION.md remains authoritative. Continue the existing React/Vite + Hono + Better Auth + PostgreSQL application; do not rebuild completed features.

### Where the source is

- Base: main `99e919a`, the merge of PR #28 (Alpha 36 instructors start their own tracks). Main `2561a00` (PR #27, Alpha 29 files on project tasks and live project work) and `ec9181d` (PR #32, Alpha 30 every form on the shared shadcn components) are merged in. The application version stays 0.39.0-alpha.1 because Alpha 39 is already on main.
- This slice: branch `claude/courses-teaching-6hum2q`, restarted from that main. BUILD_STATUS.md records the local runs; the pull request records CI. The owner approved, on 3 October 2026, merging each feature into main with a normal merge commit once its checks pass. Never force-push.
- Numbering: courses and teaching uses Alpha 35 to 38, decisions 035 to 038 and migrations 0034 to 0037, as allocated by the project coordinator on 3 October 2026. Alpha 38 and migration 0037 are unused so far.

### What is done

Contributor roles, lesson grants and instructor-started tracks are on main. This slice adds MP4 and WebM lesson video, off until the operator sets `LESSON_VIDEO_MAX_MB` (up to 500 MB), played inline through a signed two-hour link after the same access check as a download. Additive migration 0036 lets only lesson video exceed 10 MB in upload intents.

### Run it

```sh
cd platform
npm ci
VITE_DATA_MODE=demo npm run dev   # fictional demo at http://127.0.0.1:5173
```

The demo has video on at the 500 MB maximum. Open a track's Creator studio, attach an MP4 or WebM file to a lesson, publish, then choose **Play** on the lesson. Against a server, set `LESSON_VIDEO_MAX_MB` and run `npm run db:migrate` (applies 0036; no grant changes).

Checks from `platform/`: `npm run typecheck`, `npm test`, `npm run test:http`, `npm run build`, `npm run bundle:preview`, every `npm run test:browser:*` script, and `npm run test:postgres` against a fresh disposable loopback database named `reunir_ci` with no leftover `reunir_*` roles. From the repository root: `python3 -m unittest discover -s scripts -p "test_*.py"` and `python3 scripts/check_research.py`. Set `CHROMIUM_PATH` when Playwright's own browser is not installed.

### Product invariants for the next slice

People + Purpose + Progress + Projects + Proof. Keep drafts private and publication explicit, revision history and attempts immutable except through the owner-authorised erasure and a person's own account deletion, tenant isolation and role checks current, private goals, messages, scores and notification settings private. Lesson files, video included, are released only to people who may open the lesson, through short-lived signed links. Authority is granted explicitly and must be current when it takes effect. A community has exactly one owner. The interface stays black, white and neutral grey. Community review is not accreditation.

### Next

1. Scan large uploads in chunks so the API need not hold a whole video in memory; until then raise clamd `StreamMaxLength` to the video limit. Question banks, timers and partial marks wait for pilot needs.
2. Deployment remains deferred by the user: prepare everything needed to switch on, but provision nothing.

---
## Historical Alpha 30 handover: every form on the shared shadcn components
- Outcome: [PR #32](https://github.com/EmotiveImpact/REUNIR/pull/32), merged into main as `ec9181d`.

Read AGENTS.md, platform/docs/BUILD_STATUS.md, FORMS.md, decisions/030-shared-form-components.md and UI_DESIGN_DIRECTION.md first. Continue the existing React/Vite + Hono + Better Auth + PostgreSQL application; do not rebuild completed features.

### Where the source is

- Base: main `2561a00`, which carries Alpha 29 (PR #27, merged 3 October 2026), on `claude/everyday-use-4z9rmz`.
- The owner approved, on 3 October 2026, merging each feature into main with a normal merge commit once its checks pass. Never force-push.
- This thread held Alpha 27 to 30, decisions 027 to 030 and migrations 0028 and 0029; all four Everyday use items are built.

### What is done

Every form uses the shared shadcn components. New forms should use `components/ui` Input, Textarea, Label, NativeSelect, Checkbox, RadioGroup, Switch and Button; `scripts/test_forms_contract.py` fails on a hand-styled field.

### Run it

```sh
cd platform
npm ci
VITE_DATA_MODE=demo npm run dev   # fictional demo at http://127.0.0.1:5173
```

Checks from `platform/`: `npm run typecheck`, `npm test`, `npm run build`, every `npm run test:browser:*` script (now including `test:browser:forms`). From the repository root: `python3 -m unittest discover -s scripts -p "test_*.py"` and `python3 scripts/check_research.py`.

### Next

1. Task files already go through Alpha 23 upload scanning; confirm it against a real bucket and scanner when deployment is switched on.
2. Later: remove the legacy `.button` and element rules so the shadcn classes alone style the app.
3. Deployment remains deferred by the user: prepare everything needed to switch on, but provision nothing.

---
## Historical Alpha 29 handover: files on project tasks and live project work
- Outcome: [PR #27](https://github.com/EmotiveImpact/REUNIR/pull/27), merged into main as `2561a00`.

Read AGENTS.md, platform/docs/BUILD_STATUS.md, PROJECT_WORK.md, decisions/029-task-files-and-live-project-work.md, LESSON_RESOURCES.md and ROADMAP.md first. UI_DESIGN_DIRECTION.md remains authoritative. Continue the existing React/Vite + Hono + Better Auth + PostgreSQL application; do not rebuild completed features.

### Where the source is

- Base: main `94b130b`, the merge of PR #25 (Alpha 28), tree identical to its tested head `e4d69fa`.
- This slice: branch `claude/everyday-use-4z9rmz`. BUILD_STATUS.md records the local runs; the pull request records CI. The owner approved, on 3 October 2026, merging each feature into main with a normal merge commit once its checks pass. Never force-push.
- This thread holds Alpha 27 to 30, decisions 027 to 030 and migrations 0028 and 0029.

### What is done

Project teams attach files to tasks through the shared upload-intent path; boards and open tasks refresh through a cheap change check; concurrent task edits are caught and explained. Additive migration 0029, no grant change.

### Run it

```sh
cd platform
npm ci
VITE_DATA_MODE=demo npm run dev   # fictional demo at http://127.0.0.1:5173
```

Open Projects, a project, Open project workspace, then a task and Attach a file. Two demo tabs stand in for two people. For PostgreSQL: `npm run db:migrate` (applies 0029); no grant change.

Checks from `platform/`: `npm run typecheck`, `npm test`, `npm run test:http`, `npm run build`, `npm run bundle:preview`, every `npm run test:browser:*` script (now including `test:browser:task-files`), and `npm run test:postgres` against a fresh disposable loopback database named `reunir_ci`. From the repository root: `python3 -m unittest discover -s scripts -p "test_*.py"` and `python3 scripts/check_research.py`.

### Next

1. Shared form components (Alpha 30). Task files already go through Alpha 23 upload scanning.
2. Deployment remains deferred by the user: prepare everything needed to switch on, but provision nothing.

---
## Historical Alpha 36 handover: instructors start their own tracks
- Outcome: [PR #28](https://github.com/EmotiveImpact/REUNIR/pull/28), merged into main as `99e919a`.

Read AGENTS.md, platform/docs/BUILD_STATUS.md, INSTRUCTORS.md, decisions/025-contributor-roles.md, decisions/035-lesson-grants.md, decisions/036-instructor-tracks.md and ROADMAP.md first. UI_DESIGN_DIRECTION.md remains authoritative. Continue the existing React/Vite + Hono + Better Auth + PostgreSQL application; do not rebuild completed features.

### Where the source is

- Base: main `3c770b5`, the merge of PR #24 (Alpha 35 teaching grants for chosen lessons), with main `f3efa39` (PR #26, Alpha 32 appeals) and main `e930e39` (PR #29, Alpha 33 evidence history) and main `5f7b827` (PR #30, Alpha 34 credits) merged in. The application version stays 0.39.0-alpha.1 because Alpha 39 is already on main.
- This slice: branch `claude/courses-teaching-6hum2q`, restarted from that main. BUILD_STATUS.md records the local runs; the pull request records CI. The owner approved, on 3 October 2026, merging each feature into main with a normal merge commit once its checks pass. Never force-push.
- Numbering: courses and teaching uses Alpha 35 to 38, decisions 035 to 038 and migrations 0034 to 0037, as allocated by the project coordinator on 3 October 2026. Other threads hold Alpha 27 to 34 and 39 to 40.

### What is done

Contributor roles (Alpha 25) and lesson grants (Alpha 35) are on main. This slice lets an active instructor of a whole track start a new track. It stays unpublished, seen only by its teachers and administrators, until an owner or administrator chooses **Publish track**. Additive migration 0035 admits only the starter's own grant on that new track.

### Run it

```sh
cd platform
npm ci
VITE_DATA_MODE=demo npm run dev   # fictional demo at http://127.0.0.1:5173
```

Preview as an instructor of a whole track, open Learning or Teaching and choose **Start a track**. Switch to admin to see **Not published** and **Publish track**. For PostgreSQL: `npm run db:migrate` (applies 0035; no grant changes).

Checks from `platform/`: `npm run typecheck`, `npm test`, `npm run test:http`, `npm run build`, `npm run bundle:preview`, every `npm run test:browser:*` script, and `npm run test:postgres` against a fresh disposable loopback database named `reunir_ci` with no leftover `reunir_*` roles. From the repository root: `python3 -m unittest discover -s scripts -p "test_*.py"` and `python3 scripts/check_research.py`. Set `CHROMIUM_PATH` when Playwright's own browser is not installed.

### Product invariants for the next slice

People + Purpose + Progress + Projects + Proof. Keep drafts private and publication explicit, revision history and attempts immutable except through the owner-authorised erasure and a person's own account deletion, tenant isolation and role checks current, private goals, messages, scores and notification settings private. Authority is granted explicitly and must be current when it takes effect; teaching is a per-track grant with a role and an optional set of lessons, not a community role, and publishing a lesson stays with instructors. A track an instructor starts reaches members only when an owner or administrator publishes it. A community has exactly one owner. The interface stays black, white and neutral grey. Community review is not accreditation.

### Next

1. Uploaded lesson video (Alpha 37, migration 0036), built locally in this thread and off until the operator sets `LESSON_VIDEO_MAX_MB`. Question banks, timers and partial marks wait for pilot needs.
2. Deployment remains deferred by the user: prepare everything needed to switch on, but provision nothing.

---
## Historical Alpha 34 handover: consented credits, the last accounts and trust item
- Outcome: [PR #30](https://github.com/EmotiveImpact/REUNIR/pull/30), merged into main as `5f7b827`.

Read AGENTS.md, platform/docs/BUILD_STATUS.md, CREDITS.md, decisions/034-contribution-credits.md, SECURITY.md and ROADMAP.md first. UI_DESIGN_DIRECTION.md remains authoritative. Continue the existing React/Vite + Hono + Better Auth + PostgreSQL application; do not rebuild completed features.

### Where the source is

- Base: main `e930e39`, the merge of PR #29 (Alpha 33, correcting and withdrawing reviewed evidence). The application version stays main's 0.39.0-alpha.1.
- This slice: branch `claude/accounts-trust-zojuqs`. BUILD_STATUS.md records the local runs; the pull request records CI. The owner approved, on 3 October 2026, merging each feature into main with a normal merge commit once its checks pass. Never force-push.

### What is done

The author of a contribution credits teammates; each person accepts or declines, and only accepted credits are shown, on the contribution and under Credited on in the person's profile. Credits never count as evidence. Invitations stay between the two people, under forced row security. Migration 0033.

### Run it

```sh
cd platform
npm ci
VITE_DATA_MODE=demo npm run dev   # fictional demo at http://127.0.0.1:5173
```

Checks from `platform/`: `npm run typecheck`, `npm test`, `npm run test:http`, `npm run build`, `npm run bundle:preview`, every `npm run test:browser:*` script, and `npm run test:postgres` against a fresh disposable loopback database named `reunir_ci` with no leftover `reunir_*` roles. From the repository root: `python3 -m unittest discover -s scripts -p "test_*.py"` and `python3 scripts/check_research.py`. Set `CHROMIUM_PATH` when Playwright's own browser is not installed.

### Product invariants for the next slice

People + Purpose + Progress + Projects + Proof. Keep drafts private and publication explicit, revision history and attempts immutable except through the owner-authorised erasure and a person's own account deletion, tenant isolation and role checks current, private goals, messages, scores, notification settings, appeals and unanswered credits private. Reviewed evidence is corrected only through review and withdrawn only with a reason. A credit is shown only with the credited person's consent and is never evidence. Nobody decides about their own work. A community has exactly one owner. The interface stays black, white and neutral grey. Community review is not accreditation.

### Next

1. Accounts and trust is complete for this round once this merges. Undecided: removing someone from a project team, credits on outcomes, and appeals against suspension or message-report outcomes.
2. Deployment remains deferred by the user: prepare everything needed to switch on, but provision nothing.

---
## Historical Alpha 33 handover: evidence history
- Outcome: [PR #29](https://github.com/EmotiveImpact/REUNIR/pull/29), merged into main as `e930e39`.

Read AGENTS.md, platform/docs/BUILD_STATUS.md, EVIDENCE_HISTORY.md, decisions/033-evidence-history.md, SECURITY.md and ROADMAP.md first. UI_DESIGN_DIRECTION.md remains authoritative. Continue the existing React/Vite + Hono + Better Auth + PostgreSQL application; do not rebuild completed features.

### Where the source is

- Base: main `f3efa39`, the merge of PR #26 (Alpha 32, appealing a hidden post). The application version stays main's 0.39.0-alpha.1.
- This slice: branch `claude/accounts-trust-zojuqs`. BUILD_STATUS.md records the local runs; the pull request records CI. The owner approved, on 3 October 2026, merging each feature into main with a normal merge commit once its checks pass. Never force-push.

### What is done

Reviewed evidence can be corrected through a second review or withdrawn with a reason. The reviewed wording is kept in `evidence_changes`, which the runtime role can add to and decide but never reword or delete. Withdrawn evidence stays visible, marked withdrawn, and stops counting everywhere recognised or verified evidence counts. Migration 0032.

### Run it

```sh
cd platform
npm ci
VITE_DATA_MODE=demo npm run dev   # fictional demo at http://127.0.0.1:5173
```

Checks from `platform/`: `npm run typecheck`, `npm test`, `npm run test:http`, `npm run build`, `npm run bundle:preview`, every `npm run test:browser:*` script, and `npm run test:postgres` against a fresh disposable loopback database named `reunir_ci` with no leftover `reunir_*` roles. From the repository root: `python3 -m unittest discover -s scripts -p "test_*.py"` and `python3 scripts/check_research.py`. Set `CHROMIUM_PATH` when Playwright's own browser is not installed.

### Product invariants for the next slice

People + Purpose + Progress + Projects + Proof. Keep drafts private and publication explicit, revision history and attempts immutable except through the owner-authorised erasure and a person's own account deletion, tenant isolation and role checks current, private goals, messages, scores, notification settings and appeals private. Reviewed evidence is corrected only through review and withdrawn only with a reason; its history is never rewritten. Nobody decides an appeal or reviews a correction about their own work. A community has exactly one owner. The interface stays black, white and neutral grey. Community review is not accreditation.

### Next

1. Consented credit for several contributors (Alpha 34, migration 0033), built locally and opened from main once this merges.
2. Deployment remains deferred by the user: prepare everything needed to switch on, but provision nothing.

---
## Historical Alpha 32 handover: appeals
- Outcome: [PR #26](https://github.com/EmotiveImpact/REUNIR/pull/26), merged into main as `f3efa39`.

Read AGENTS.md, platform/docs/BUILD_STATUS.md, MODERATION.md, decisions/032-moderation-appeals.md, SECURITY.md and ROADMAP.md first. UI_DESIGN_DIRECTION.md remains authoritative. Continue the existing React/Vite + Hono + Better Auth + PostgreSQL application; do not rebuild completed features.

### Where the source is

- Base: main `b80fc04`, the merge of PR #23 (Alpha 31, data retention rules), with main `16b2768` (PR #16, Alpha 23 virus scanning) main `0a818fa` (PR #21, Alpha 39 cover library management, migration 0038) and main `94b130b` (PR #25, Alpha 28 collections, migration 0028) and main `3c770b5` (PR #24, Alpha 35 lesson grants, migration 0034) merged in. The application version stays main's 0.39.0-alpha.1.
- This slice: branch `claude/accounts-trust-zojuqs`. BUILD_STATUS.md records the local runs; the pull request records CI. The owner approved, on 3 October 2026, merging each feature into main with a normal merge commit once its checks pass. Never force-push.

### What is done

The author of a hidden post is told, still sees it, and can appeal. An active owner or administrator who neither hid the post nor wrote it decides, replies, and restores it or keeps it hidden. Appeals are private to the appellant and the deciders, under forced row security, and never become community activity. Migration 0031 adds who moderated a post and the appeals table.

### Run it

```sh
cd platform
npm ci
VITE_DATA_MODE=demo npm run dev   # fictional demo at http://127.0.0.1:5173
```

Checks from `platform/`: `npm run typecheck`, `npm test`, `npm run test:http`, `npm run build`, `npm run bundle:preview`, every `npm run test:browser:*` script, and `npm run test:postgres` against a fresh disposable loopback database named `reunir_ci` with no leftover `reunir_*` roles. From the repository root: `python3 -m unittest discover -s scripts -p "test_*.py"` and `python3 scripts/check_research.py`. Set `CHROMIUM_PATH` when Playwright's own browser is not installed.

### Product invariants for the next slice

People + Purpose + Progress + Projects + Proof. Keep drafts private and publication explicit, revision history and attempts immutable except through the owner-authorised erasure and a person's own account deletion, tenant isolation and role checks current, private goals, messages, scores, notification settings and appeals private. Nobody decides an appeal about their own decision. Retention clears housekeeping only; reviewed evidence and the audit trail stay. A community has exactly one owner. The interface stays black, white and neutral grey. Community review is not accreditation.

### Next

1. A correction and withdrawal history for reviewed evidence (Alpha 33, migration 0032) and consented credit for several contributors (Alpha 34, migration 0033), one pull request each. They are built locally in separate worktrees and need renumbering from main when opened.
2. Deployment remains deferred by the user: prepare everything needed to switch on, but provision nothing.

---
## Historical Alpha 35 handover: teaching grants for chosen lessons
- Outcome: [PR #24](https://github.com/EmotiveImpact/REUNIR/pull/24), merged into main as `3c770b5`.

Read AGENTS.md, platform/docs/BUILD_STATUS.md, INSTRUCTORS.md, decisions/025-contributor-roles.md, decisions/035-lesson-grants.md and ROADMAP.md first. UI_DESIGN_DIRECTION.md remains authoritative. Continue the existing React/Vite + Hono + Better Auth + PostgreSQL application; do not rebuild completed features.

### Where the source is

- Base: main `fab9510`, the merge of PR #20 (Alpha 25 contributor roles), with main `f9f32d6` (PR #22, Alpha 27 loading, error and empty screens) and main `b80fc04` (PR #23, Alpha 31 data retention, migration 0030) and main `16b2768` (PR #16, Alpha 23 virus scanning) and main `0a818fa` (PR #21, Alpha 39 cover library, migration 0038) and main `94b130b` (PR #25, Alpha 28 collections, migration 0028) merged in.
- This slice: branch `claude/courses-teaching-6hum2q`, restarted from that main. BUILD_STATUS.md records the local runs; the pull request records CI. The owner approved, on 3 October 2026, merging each feature into main with a normal merge commit once its checks pass. Never force-push.
- Numbering: courses and teaching uses Alpha 35 to 38, decisions 035 to 038 and migrations 0034 to 0037, as allocated by the project coordinator on 3 October 2026. Other threads hold Alpha 27 to 34 and 39 to 40.

### What is done

Contributor roles (Alpha 25) are on main. This slice lets a teaching grant cover only chosen lessons: those lessons' drafts, history, draft files, publishing and answers, nothing else. New lessons, the order and the cover stay with whole-track grants. Additive migration 0034 adds `track_instructors.lesson_ids` and lesson-scoped policies.

### Run it

```sh
cd platform
npm ci
VITE_DATA_MODE=demo npm run dev   # fictional demo at http://127.0.0.1:5173
```

Preview as admin, open a track, choose **Instructors**, pick a member, choose **Only the lessons I choose**, tick lessons and **Add**. For PostgreSQL: `npm run db:migrate` (applies 0034; no grant changes).

Checks from `platform/`: `npm run typecheck`, `npm test`, `npm run test:http`, `npm run build`, `npm run bundle:preview`, every `npm run test:browser:*` script, and `npm run test:postgres` against a fresh disposable loopback database named `reunir_ci` with no leftover `reunir_*` roles. From the repository root: `python3 -m unittest discover -s scripts -p "test_*.py"` and `python3 scripts/check_research.py`. Set `CHROMIUM_PATH` when Playwright's own browser is not installed.

### Product invariants for the next slice

People + Purpose + Progress + Projects + Proof. Keep drafts private and publication explicit, revision history and attempts immutable except through the owner-authorised erasure and a person's own account deletion, tenant isolation and role checks current, private goals, messages, scores and notification settings private. Authority is granted explicitly and must be current when it takes effect; teaching is a per-track grant with a role and an optional set of lessons, not a community role, and publishing stays with instructors. Owner and administrator authority may require two-step sign-in. Lists that grow page from the server with keyset cursors. A deleted person's shared work stays as Former member. A community has exactly one owner. The interface stays black, white and neutral grey. Community review is not accreditation.

### Next

1. Instructors starting their own tracks, published by an administrator (Alpha 36, migration 0035), then uploaded lesson video (Alpha 37, migration 0036). Both are built locally in this thread. Question banks, timers and partial marks wait for pilot needs.
2. Deployment remains deferred by the user: prepare everything needed to switch on, but provision nothing.

---
## Historical Alpha 28 handover: collections of useful content
- Outcome: [PR #25](https://github.com/EmotiveImpact/REUNIR/pull/25), merged into main as `94b130b`.

Read AGENTS.md, platform/docs/BUILD_STATUS.md, CURATION.md, decisions/028-curated-collections.md, STATES.md and ROADMAP.md first. UI_DESIGN_DIRECTION.md remains authoritative. Continue the existing React/Vite + Hono + Better Auth + PostgreSQL application; do not rebuild completed features.

### Where the source is

- Base: main `f9f32d6`, the merge of PR #22 (Alpha 27), tree identical to its tested head `297dab8`, with main merged in since at `b80fc04` (Alpha 31), `16b2768` (Alpha 23) and `0a818fa` (Alpha 39). The package version is 0.39.0-alpha.1.
- This slice: branch `claude/everyday-use-4z9rmz`. BUILD_STATUS.md records the local runs; the pull request records CI. The owner approved, on 3 October 2026, merging each feature into main with a normal merge commit once its checks pass. Never force-push.
- This thread holds Alpha 27 to 30, decisions 027 to 030 and migrations 0028 and 0029.

### What is done

Owners, administrators and moderators curate collections of existing content with notes and order, drafted privately and published explicitly; one can be featured on Home. Each viewer sees only items they can already open. Additive migration 0028 with forced row security.

### Run it

```sh
cd platform
npm ci
VITE_DATA_MODE=demo npm run dev   # fictional demo at http://127.0.0.1:5173
```

Open Collections in the sidebar, or Preview as admin to edit "Start here". For PostgreSQL: `npm run db:migrate` (applies 0028), then `npm run db:grant-runtime`.

Checks from `platform/`: `npm run typecheck`, `npm test`, `npm run test:http`, `npm run build`, `npm run bundle:preview`, every `npm run test:browser:*` script (now including `test:browser:curation`), and `npm run test:postgres` against a fresh disposable loopback database named `reunir_ci`. From the repository root: `python3 -m unittest discover -s scripts -p "test_*.py"` and `python3 scripts/check_research.py`.

### Next

1. Task files with live updates (Alpha 29) and shared form components (Alpha 30).
2. Deployment remains deferred by the user: prepare everything needed to switch on, but provision nothing.

---
## Historical Alpha 39 handover: cover library management and small copies
- Outcome: [PR #21](https://github.com/EmotiveImpact/REUNIR/pull/21), merged into main as `0a818fa`.

Read AGENTS.md, platform/docs/BUILD_STATUS.md, COVERS.md, decisions/039-cover-library-management-and-small-copies.md, LAUNCH_RUNBOOK.md and ROADMAP.md first. UI_DESIGN_DIRECTION.md remains authoritative. Continue the existing React/Vite + Hono + Better Auth + PostgreSQL application; do not rebuild completed features.

### Where the source is

- Base: main `16b2768`, the merge of PR #16 (Alpha 23 virus scanning of uploads), on top of main `b80fc04` (PR #23, Alpha 31 data retention rules), main `f9f32d6` (PR #22, Alpha 27 loading, error and empty screens), main `fab9510` (PR #20, Alpha 25 contributor roles) and main `9b34cac` (PR #18, Alpha 26 email confirmation and change). This slice was first opened as Alpha 23 on main `f5ec8d3`. Parallel threads now take numbers from agreed blocks, and this one holds Alpha 39 to 40, migrations 0038 to 0039 and decisions 039 to 040, so this release is Alpha 39 with migration 0038 and decision 039. It was first opened as Alpha 23, then renumbered to Alpha 27 before the blocks were agreed; gaps in the sequence on main are expected.
- This slice: branch `claude/build-out-tvzn40`. BUILD_STATUS.md records the local runs; the pull request records CI. The owner approved, on 3 October 2026, merging each feature into main with a normal merge commit once its checks pass. Never force-push.
- Since 3 October 2026 the remaining work is split across threads in the project. This thread owns covers and launch preparation. Each pull request takes the next free alpha, migration and decision numbers from main when it is opened, and renumbers if another lands first.

### What is done

Administrators rename and tag cover library pictures (up to five tags), the library holds up to 60, and the cover picker filters by name or tag. New covers wider than 480 pixels carry a 480-pixel copy made in the browser and verified by the server; cards and lists load it through `/thumbnail` routes that fall back to the full picture. Additive migration 0038 adds the tags, an update policy for active owners and administrators, and the checked small-copy columns.

### Run it

```sh
cd platform
npm ci
VITE_DATA_MODE=demo npm run dev   # fictional demo at http://127.0.0.1:5173
```

Preview as admin, open Community settings, then the cover library, and choose **Edit** on a picture. For PostgreSQL: `npm run db:migrate` (applies 0038), then `npm run db:grant-runtime`.

Checks from `platform/`: `npm run typecheck`, `npm test`, `npm run test:http`, `npm run build`, `npm run bundle:preview`, every `npm run test:browser:*` script, and `npm run test:postgres` against a fresh disposable loopback database named `reunir_ci` with no leftover `reunir_*` roles. From the repository root: `python3 -m unittest discover -s scripts -p "test_*.py"` and `python3 scripts/check_research.py`. Set `CHROMIUM_PATH` when Playwright's own browser is not installed.

### Product invariants for the next slice

People + Purpose + Progress + Projects + Proof. Keep drafts private and publication explicit, revision history and attempts immutable except through the owner-authorised erasure and a person's own account deletion, tenant isolation and role checks current, private goals, messages, scores and notification settings private. Authority is granted explicitly and must be current when it takes effect; teaching is a per-track grant, not a community role. Owner and administrator authority may require two-step sign-in. Library pictures change only their name and tags in place, never the picture. Lists that grow page from the server with keyset cursors. A deleted person's shared work stays as Former member. A community has exactly one owner. The interface stays black, white and neutral grey. Community review is not accreditation.

### Next

1. Covers are complete for now; stock search and backfilling small copies for existing covers are not planned.
2. Launch: LAUNCH_RUNBOOK.md and `npm run launch:preflight` are ready; the owner decides when. Provision nothing until then.

---
## Historical Alpha 23 handover: virus scanning of uploads
- Outcome: [PR #16](https://github.com/EmotiveImpact/REUNIR/pull/16), merged into main as `16b2768`.

Read AGENTS.md, platform/docs/BUILD_STATUS.md, SECURITY.md, decisions/023-upload-scanning.md and ROADMAP.md first. UI_DESIGN_DIRECTION.md remains authoritative. Continue the existing React/Vite + Hono + Better Auth + PostgreSQL application; do not rebuild completed features.

### Where the source is

- Base: main `b24095a` (PR #14, Alpha 21), with main merged in at `ec4285d` (Alpha 22) and `b80fc04` (PR #23, Alpha 31, after Alpha 24 to 27). The version stays 0.31.0-alpha.1.
- This slice: branch `claude/upload-scanning-1p9o9m`. BUILD_STATUS.md records the local runs; the pull request records CI. The owner approved, on 3 October 2026, merging each feature into main with a normal merge commit once its checks pass. Never force-push.

### What is done

When `CLAMAV_HOST` names a clamd service, every upload (lesson files, covers, library pictures, member attachments) is scanned at completion, at the exact stored generation that is then recorded and served. Flagged files are rejected and deleted with 422 `FILE_FLAGGED`; no verdict returns 503 `SCAN_UNAVAILABLE` and the upload stays pending. `UPLOAD_SCANNING` is required by default in production, so a server with a bucket and no scanner will not start. No migration.

### Run it

```sh
cd platform
npm ci
VITE_DATA_MODE=demo npm run dev   # fictional demo at http://127.0.0.1:5173
```

The demo has no storage, so nothing is scanned there. With a clamd reachable (for example the official `clamav/clamav` container on a private network), set `CLAMAV_HOST` and run `npm run scan:check`.

Checks from `platform/`: `npm run typecheck`, `npm test`, `npm run test:http`, `npm run build`, `npm run bundle:preview`, every `npm run test:browser:*` script, and `npm run test:postgres` against a fresh disposable loopback database named `reunir_ci` with no leftover `reunir_*` roles. From the repository root: `python3 -m unittest discover -s scripts -p "test_*.py"` and `python3 scripts/check_research.py`. Set `CHROMIUM_PATH` when Playwright's own browser is not installed.

### Product invariants for the next slice

People + Purpose + Progress + Projects + Proof. Keep drafts private and publication explicit, revision history and attempts immutable except through the owner-authorised erasure and a person's own account deletion, tenant isolation and role checks current, private goals, messages, scores and notification settings private. Authority is granted explicitly and must be current when it takes effect; teaching is a per-track grant, not a community role. Owner and administrator authority may require two-step sign-in. No upload becomes ready unscanned when a scanner is configured, and an unclear scanner answer is never clean. Lists that grow page from the server with keyset cursors. A deleted person's shared work stays as Former member. A community has exactly one owner. The interface stays black, white and neutral grey. Community review is not accreditation.

### Next

1. The remaining account and trust items in ROADMAP.md, which other threads hold (Alpha 31 to 34).
2. Deployment remains deferred by the user: prepare everything needed to switch on, but provision nothing. At launch, run clamd beside the API and confirm it with `npm run scan:check`.

---
## Historical Alpha 31 handover: data retention
- Outcome: [PR #23](https://github.com/EmotiveImpact/REUNIR/pull/23), merged into main as `b80fc04`.

Read AGENTS.md, platform/docs/BUILD_STATUS.md, RETENTION.md, decisions/031-data-retention.md, ACCOUNTS.md, SECURITY.md and ROADMAP.md first. UI_DESIGN_DIRECTION.md remains authoritative. Continue the existing React/Vite + Hono + Better Auth + PostgreSQL application; do not rebuild completed features.

### Where the source is

- Base: main `9b34cac`, the merge of PR #18 (Alpha 26, email confirmation and change), with main `fab9510` (PR #20, Alpha 25 contributor roles, migration 0023) and main `f9f32d6` (PR #22, Alpha 27 loading, error and empty screens) merged in.
- This slice: branch `claude/accounts-trust-zojuqs`. BUILD_STATUS.md records the local runs; the pull request records CI. The owner approved, on 3 October 2026, merging each feature into main with a normal merge commit once its checks pass. Never force-push.

### What is done

Housekeeping records are cleared by one list of rules (RETENTION.md): expired sessions and links, rate counters, request receipts, change events, finished mail and read notices. The job is a dry run unless told to apply, reports counts only, and clears each community's records inside its own tenant context. Migration 0030 adds the job's read-only community listing policy. Your account says how long everything is kept. Nothing is scheduled.

### Run it

```sh
cd platform
npm ci
VITE_DATA_MODE=demo npm run dev   # fictional demo at http://127.0.0.1:5173
```

Checks from `platform/`: `npm run typecheck`, `npm test`, `npm run test:http`, `npm run build`, `npm run bundle:preview`, every `npm run test:browser:*` script, and `npm run test:postgres` against a fresh disposable loopback database named `reunir_ci` with no leftover `reunir_*` roles. From the repository root: `python3 -m unittest discover -s scripts -p "test_*.py"` and `python3 scripts/check_research.py`. Set `CHROMIUM_PATH` when Playwright's own browser is not installed. `npm run retention:run` needs `DATABASE_URL` and is a dry run by default.

### Product invariants for the next slice

People + Purpose + Progress + Projects + Proof. Keep drafts private and publication explicit, revision history and attempts immutable except through the owner-authorised erasure and a person's own account deletion, tenant isolation and role checks current, private goals, messages, scores and notification settings private. Retention clears housekeeping only; reviewed evidence and the audit trail stay. An address changes only by a link opened at the new address after the password. A community has exactly one owner. The interface stays black, white and neutral grey. Community review is not accreditation.

### Next

1. Appeals of moderation decisions, a correction and withdrawal history for reviewed evidence, and consented credit for several contributors, one pull request each. They are built locally in separate worktrees and need renumbering from main when opened.
2. Deployment remains deferred by the user: prepare everything needed to switch on, but provision nothing.

---
## Historical Alpha 27 handover: loading, error and empty screens
- Outcome: [PR #22](https://github.com/EmotiveImpact/REUNIR/pull/22), merged into main as `f9f32d6`.

Read AGENTS.md, platform/docs/BUILD_STATUS.md, STATES.md, decisions/027-loading-error-empty-states.md and ROADMAP.md first. UI_DESIGN_DIRECTION.md remains authoritative. Continue the existing React/Vite + Hono + Better Auth + PostgreSQL application; do not rebuild completed features.

### Where the source is

- Base: main `f5ec8d3` (launch kit after Alpha 22), with main `fab9510` (Alpha 24, 25 and 26) merged in.
- This slice: branch `claude/everyday-use-4z9rmz`. BUILD_STATUS.md records the local runs; the pull request records CI. The owner approved, on 3 October 2026, merging each feature into main with a normal merge commit once its checks pass. Never force-push.
- Alpha 23 (upload scanning) is an open pull request from another thread. This thread uses Alpha 27 to 30.

### What is done

Every page and panel uses the shared loading, error and empty pieces in `apps/web/src/components/states.tsx`; STATES.md sets the conventions for new work. Unknown addresses show Not found; failures keep the shell and offer Try again; empty states only offer actions the viewer may take.

### Run it

```sh
cd platform
npm ci
VITE_DATA_MODE=demo npm run dev   # fictional demo at http://127.0.0.1:5173
```

Open any unknown address for Not found, or `#/states/fault` in the demo for the error boundary. No migration.

Checks from `platform/`: `npm run typecheck`, `npm test`, `npm run test:http`, `npm run build`, `npm run bundle:preview`, every `npm run test:browser:*` script (now including `test:browser:states`), and `npm run test:postgres` against a fresh disposable loopback database named `reunir_ci`. From the repository root: `python3 -m unittest discover -s scripts -p "test_*.py"` and `python3 scripts/check_research.py`.

### Next

1. Content curation, task file uploads with live updates, and moving the remaining forms to the shadcn components, each as its own pull request.
2. Deployment remains deferred by the user: prepare everything needed to switch on, but provision nothing.

---
## Historical Alpha 25 handover: contributor roles for teaching
- Outcome: [PR #20](https://github.com/EmotiveImpact/REUNIR/pull/20), merged into main as `fab9510`.

Read AGENTS.md, platform/docs/BUILD_STATUS.md, INSTRUCTORS.md, decisions/025-contributor-roles.md and ROADMAP.md first. UI_DESIGN_DIRECTION.md remains authoritative. Continue the existing React/Vite + Hono + Better Auth + PostgreSQL application; do not rebuild completed features.

### Where the source is

- Base: main `ec4285d`, the merge of PR #15 (Alpha 22), with main `f5ec8d3` (PR #17, the launch kit) main `d62424d` (PR #19, Alpha 24 group conversations) and main `9b34cac` (PR #18, Alpha 26 email confirmation and change) merged in. The application version is main's 0.26.0-alpha.1.
- This slice: branch `claude/courses-teaching-6hum2q`, merged as PR #20 (`fab9510`). BUILD_STATUS.md records the local runs; the pull request records CI. The owner approved, on 3 October 2026, merging each feature into main with a normal merge commit once its checks pass. Never force-push.
- Parallel slices: Alpha 23 (upload scanning) is on PR #16; Alpha 24 (group conversations, migration 0022) and Alpha 26 (email change, no migration) are on main. Take the next free alpha and migration numbers from main when opening a pull request, and renumber if main moves.

### What is done

A teaching grant names a role. Instructors keep everything they had; contributors write a track's drafts and files, and its instructors publish them. Contributors never see or review learners' knowledge-check attempts. Changing a role replaces the grant. Additive migration 0023 adds `track_instructors.role` and role-aware policies.

### Run it

```sh
cd platform
npm ci
VITE_DATA_MODE=demo npm run dev   # fictional demo at http://127.0.0.1:5173
```

Preview as admin, open a track, choose **Instructors**, pick a member and **Contributor**, then **Add**. For PostgreSQL: `npm run db:migrate` (applies 0023; no grant changes).

Checks from `platform/`: `npm run typecheck`, `npm test`, `npm run test:http`, `npm run build`, `npm run bundle:preview`, every `npm run test:browser:*` script, and `npm run test:postgres` against a fresh disposable loopback database named `reunir_ci` with no leftover `reunir_*` roles. From the repository root: `python3 -m unittest discover -s scripts -p "test_*.py"` and `python3 scripts/check_research.py`. Set `CHROMIUM_PATH` when Playwright's own browser is not installed.

### Product invariants for the next slice

People + Purpose + Progress + Projects + Proof. Keep drafts private and publication explicit, revision history and attempts immutable except through the owner-authorised erasure and a person's own account deletion, tenant isolation and role checks current, private goals, messages, scores and notification settings private. Authority is granted explicitly and must be current when it takes effect; teaching is a per-track grant with a role, not a community role, and publishing stays with instructors. Owner and administrator authority may require two-step sign-in. Lists that grow page from the server with keyset cursors. A deleted person's shared work stays as Former member. A community has exactly one owner. The interface stays black, white and neutral grey. Community review is not accreditation.

### Next

1. Per-lesson grants, instructors starting their own tracks (published by an administrator) and uploaded lesson video, each its own release. Question banks, timers and partial marks wait for pilot needs.
2. Email verification and change, then the remaining account and trust items in ROADMAP.md.
3. Deployment remains deferred by the user: prepare everything needed to switch on, but provision nothing.

---
## Historical Alpha 26 handover: confirming and changing your email address

Read AGENTS.md, platform/docs/BUILD_STATUS.md, ACCOUNTS.md, SECURITY.md, decisions/026-email-confirmation-and-change.md and ROADMAP.md first. UI_DESIGN_DIRECTION.md remains authoritative. Continue the existing React/Vite + Hono + Better Auth + PostgreSQL application; do not rebuild completed features.

### Where the source is

- Base: main `b24095a` (Alpha 21), with main `ec4285d` (PR #15, Alpha 22 cover descriptions) merged in. Main `f5ec8d3` (PR #17, launch kit: LAUNCH_RUNBOOK.md and `npm run launch:preflight`) and `d62424d` (PR #19, Alpha 24 group conversations, migration 0022) are merged in too. Alpha 23 is claimed by open pull requests (#16, #21), Alpha 24 (group conversations, PR #19) reached main first, and Alpha 25 is on PR #20, so this release is Alpha 26 with decision 026.
- Outcome: [PR #18](https://github.com/EmotiveImpact/REUNIR/pull/18), merged into main as `9b34cac`.
- This slice: branch `claude/accounts-trust-zojuqs`. BUILD_STATUS.md records the local runs; the pull request records CI. The owner approved, on 3 October 2026, merging each feature into main with a normal merge commit once its checks pass. Never force-push.

### What is done

People confirm their email address by a link from Your account, and accepting an invitation confirms the invited address. `EMAIL_VERIFICATION` (`required` by default in production, applied only where mail can be sent) refuses a session to an unconfirmed address and queues a fresh link. `POST /api/account/email` checks the password and sends a link to the new address; the address changes only when it is opened, and the current address is told. No migration.

### Run it

```sh
cd platform
npm ci
VITE_DATA_MODE=demo npm run dev   # fictional demo at http://127.0.0.1:5173
```

The demo's Your account explains the Email address panel; it has no addresses. In a connected build, configure `RESEND_API_KEY`, `EMAIL_FROM` and `EMAIL_VERIFICATION` deliberately.

Checks from `platform/`: `npm run typecheck`, `npm test`, `npm run test:http`, `npm run build`, `npm run bundle:preview`, every `npm run test:browser:*` script, and `npm run test:postgres` against a fresh disposable loopback database named `reunir_ci` with no leftover `reunir_*` roles. From the repository root: `python3 -m unittest discover -s scripts -p "test_*.py"` and `python3 scripts/check_research.py`. Set `CHROMIUM_PATH` when Playwright's own browser is not installed.

### Product invariants for the next slice

People + Purpose + Progress + Projects + Proof. Keep drafts private and publication explicit, revision history and attempts immutable except through the owner-authorised erasure and a person's own account deletion, tenant isolation and role checks current, private goals, messages, scores and notification settings private. An address changes only by a link opened at the new address after the password; the old address is always told. Authority is granted explicitly and must be current when it takes effect. Lists that grow page from the server with keyset cursors. A deleted person's shared work stays as Former member. A community has exactly one owner. The interface stays black, white and neutral grey. Community review is not accreditation.

### Next

1. Data retention rules, appeals of moderation decisions, a correction and withdrawal history for reviewed evidence, and consented credit for several contributors, one pull request each.
2. Deployment remains deferred by the user: prepare everything needed to switch on, but provision nothing.

---
## Historical Alpha 24 handover: group conversations

Read AGENTS.md, platform/docs/BUILD_STATUS.md, decisions/024-group-conversations.md, ARCHITECTURE.md (messaging boundaries), SECURITY.md and ROADMAP.md first. UI_DESIGN_DIRECTION.md remains authoritative. Continue the existing React/Vite + Hono + Better Auth + PostgreSQL application; do not rebuild completed features.

### Where the source is

- Base: main `f5ec8d3`, the merge of PR #17 (launch kit) on top of PR #15 (Alpha 22).
- This slice: branch `claude/group-conversations-5arqv6`.
- Outcome: [PR #19](https://github.com/EmotiveImpact/REUNIR/pull/19), merged into main as `d62424d`.
- Earlier note: BUILD_STATUS.md records the local runs; the pull request records CI. The owner approved, on 3 October 2026, merging each feature into main with a normal merge commit once its checks pass. Never force-push.
- Parallel work: Alpha 23 (upload scanning, PR #16) and an email confirmation slice (PR #18, also labelled Alpha 24) were open when this was written. Whichever merges after another must take the next free alpha and migration numbers and move the migration-count assertions.

### What is done

Members start named group conversations of up to 20 people from Messages. Anyone in a group adds people and renames it, the starter removes people, anyone leaves. People added later read only what is written after they join, enforced by a restrictive row-security policy as well as the API. A block stops adding but never pauses a group. Additive migration 0022 adds `kind`, `title` and `created_by` to `conversations`, the `conversation_joins` table and the policies for late joiners and leaving.

### Run it

```sh
cd platform
npm ci
VITE_DATA_MODE=demo npm run dev   # fictional demo at http://127.0.0.1:5173
```

In the demo open Messages and choose **New group**. For PostgreSQL: `npm run db:migrate` (applies 0022), then `npm run db:grant-runtime` for the `conversation_joins` grant.

Checks from `platform/`: `npm run typecheck`, `npm test`, `npm run test:http`, `npm run build`, `npm run bundle:preview`, every `npm run test:browser:*` script (now including `test:browser:groups`), and `npm run test:postgres` against a fresh disposable loopback database named `reunir_ci` with no leftover `reunir_*` roles. From the repository root: `python3 -m unittest discover -s scripts -p "test_*.py"` and `python3 scripts/check_research.py`. Set `CHROMIUM_PATH` when Playwright's own browser is not installed.

### Product invariants for the next slice

People + Purpose + Progress + Projects + Proof. Keep drafts private and publication explicit, revision history and attempts immutable except through the owner-authorised erasure and a person's own account deletion, tenant isolation and role checks current, private goals, messages (direct and group), scores and notification settings private. Nobody reads a conversation they are not in, and people added to a group do not read what came before. Authority is granted explicitly and must be current when it takes effect. Lists that grow page from the server with keyset cursors. A deleted person's shared work stays as Former member. A community has exactly one owner. The interface stays black, white and neutral grey. Community review is not accreditation.

### Next

1. Merge PR #16 (Alpha 23) and PR #18 with the numbering rule above.
2. The remaining account and trust items and the covers follow-ups in ROADMAP.md.
3. Deployment remains deferred by the user: follow LAUNCH_RUNBOOK.md when they decide; provision nothing before then.

---
## Historical launch kit handover

Read AGENTS.md, platform/docs/BUILD_STATUS.md, LAUNCH_RUNBOOK.md, COVERS.md, decisions/022-cover-descriptions.md and ROADMAP.md first. UI_DESIGN_DIRECTION.md remains authoritative. Continue the existing React/Vite + Hono + Better Auth + PostgreSQL application; do not rebuild completed features.

### Where the source is

- Base: main `ec4285d`, the merge of PR #15 (Alpha 22), tree identical to its tested head `1645ab7`. PR #15 passed CI runs 37121503128 and 37121505780.
- This slice: branch `claude/build-out-tvzn40`.
- Outcome: [PR #17](https://github.com/EmotiveImpact/REUNIR/pull/17), merged into main as `f5ec8d3`.
- Earlier note: BUILD_STATUS.md records the local runs; the pull request records CI. The owner approved, on 3 October 2026, merging each feature into main with a normal merge commit once its checks pass. Never force-push.

### What is done

Whoever may change a track or project cover can add an optional description of up to 150 characters. The track's or project's own page announces a described cover as an image; everywhere else covers stay decorative. A new picture starts without a description. No migration.

The launch kit adds `platform/docs/LAUNCH_RUNBOOK.md` and `npm run launch:preflight`, an offline check of a production environment's names and shapes that never prints a value. Nothing was provisioned; the owner decides when to launch.

### Run it

```sh
cd platform
npm ci
VITE_DATA_MODE=demo npm run dev   # fictional demo at http://127.0.0.1:5173
```

Preview as admin, open a track, choose **Cover** and fill in **Describe the picture (optional)**.

Checks from `platform/`: `npm run typecheck`, `npm test`, `npm run test:http`, `npm run build`, `npm run bundle:preview`, every `npm run test:browser:*` script, and `npm run test:postgres` against a fresh disposable loopback database named `reunir_ci` with no leftover `reunir_*` roles. From the repository root: `python3 -m unittest discover -s scripts -p "test_*.py"` and `python3 scripts/check_research.py`. Set `CHROMIUM_PATH` when Playwright's own browser is not installed.

### Product invariants for the next slice

People + Purpose + Progress + Projects + Proof. Keep drafts private and publication explicit, revision history and attempts immutable except through the owner-authorised erasure and a person's own account deletion, tenant isolation and role checks current, private goals, messages, scores and notification settings private. Authority is granted explicitly and must be current when it takes effect; teaching is a per-track grant, not a community role. Owner and administrator authority may require two-step sign-in. Lists that grow page from the server with keyset cursors. A deleted person's shared work stays as Former member. A community has exactly one owner. The interface stays black, white and neutral grey. Community review is not accreditation.

### Next

1. Cover thumbnails, cover library renaming and tags, and a higher library limit (this thread). Virus scanning of uploads, group conversations, accounts and trust, courses and teaching, and everyday use are owned by other threads since 3 October 2026; built and tested scanning and group conversation commits are in the project files under `ferven/handover/`. Each pull request takes the next free alpha and migration numbers from main.
2. Email verification and change, then the remaining account and trust items in ROADMAP.md.
3. Deployment remains deferred by the user: prepare everything needed to switch on, but provision nothing.

---
## Historical Alpha 22 handover: cover descriptions

Read AGENTS.md, platform/docs/BUILD_STATUS.md, COVERS.md, decisions/022-cover-descriptions.md and ROADMAP.md first. UI_DESIGN_DIRECTION.md remains authoritative. Continue the existing React/Vite + Hono + Better Auth + PostgreSQL application; do not rebuild completed features.

### Where the source is

- Base: main `b24095a`, the merge of PR #14 (Alpha 21), tree identical to its tested head `3f573bd`.
- This slice: branch `claude/build-out-tvzn40`. BUILD_STATUS.md records the local runs; the pull request records CI. The owner approved, on 3 October 2026, merging each feature into main with a normal merge commit once its checks pass. Never force-push.
- Outcome: [PR #15](https://github.com/EmotiveImpact/REUNIR/pull/15), green in CI runs 37121503128 and 37121505780, merged into main as `ec4285d`.

### What is done

Whoever may change a track or project cover can add an optional description of up to 150 characters. The track's or project's own page announces a described cover as an image; everywhere else covers stay decorative. A new picture starts without a description. No migration.

### Run it

```sh
cd platform
npm ci
VITE_DATA_MODE=demo npm run dev   # fictional demo at http://127.0.0.1:5173
```

Preview as admin, open a track, choose **Cover** and fill in **Describe the picture (optional)**.

Checks from `platform/`: `npm run typecheck`, `npm test`, `npm run test:http`, `npm run build`, `npm run bundle:preview`, every `npm run test:browser:*` script, and `npm run test:postgres` against a fresh disposable loopback database named `reunir_ci` with no leftover `reunir_*` roles. From the repository root: `python3 -m unittest discover -s scripts -p "test_*.py"` and `python3 scripts/check_research.py`. Set `CHROMIUM_PATH` when Playwright's own browser is not installed.

### Product invariants for the next slice

People + Purpose + Progress + Projects + Proof. Keep drafts private and publication explicit, revision history and attempts immutable except through the owner-authorised erasure and a person's own account deletion, tenant isolation and role checks current, private goals, messages, scores and notification settings private. Authority is granted explicitly and must be current when it takes effect; teaching is a per-track grant, not a community role. Owner and administrator authority may require two-step sign-in. Lists that grow page from the server with keyset cursors. A deleted person's shared work stays as Former member. A community has exactly one owner. The interface stays black, white and neutral grey. Community review is not accreditation.

### Next

1. Virus scanning of uploads (Alpha 23) and group conversations (Alpha 24).
2. Email verification and change, then the remaining account and trust items in ROADMAP.md.
3. Deployment remains deferred by the user: prepare everything needed to switch on, but provision nothing.

---
## Historical Alpha 21 handover: two-step sign-in

Read AGENTS.md, platform/docs/BUILD_STATUS.md, ACCOUNTS.md, SECURITY.md, decisions/021-two-step-sign-in.md and ROADMAP.md first. UI_DESIGN_DIRECTION.md remains authoritative. Continue the existing React/Vite + Hono + Better Auth + PostgreSQL application; do not rebuild completed features.

### Where the source is

- Base: main `c137f90`, the merge of PR #13 (Alpha 20), tree identical to its tested head `19236bc`.
- This slice: [PR #14](https://github.com/EmotiveImpact/REUNIR/pull/14), green in CI runs 37120425288 and 37120428877 and merged into main as `b24095a` (tree identical to the tested head `3f573bd`). BUILD_STATUS.md records the local runs. The owner approved, on 3 October 2026, merging each feature into main with a normal merge commit once its checks pass. Never force-push.

### What is done

Anyone can turn on two-step sign-in (authenticator-app codes and ten one-time backup codes) on Your account, using Better Auth's own two-factor plugin. `ADMIN_TWO_FACTOR` (`required` by default in production, `optional` elsewhere) makes owner and administrator authority depend on it: without it, reads and member or moderator actions continue, and owner or administrator actions return 403 `TWO_FACTOR_REQUIRED`. Additive migration 0021 adds `auth_user.two_factor_enabled` and `auth_two_factor`, granted explicitly to the runtime role.

### Run it

```sh
cd platform
npm ci
VITE_DATA_MODE=demo npm run dev   # fictional demo at http://127.0.0.1:5173
```

The demo explains two-step sign-in on Your account but has no accounts, so it shows no key or codes. For PostgreSQL: `npm run db:migrate` (applies 0021), then `npm run db:grant-runtime` for the new table's grant. Set `ADMIN_TWO_FACTOR` deliberately before a pilot.

Checks from `platform/`: `npm run typecheck`, `npm test`, `npm run test:http`, `npm run build`, `npm run bundle:preview`, every `npm run test:browser:*` script, and `npm run test:postgres` against a fresh disposable loopback database named `reunir_ci` with no leftover `reunir_*` roles. From the repository root: `python3 -m unittest discover -s scripts -p "test_*.py"` and `python3 scripts/check_research.py`. Set `CHROMIUM_PATH` when Playwright's own browser is not installed.

### Product invariants for the next slice

People + Purpose + Progress + Projects + Proof. Keep drafts private and publication explicit, revision history and attempts immutable except through the owner-authorised erasure and a person's own account deletion, tenant isolation and role checks current, private goals, messages, scores and notification settings private. Authority is granted explicitly and must be current when it takes effect; teaching is a per-track grant, not a community role. Owner and administrator authority may require two-step sign-in; secrets and backup codes never leave `auth_two_factor`. Lists that grow page from the server with keyset cursors. A deleted person's shared work stays as Former member. A community has exactly one owner. The interface stays black, white and neutral grey. Community review is not accreditation.

### Next

1. Cover picture descriptions (Alpha 22), virus scanning of uploads (Alpha 23) and group conversations (Alpha 24).
2. Email verification and change, then the remaining account and trust items in ROADMAP.md.
3. Deployment remains deferred by the user: prepare everything needed to switch on, but provision nothing.

---
## Historical Alpha 20 handover: instructor invitations

Read AGENTS.md, platform/docs/BUILD_STATUS.md, INSTRUCTORS.md, decisions/020-instructor-invitations.md and ROADMAP.md first. UI_DESIGN_DIRECTION.md remains authoritative. Continue the existing React/Vite + Hono + Better Auth + PostgreSQL application; do not rebuild completed features.

### Where the source is

- Base: main `648df31`, the merge of PR #12 (Alpha 19), tree identical to its tested head `dd50d86`.
- This slice: [PR #13](https://github.com/EmotiveImpact/REUNIR/pull/13), green in CI runs 37119260110 and 37119273038 and merged into main as `c137f90` (tree identical to the tested head `19236bc`). BUILD_STATUS.md records the local runs. The owner approved, on 3 October 2026, merging each feature into main with a normal merge commit once its checks pass. Never force-push.

### What is done

Owners and administrators invite someone who is not yet a member to teach one track from that track's Instructors dialogue. Accepting makes them a member and that track's instructor in the sender's name, only while the sender still administers the community. Additive migration 0020 adds the invitation's optional track and one insert policy that also checks the accepting account's address.

### Run it

```sh
cd platform
npm ci
VITE_DATA_MODE=demo npm run dev   # fictional demo at http://127.0.0.1:5173
```

Preview as admin, open a track, choose **Instructors**, then **Invite someone new to teach**. For PostgreSQL: `npm run db:migrate` (applies 0020; no grant changes).

Checks from `platform/`: `npm run typecheck`, `npm test`, `npm run test:http`, `npm run build`, `npm run bundle:preview`, every `npm run test:browser:*` script, and `npm run test:postgres` against a fresh disposable loopback database named `reunir_ci` with no leftover `reunir_*` roles. From the repository root: `python3 -m unittest discover -s scripts -p "test_*.py"` and `python3 scripts/check_research.py`. Set `CHROMIUM_PATH` when Playwright's own browser is not installed.

### Product invariants for the next slice

People + Purpose + Progress + Projects + Proof. Keep drafts private and publication explicit, revision history and attempts immutable except through the owner-authorised erasure and a person's own account deletion, tenant isolation and role checks current, private goals, messages, scores and notification settings private. Authority is granted explicitly and must be current when it takes effect; teaching is a per-track grant, not a community role. Lists that grow page from the server with keyset cursors. A deleted person's shared work stays as Former member. A community has exactly one owner. The interface stays black, white and neutral grey. Community review is not accreditation.

### Next

1. Two-step sign-in for owners and administrators, and email verification and change.
2. Later roadmap features: cover descriptions, upload scanning, group conversations and the account and trust items in ROADMAP.md.
3. Deployment remains deferred by the user: prepare everything needed to switch on, but provision nothing.

---
## Historical Alpha 19 handover: notification settings and digests

Read AGENTS.md, platform/docs/BUILD_STATUS.md, decisions/019-notification-settings-and-digests.md, PILOT_OPERATIONS.md and ROADMAP.md first. UI_DESIGN_DIRECTION.md remains authoritative. Continue the existing React/Vite + Hono + Better Auth + PostgreSQL application; do not rebuild completed features.

### Where the source is

- Base: Alpha 18 on `claude/build-out-tvzn40` ([PR #11](https://github.com/EmotiveImpact/REUNIR/pull/11)), from main `a924295` (PR #10, Alpha 17).
- This slice: [PR #12](https://github.com/EmotiveImpact/REUNIR/pull/12), green in CI runs 37118692649 and 37118705076 and merged into main as `648df31` (tree identical to the tested head `dd50d86`). BUILD_STATUS.md records the local runs. The owner approved, on 3 October 2026, merging each feature into main with a normal merge commit once its checks pass. Never force-push.

### What is done

Members turn off notices about conversations, learning, projects or events per community and may choose a daily or weekly email digest of unread notices (Notifications page, **Notification settings**). Access, role, ownership and teaching notices always arrive. Muting is forward only. Additive migration 0019 adds `notification_preferences` with own-row writes and a narrow read policy for the digest job. `GET /api/internal/digests` and `npm run digests:queue` queue digests through the encrypted outbox; the mail drain sends them. Nothing is scheduled or sent until a mail provider and scheduler are configured.

### Run it

```sh
cd platform
npm ci
VITE_DATA_MODE=demo npm run dev   # fictional demo at http://127.0.0.1:5173
```

For PostgreSQL: `npm run db:migrate` (applies 0019; no grant changes beyond the usual runtime grant).

Checks from `platform/`: `npm run typecheck`, `npm test`, `npm run test:http`, `npm run build`, `npm run bundle:preview`, every `npm run test:browser:*` script (now including `test:browser:notifications`), and `npm run test:postgres` against a fresh disposable loopback database named `reunir_ci` with no leftover `reunir_*` roles. From the repository root: `python3 -m unittest discover -s scripts -p "test_*.py"` and `python3 scripts/check_research.py`. Set `CHROMIUM_PATH` when Playwright's own browser is not installed.

### Product invariants for the next slice

People + Purpose + Progress + Projects + Proof. Keep drafts private and publication explicit, revision history and attempts immutable except through the owner-authorised erasure and a person's own account deletion, tenant isolation and role checks current, private goals, messages, scores and notification settings private. Notices about a person's own access always arrive. Lists that grow page from the server with keyset cursors. A deleted person's shared work stays as Former member. A community has exactly one owner. Authority is granted, never inferred from attribution or engagement. The interface stays black, white and neutral grey. Community review is not accreditation.

### Next

1. Instructor email invitations and two-step sign-in for owners and administrators.
2. Later roadmap features: email verification and change, cover descriptions, upload scanning, group conversations and the account and trust items in ROADMAP.md.
3. Deployment remains deferred by the user: prepare everything needed to switch on, but provision nothing.

---
## Historical Alpha 18 handover: server pages for long lists

Read AGENTS.md, platform/docs/BUILD_STATUS.md, decisions/018-server-pages-for-long-lists.md, ARCHITECTURE.md and ROADMAP.md first. UI_DESIGN_DIRECTION.md remains authoritative. Continue the existing React/Vite + Hono + Better Auth + PostgreSQL application; do not rebuild completed features.

### Where the source is

- Base: main `a924295`, the merge of PR #10 (Alpha 17), tree identical to its tested head `8f73bdd`.
- This slice: [PR #11](https://github.com/EmotiveImpact/REUNIR/pull/11), green in CI runs 37118025779 and 37118037759 and merged into main as `a211a09` (tree identical to the tested head `595dee2`). BUILD_STATUS.md records the local runs. The owner approved, on 3 October 2026, merging each feature into main with a normal merge commit once its checks pass. Never force-push.

### What is done

Notices, the knowledge-check review queues and the audit trail load a page at a time from `GET /api/organisations/:slug/pages/:list` with opaque keyset cursors. The snapshot carries the newest 30 notices, the newest 12 audit entries for administrators, only the person's own attempts and a `summary` of exact counts that badges and tabs read. Workspace reads skip the outbox, read the newest 100 audit entries and only the acting person's notices; account deletion and operator erasure still read in full. No migration and no grant change.

### Run it

```sh
cd platform
npm ci
VITE_DATA_MODE=demo npm run dev   # fictional demo at http://127.0.0.1:5173
```

For PostgreSQL: `npm run db:migrate` (no new migration in this slice).

Checks from `platform/`: `npm run typecheck`, `npm test`, `npm run test:http`, `npm run build`, `npm run bundle:preview`, every `npm run test:browser:*` script, and `npm run test:postgres` against a fresh disposable loopback database named `reunir_ci` with no leftover `reunir_*` roles. From the repository root: `python3 -m unittest discover -s scripts -p "test_*.py"` and `python3 scripts/check_research.py`. Set `CHROMIUM_PATH` when Playwright's own browser is not installed.

### Product invariants for the next slice

People + Purpose + Progress + Projects + Proof. Keep drafts private and publication explicit, revision history and attempts immutable except through the owner-authorised erasure and a person's own account deletion, tenant isolation and role checks current, private goals, messages and scores private. Lists that grow page from the server with keyset cursors, never offsets, and counts come from the summary rather than the window. A deleted person's shared work stays as Former member. A community has exactly one owner. Authority is granted, never inferred from attribution or engagement. The interface stays black, white and neutral grey. Community review is not accreditation.

### Next

1. Notification settings and email digests (Alpha 19).
2. Later roadmap features: instructor email invitations, two-step sign-in for owners and administrators, cover descriptions, upload scanning, group conversations and the account and trust items in ROADMAP.md.
3. Deployment remains deferred by the user: prepare everything needed to switch on, but provision nothing.

---
## Historical Alpha 17 handover: loose ends after account deletion

Read AGENTS.md, platform/docs/BUILD_STATUS.md, ACCOUNTS.md, COVERS.md, decisions/017-follow-ups-after-account-deletion.md and ROADMAP.md first. UI_DESIGN_DIRECTION.md remains authoritative. Continue the existing React/Vite + Hono + Better Auth + PostgreSQL application; do not rebuild completed features.

### Where the source is

- Base: main `12ed75c`, the merge of PR #8 (Alpha 16 ownership transfer), with PR #9 (its merge record) merged in.
- This slice: branch `claude/build-out-tvzn40`. BUILD_STATUS.md records the local runs; the pull request records CI. The owner approved, on 3 October 2026, merging each feature into main with a normal merge commit once its checks pass. Never force-push.

### What is done

Deleting your own account hands back tasks you had claimed without proof in every community, including one where you were suspended (additive migration 0018, admitted only during your own deletion). A replaced or removed track or project cover loses its upload record in the same change and its stored file straight after commit. The PostgreSQL check covers a deletion that starts while an invitation acceptance holds the account. Mentions of a former member in other people's posts stay as written (decision 017).

### Run it

```sh
cd platform
npm ci
VITE_DATA_MODE=demo npm run dev   # fictional demo at http://127.0.0.1:5173
```

For PostgreSQL: `npm run db:migrate` (applies 0018; no grant changes).

Checks from `platform/`: `npm run typecheck`, `npm test`, `npm run test:http`, `npm run build`, `npm run bundle:preview`, every `npm run test:browser:*` script, and `npm run test:postgres` against a fresh disposable loopback database named `reunir_ci` with no leftover `reunir_*` roles. From the repository root: `python3 -m unittest discover -s scripts -p "test_*.py"` and `python3 scripts/check_research.py`. Set `CHROMIUM_PATH` when Playwright's own browser is not installed.

### Product invariants for the next slice

People + Purpose + Progress + Projects + Proof. Keep drafts private and publication explicit, revision history and attempts immutable except through the owner-authorised erasure and a person's own account deletion, tenant isolation and role checks current, private goals, messages and scores private. A deleted person's shared work stays as Former member, and other people's words about them are not rewritten. A community has exactly one owner, and ownership changes only by the owner's re-authenticated handover to an administrator. Authority is granted, never inferred from attribution or engagement. Pictures keep their own colours and carry no words; the interface stays black, white and neutral grey. Community review is not accreditation.

### Next

1. Server-side pagination for review queues and other long lists (Alpha 18).
2. Later roadmap features: instructor email invitations, two-step sign-in for owners and administrators, notification settings and digests, cover descriptions, upload scanning, group conversations and the account and trust items in ROADMAP.md.
3. Deployment remains deferred by the user: prepare everything needed to switch on, but provision nothing.

---
## Historical Alpha 16 handover: ownership transfer

Read AGENTS.md, platform/docs/BUILD_STATUS.md, ACCOUNTS.md, decisions/016-ownership-transfer.md, ROADMAP.md and research/notes/21_OWNERSHIP_TRANSFER.md first. UI_DESIGN_DIRECTION.md remains authoritative. Continue the existing React/Vite + Hono + Better Auth + PostgreSQL application; do not rebuild completed features.

### Where the source is

- Base: main `cc806e7`, the merge of PR #6 (Alpha 15 account deletion), with main `4bda5e7` (PR #7, the changelog) merged in.
- This slice: branch `claude/ownership-transfer-7kx603`, [PR EmotiveImpact/REUNIR#8](https://github.com/EmotiveImpact/REUNIR/pull/8). Tested commit `553e0a7`, green in CI runs 37110819170 and 37110833684. Merged into main as `12ed75c` (tree identical to the tested head `d9568fa`); the owner confirmed the merge. BUILD_STATUS.md records the local runs and the CI receipt. Merging into main needs the owner's approval.

### What is done

Ownership transfer is implemented and verified locally (see BUILD_STATUS.md for exact counts). In **Members and access**, the owner opens an administrator's access settings and chooses **Hand over ownership…**; after the current password (checked by Better Auth) and the community's name typed in full, the administrator becomes the owner and the previous owner becomes an administrator, with an audit entry and a notice to the new owner. Only the active owner can do it, only to an active administrator, five attempts in fifteen minutes. `POST /api/organisations/:slug/ownership` is not a workspace command, so the generic command route cannot skip the password. Migration 0017 adds a unique index so a community never holds two owners; 0001 to 0016 are unchanged and no new grants are needed. **Your account** now points owners to the handover; once they own no community, they can delete their account as in Alpha 15.

### Run it

```sh
cd platform
npm ci
VITE_DATA_MODE=demo npm run dev   # fictional demo at http://127.0.0.1:5173
```

Preview as admin (Amina Okafor, the owner) → Your account → Open members and access → Manage Maya Bennett → set the role to admin → Hand over ownership…, type "Code Black". Your account then lists only Studio North as owned. For PostgreSQL: `npm run db:migrate`.

Checks from `platform/`: `npm run typecheck`, `npm test`, `npm run test:http`, `npm run build`, `npm run bundle:preview`, every `npm run test:browser:*` script, and `npm run test:postgres` against a disposable loopback database named `reunir_ci`. From the repository root: `python3 -m unittest discover -s scripts -p "test_*.py"` and `python3 scripts/check_research.py`. Set `CHROMIUM_PATH` when Playwright's own browser is not installed.

### Product invariants for the next slice

People + Purpose + Progress + Projects + Proof. Keep drafts private and publication explicit, revision history and attempts immutable except through the owner-authorised erasure and a person's own account deletion, tenant isolation and role checks current, private goals, messages and scores private. A deleted person's shared work stays as Former member. A community has exactly one owner, and ownership changes only by the owner's re-authenticated handover to an administrator. Authority is granted, never inferred from attribution or engagement. Pictures keep their own colours and carry no words; the interface stays black, white and neutral grey. Community review is not accreditation.

### Next

1. Server-side pagination for review queues and other long lists, beyond the bounded workspace snapshot.
2. Deployment remains deferred by the user: Neon, Vercel, bucket, sender and scheduler are all unprovisioned.

---
## Historical Alpha 15 handover: account deletion

Read AGENTS.md, platform/docs/BUILD_STATUS.md, ACCOUNTS.md, LEARNER_RECORDS.md, ROADMAP.md and research/notes/20_ACCOUNT_DELETION.md first. UI_DESIGN_DIRECTION.md remains authoritative. Continue the existing React/Vite + Hono + Better Auth + PostgreSQL application; do not rebuild completed features.

### Where the source was

- Base: main `661fac9d921292f4d7432c1df4c7b98827cf6211`, the merge of PR #5 (Alpha 11 to 14), whose tree matched its tested head and whose push to main passed CI run 37101346869.
- This slice: branch `claude/laughing-goodall-2p7z0v`, restarted from that main as a fresh change, [PR EmotiveImpact/REUNIR#6](https://github.com/EmotiveImpact/REUNIR/pull/6). Tested commit `67623fb`; BUILD_STATUS.md records the local runs and the CI receipt. Merging into main needs the owner's approval.
- Outcome: merged into main as `cc806e7` with the owner's approval on 3 October 2026; no PRs were left open.

### What is done

Account deletion is implemented and verified locally (see BUILD_STATUS.md for exact counts). **Your account** in the account menu lists the person's communities and says what deletion keeps and removes. After the current password (checked by Better Auth) and the typed phrase "delete my account", one transaction deletes the account in every community: each membership becomes the same scrubbed "Former member" record; posts, comments, project work, lessons, files, covers, reports and sent messages stay; personal records, the learning record, private files, invitations to the address, queued mail, sessions and the account go. Owners are refused. Former members read as Former member everywhere, with no photo, profile link or directory place, and conversations with them are read-only. Migration 0015 adds policies that admit only the person's own rows while their own deletion is marked, and 0016 extends that to invitations sent to their own address in any community; 0001 to 0015 are unchanged; rerun `npm run db:grant-runtime` after migrating. The Codex review of PR #6 found three gaps (invitations to communities never joined, older `left` memberships sent in full to the browser, and an invitation accepted during a deletion); all three are fixed with tests, as BUILD_STATUS.md records.

### Run it

```sh
cd platform
npm ci
VITE_DATA_MODE=demo npm run dev   # fictional demo at http://127.0.0.1:5173
```

Account menu → Your account → Delete your account…, type "delete my account", then See the community as Amina Okafor (the owner) to find the kept comment on Common Ground, the read-only conversation and the team place as Former member; Restart the demo brings everyone back. Preview as admin shows the owner refusal. For PostgreSQL: `npm run db:migrate`, then `npm run db:grant-runtime`.

Checks from `platform/`: `npm run typecheck`, `npm test`, `npm run test:http`, `npm run build`, `npm run bundle:preview`, every `npm run test:browser:*` script (including `accounts` and `accounts-connected`), and `npm run test:postgres` against a disposable loopback database named `reunir_ci`. From the repository root: `python3 -m unittest discover -s scripts -p "test_*.py"` and `python3 scripts/check_research.py`. Set `CHROMIUM_PATH` when Playwright's own browser is not installed.

### Product invariants for the next slice

People + Purpose + Progress + Projects + Proof. Keep drafts private and publication explicit, revision history and attempts immutable except through the owner-authorised erasure and a person's own account deletion, tenant isolation and role checks current, private goals, messages and scores private. A deleted person's shared work stays as Former member and is never gathered back into a profile. Authority is granted, never inferred from attribution or engagement. Pictures keep their own colours and carry no words; the interface stays black, white and neutral grey. Community review is not accreditation.

### Next

1. Owner review of the account deletion pull request in the demo, then merge with the owner's approval and read back main.
2. Ownership transfer, so an owner can hand a community over and then delete their account.
3. Server-side pagination for review queues and other long lists, beyond the bounded workspace snapshot.
4. Deployment remains deferred by the user: Neon, Vercel, bucket, sender and scheduler are all unprovisioned.

---
## Historical Alpha 14 handover: learner records

Read AGENTS.md, platform/docs/BUILD_STATUS.md, LEARNER_RECORDS.md, COVERS.md, ASSESSMENTS.md, ROADMAP.md and research/notes/19_LEARNER_RECORDS.md first. UI_DESIGN_DIRECTION.md remains authoritative. Continue the existing React/Vite + Hono + Better Auth + PostgreSQL application; do not rebuild completed features.

### Where the source was

- Base: main `365e1c9a822297ce471083d891eea1f1256e0c63`, the merge of PR #4 (Alpha 10 knowledge checks). Main had not moved when this slice was pushed.
- This slice and the three before it: branch `claude/laughing-goodall-2p7z0v`, [PR EmotiveImpact/REUNIR#5](https://github.com/EmotiveImpact/REUNIR/pull/5). Alpha 11 (receipt `bffa3b7`), Alpha 12 (receipt `98fcee5`) and Alpha 13 (receipt `0fb6903`; CI runs 37098543959 and 37098546160 green on `be9c6c8`) were verified, pushed and recorded first. Alpha 14 learner records follows on the same branch; its head `d52fbcd` passed CI runs 37100233918 (push) and 37100236985 (pull request), recorded in the BUILD_STATUS.md receipt. The owner approved merging PR #5 into main on 3 October 2026 once CI is green.

### What is done

Learner records are implemented and verified locally (see BUILD_STATUS.md for exact counts). A member downloads their own learning record for one community from their profile: everything that is theirs, with titles, names and answer keys exactly as their screen shows them. Operators can erase one member's knowledge-check answers on a request an active owner authorised (`npm run db:erase-learner`, dry run unless `ERASE=yes`, audit of reference and counts only) and clear unused cover files (`npm run db:prune-covers`). Review queues show 20 at a time with exact totals. Migration 0014 adds one owner-scoped delete policy on attempts; 0001 to 0013 are unchanged; the runtime role still cannot delete attempts.

### Run it

```sh
cd platform
npm ci
VITE_DATA_MODE=demo npm run dev   # fictional demo at http://127.0.0.1:5173
```

Open your profile from the account menu and choose Download your learning record. Preview as admin and open Community studio → Knowledge checks for the paged queue. The operator commands need a database; see LEARNER_RECORDS.md. For PostgreSQL: `npm run db:migrate`, then `npm run db:grant-runtime`.

Checks from `platform/`: `npm run typecheck`, `npm test`, `npm run test:http`, `npm run build`, `npm run bundle:preview`, every `npm run test:browser:*` script (the `assessments` and `assessments-connected` suites include the record download and queue paging), and `npm run test:postgres` against a disposable loopback database named `reunir_ci`. From the repository root: `python3 -m unittest discover -s scripts -p "test_*.py"` and `python3 scripts/check_research.py`. Set `CHROMIUM_PATH` when Playwright's own browser is not installed.

### Product invariants for the next slice

People + Purpose + Progress + Projects + Proof. Keep drafts private and publication explicit, revision history and attempts immutable except through the owner-authorised erasure, tenant isolation and role checks current, private goals, messages and scores private. Authority is granted, never inferred from attribution or engagement. Pictures keep their own colours and carry no words; the interface stays black, white and neutral grey. Community review is not accreditation.

### Next, as recorded then

1. Merge PR #5 (Alpha 11 to 14) into main, as the owner approved, and read back main.
2. Account deletion, as the owner decided: posts, comments and project work stay, shown as "Former member"; name, photo and profile are removed; private things (goals, notes, the learning record) are deleted; direct messages stay for the other person. Owners cannot delete their account until ownership can be handed over.
3. Server-side pagination for review queues and other long lists, beyond the bounded workspace snapshot.
4. Deployment remains deferred by the user: Neon, Vercel, bucket, sender and scheduler are all unprovisioned.

---
## Historical Alpha 13 handover: cover library

Read AGENTS.md, platform/docs/BUILD_STATUS.md, COVERS.md, INSTRUCTORS.md, ROADMAP.md and research/notes/18_COVER_LIBRARY.md first. UI_DESIGN_DIRECTION.md remains authoritative. Continue the existing React/Vite + Hono + Better Auth + PostgreSQL application; do not rebuild completed features.

### Where the source was

- Base: main `365e1c9a822297ce471083d891eea1f1256e0c63`, the merge of PR #4 (Alpha 10 knowledge checks). Main had not moved when this slice was pushed.
- This slice and the two before it: branch `claude/laughing-goodall-2p7z0v`, [PR EmotiveImpact/REUNIR#5](https://github.com/EmotiveImpact/REUNIR/pull/5). Alpha 11 cover images (receipt `bffa3b7`; CI runs 37094420188 and 37094422988 green on `108f0ce`) and Alpha 12 track instructors (receipt `98fcee5`; CI runs 37096048793 and 37096051607 green on `a941245`) were verified, pushed and recorded first. Alpha 13 cover library follows on the same branch; its head `be9c6c8` passed CI runs 37098543959 (push) and 37098546160 (pull request), recorded in the BUILD_STATUS.md receipt. Merging into main needs the owner's approval.

### What is done

The cover library is implemented and verified locally (see BUILD_STATUS.md for exact counts). Owners and administrators keep up to 24 named pictures under Community settings → Cover library. Anyone who may change a track or project cover can upload their own picture or choose a library one, which keeps its own focal point and is not copied. A picture in use cannot be removed; removing an unused one deletes its stored file. Every active member sees library pictures; other communities, visitors and unlisted uploads do not. Migration 0013 is additive with forced RLS; 0001 to 0012 are unchanged. The connected cover check now runs the live API under the restricted runtime role.

### Run it

```sh
cd platform
npm ci
VITE_DATA_MODE=demo npm run dev   # fictional demo at http://127.0.0.1:5173
```

Use the account menu's Preview as admin, then Community settings → Cover library to add or remove a picture. Open a track and choose Add a cover → Community library to pick one by name. Preview as instructor offers the same choice on Idris Cole's product track. The demo library starts with Mountain ridge, the bundled landscape cropped so its caption does not show. For PostgreSQL: `npm run db:migrate`, then `npm run db:grant-runtime`.

Checks from `platform/`: `npm run typecheck`, `npm test`, `npm run test:http`, `npm run build`, `npm run bundle:preview`, every `npm run test:browser:*` script (the `covers` and `covers-connected` suites include the library), and `npm run test:postgres` against a disposable loopback database named `reunir_ci`. From the repository root: `python3 -m unittest discover -s scripts -p "test_*.py"` and `python3 scripts/check_research.py`. Set `CHROMIUM_PATH` when Playwright's own browser is not installed.

### Product invariants for the next slice

People + Purpose + Progress + Projects + Proof. Keep drafts private and publication explicit, revision history and attempts immutable, tenant isolation and role checks current, private goals, messages and scores private. Authority is granted, never inferred from attribution or engagement. Pictures keep their own colours and carry no words; the interface stays black, white and neutral grey. Community review is not accreditation.

### Next, as recorded then

1. Owner review of PR #5 (Alpha 11, 12 and 13) in the demo, then merge with the owner's approval and read back main.
2. A paginated review queue and a learner's export of their own attempts.
3. An operator procedure for erasing a learner's answers and removed covers on request.
4. Deployment remains deferred by the user: Neon, Vercel, bucket, sender and scheduler are all unprovisioned.

---
## Historical Alpha 12 handover: track instructors

Read AGENTS.md, platform/docs/BUILD_STATUS.md, INSTRUCTORS.md, COVERS.md, ROADMAP.md and research/notes/17_TRACK_INSTRUCTORS.md first. UI_DESIGN_DIRECTION.md remains authoritative. Continue the existing React/Vite + Hono + Better Auth + PostgreSQL application; do not rebuild completed features.

### Where the source was

- Base: main `365e1c9a822297ce471083d891eea1f1256e0c63`, the merge of PR #4 (Alpha 10 knowledge checks). Main had not moved when this slice was pushed.
- This slice and the one before it: branch `claude/laughing-goodall-2p7z0v`, [PR EmotiveImpact/REUNIR#5](https://github.com/EmotiveImpact/REUNIR/pull/5). Alpha 11 cover images was verified, pushed and recorded first (receipt commit `bffa3b7`, CI runs 37094420188 and 37094422988 green on `108f0ce`); Alpha 12 track instructors follows on the same branch; its head `a941245` passed CI runs 37096048793 (push) and 37096051607 (pull request), recorded in the BUILD_STATUS.md receipt. Merging into main needs the owner's approval.

### What is done

Track instructors are implemented and verified locally (see BUILD_STATUS.md for exact counts): owners and administrators name instructors per track; instructors author that track's lessons, files, knowledge checks and cover and mark its knowledge checks from a teaching page, never their own attempts; other tracks stay invisible to them; suspension ends access at once. Rights come only from explicit grants, never from being shown as a track's author. Migration 0012 is additive with forced RLS and instructor policies; 0001 to 0011 are unchanged. The connected instructor check runs the live API under the restricted runtime role with forced RLS.

### Run it

```sh
cd platform
npm ci
VITE_DATA_MODE=demo npm run dev   # fictional demo at http://127.0.0.1:5173
```

Use the account menu's Preview as instructor (Idris Cole, product track) to open Teaching, mark Sofia Chen's waiting answer and write a lesson in Creator studio. Preview as admin, open a track and choose Instructors to add or remove one. For PostgreSQL: `npm run db:migrate`, then `npm run db:grant-runtime`.

Checks from `platform/`: `npm run typecheck`, `npm test`, `npm run test:http`, `npm run build`, `npm run bundle:preview`, every `npm run test:browser:*` script including `instructors` and `instructors-connected`, and `npm run test:postgres` against a disposable loopback database named `reunir_ci`. From the repository root: `python3 -m unittest discover -s scripts -p "test_*.py"` and `python3 scripts/check_research.py`. Set `CHROMIUM_PATH` when Playwright's own browser is not installed.

### Product invariants for the next slice

People + Purpose + Progress + Projects + Proof. Keep drafts private and publication explicit, revision history and attempts immutable, tenant isolation and role checks current, private goals, messages and scores private. Authority is granted, never inferred from attribution or engagement. Pictures keep their own colours; the interface stays black, white and neutral grey. Community review is not accreditation.

### Next, as recorded then

1. Owner review of PR #5 (Alpha 11 and Alpha 12) in the demo, then merge with the owner's approval and read back main.
2. A paginated review queue and a learner's export of their own attempts.
3. An operator procedure for erasing a learner's answers and removed covers on request.
4. Deployment remains deferred by the user: Neon, Vercel, bucket, sender and scheduler are all unprovisioned.

---
## Historical Alpha 11 handover: cover images

Read AGENTS.md, platform/docs/BUILD_STATUS.md, COVERS.md, ROADMAP.md and research/notes/16_COVER_IMAGES.md first. UI_DESIGN_DIRECTION.md remains authoritative. Continue the existing React/Vite + Hono + Better Auth + PostgreSQL application; do not rebuild completed features.

### Where the source was

- Base: main `365e1c9a822297ce471083d891eea1f1256e0c63`, the merge of PR #4 (Alpha 10 knowledge checks), whose tree is identical to the tested PR head `abbb51f`. PR #5 was the only open pull request when this slice started.
- This slice: branch `claude/laughing-goodall-2p7z0v`, [PR EmotiveImpact/REUNIR#5](https://github.com/EmotiveImpact/REUNIR/pull/5). It began as the cover contrast follow-up (built from main `788e5d7`, merged with main `365e1c9`), and then, at the owner's request, replaced the decorative covers with uploaded ones. The publication receipt in BUILD_STATUS.md records the pushed commit, the CI runs and whether it was merged. Merging into main needs the owner's approval.

### What is done

Cover images are implemented and verified locally (see BUILD_STATUS.md for exact counts): communities upload their own track and project covers, set a focal point and preview the crops, or a plain neutral panel shows; no text sits on a picture. Administrators set track covers, and a project's owner or an administrator sets its cover. Pictures are resized in the browser, verified on the pinned generation and served through an access-checked same-origin route, with a restrictive RLS policy in depth. Migration 0011 is additive and 0001 to 0010 are unchanged. The earlier decorative art and its contrast patch are gone, so the knowledge-check connected scan covers the whole page again.

### Run it

```sh
cd platform
npm ci
VITE_DATA_MODE=demo npm run dev   # fictional demo at http://127.0.0.1:5173
```

Every card starts with the plain panel. Use the account menu's Preview as admin, open Paths & learning, Course library, a track, then **Add a cover**; or open Projects, a project, then **Add a cover**. As a member, start a project to give your own project a cover. For PostgreSQL: `npm run db:migrate`, then `npm run db:grant-runtime`.

Checks from `platform/`: `npm run typecheck`, `npm test`, `npm run test:http`, `npm run build`, `npm run bundle:preview`, every `npm run test:browser:*` script including `covers` and `covers-connected`, and `npm run test:postgres` against a disposable loopback database named `reunir_ci`. From the repository root: `python3 -m unittest discover -s scripts -p "test_*.py"` and `python3 scripts/check_research.py`. Set `CHROMIUM_PATH` when Playwright's own browser is not installed.

### Product invariants for the next slice

People + Purpose + Progress + Projects + Proof. Keep drafts private and publication explicit, revision history and attempts immutable, tenant isolation and role checks current, private goals, messages and scores private. Pictures keep their own colours; the interface stays black, white and neutral grey, and nothing is written on a picture. Community review is not accreditation.

### Next recorded at the time

1. Owner review of PR #5 in the demo, then merge with the owner's approval and read back main.
2. Instructor-scoped authoring and review: let a track's instructor author and mark without community-wide administrator rights, with the same RLS depth.
3. A paginated review queue and a learner's export of their own attempts; an operator procedure for erasing a learner's answers and removed covers on request.
4. Deployment remains deferred by the user: Neon, Vercel, bucket, sender and scheduler are all unprovisioned.

---
## Historical Alpha 10 handover: knowledge checks

Read AGENTS.md, platform/docs/BUILD_STATUS.md, ASSESSMENTS.md, ROADMAP.md and research/notes/15_ASSESSMENTS.md first. UI_DESIGN_DIRECTION.md remains authoritative. Continue the existing React/Vite + Hono + Better Auth + PostgreSQL application; do not rebuild completed features.

### Where the source was

- Base: main `788e5d70df7083a07c6a254b315e7aa97965fd5a`, the merge of PR #3 (Alpha 09 private lesson resources), whose tree matches the tested PR head exactly. No other open pull requests existed when this slice started.
- This slice: branch `claude/stoic-euler-lx2zk7`, restarted from that main by fast-forward. The publication receipt in BUILD_STATUS.md records the pushed commit, the pull request, the CI runs and whether it was merged. Main `365e1c9` merges PR #4, and its tree is identical to the PR head `abbb51f` (read back 3 October 2026).
- Follow-up: branch `claude/laughing-goodall-2p7z0v` fixes the contrast of text on custom covers, returns the connected resources scan to the whole learner page and adds a custom cover check to the monochrome suite. It was built from main `788e5d7` and merged with main `365e1c9`; not yet merged into main. See "Follow-up: cover contrast" in BUILD_STATUS.md.

### What is done

Knowledge checks are implemented and verified locally (see BUILD_STATUS.md for exact counts): one optional quiz per lesson with single choice, multiple choice, short answer and written questions, authored in the private draft and released by publication; server-side scoring; answer keys withheld until the author's reveal rule allows; stale answers refused by fingerprint; immutable attempts with one review by an active owner or administrator who is not the learner; a review queue in Community studio; forced RLS and column-level grants in depth. Migration 0010 is additive and 0001 to 0009 are unchanged. A pre-existing bug that left `npm run dev` on a blank page is fixed and guarded by a test.

### Run it

```sh
cd platform
npm ci
VITE_DATA_MODE=demo npm run dev   # fictional demo at http://127.0.0.1:5173
```

As a member (the default), open Paths & learning, From idea to first version, then "Cut it down to the useful part" and answer the knowledge check; "Test before you celebrate" has a written question. Use the account menu's Preview as admin to open Community studio, Knowledge checks, where Sofia Chen's fictional answer waits for marks, and Creator studio to edit a check. For PostgreSQL: `npm run db:migrate`, then `npm run db:grant-runtime`.

Checks from `platform/`: `npm run typecheck`, `npm test`, `npm run test:http`, `npm run build`, `npm run bundle:preview`, every `npm run test:browser:*` script including `assessments` and `assessments-connected`, and `npm run test:postgres` against a disposable loopback database named `reunir_ci`. From the repository root: `python3 -m unittest discover -s scripts -p "test_*.py"` and `python3 scripts/check_research.py`. Set `CHROMIUM_PATH` when Playwright's own browser is not installed.

### Product invariants for the next slice

People + Purpose + Progress + Projects + Proof. Keep drafts private and publication explicit, revision history and attempts immutable, tenant isolation and role checks current, private goals, messages and scores private. Attempts, downloads and scores must not become engagement points, reputation or credentials. Community review is not accreditation.

### Next recorded at the time

1. Instructor-scoped authoring and review: let a track's instructor author and mark without community-wide administrator rights, with the same RLS depth.
2. A paginated review queue and a learner's export of their own attempts; an operator procedure for erasing a learner's answers on request.
3. Cover contrast: superseded by Alpha 11 cover images, which removed the decorative art; both open items there are resolved.
4. Deployment remains deferred by the user: Neon, Vercel, bucket, sender and scheduler are all unprovisioned.

---
## Historical Alpha 09 handover: private lesson resources

Read AGENTS.md, platform/docs/BUILD_STATUS.md, LESSON_RESOURCES.md, ROADMAP.md and research/notes/14_LESSON_RESOURCES.md first. UI_DESIGN_DIRECTION.md remains authoritative. Continue the existing React/Vite + Hono + Better Auth + PostgreSQL application; do not rebuild completed features.

### Where the source was

- Base: main `016c16e51212f9a71aff3f9b18b311d209194d9d` (Alpha 08 rich lessons merged through PR #2). No newer remote work existed when this session started. The 12 other remote branches are either already merged (`feat/creator-rich-lessons`, `integration/alpha07-source-2026-10-02`) or historical transport and dependency material; none was merged or changed.
- This slice: branch `claude/stoic-euler-lx2zk7`, [PR EmotiveImpact/REUNIR#3](https://github.com/EmotiveImpact/REUNIR/pull/3). Tested commit `16f3071d645f6bae54fd5c42716e562ccd72e186` passed GitHub Actions runs 37060579827 and 37060617081 (application and PostgreSQL 17). The receipt commit after it changes documentation and hashes only. Check the pull request for the merge commit, then continue from main.

### What is done

Private lesson resources are implemented and verified locally (see BUILD_STATUS.md for exact counts): ordered, named, described, replaceable and removable files that follow draft, preview, publication, capture and restore; verified uploads through the existing upload-intent API and Google Cloud Storage adapter; one download rule mirroring lesson, space, role and tenant access; restrictive RLS in depth; demo mode with browser-local bytes. Migration 0009 is additive, and 0001–0008 are unchanged.

### Run it

```sh
cd platform
npm ci
VITE_DATA_MODE=demo npm run dev   # fictional demo at http://127.0.0.1:5173
```

As admin (account menu, Preview as admin), open Paths & learning, From idea to first version, Creator studio, Choose one real problem, then Lesson files. As member, open the same lesson and download the sample worksheet. For PostgreSQL: apply migration 0009 with `npm run db:migrate`, then `npm run db:grant-runtime`.

Checks from `platform/`: `npm run typecheck`, `npm test`, `npm run test:http`, `npm run build`, `npm run bundle:preview`, every `npm run test:browser:*` script including `resources` and `resources-connected`, and `npm run test:postgres` against a disposable loopback database named `reunir_ci`. From the repository root: `python3 -m unittest discover -s scripts -p "test_*.py"` and `python3 scripts/check_research.py`. Set `CHROMIUM_PATH` when Playwright's own browser is not installed.

### Product invariants for the next slice

People + Purpose + Progress + Projects + Proof. Keep drafts private and publication explicit, revision history immutable, tenant isolation and role checks current, private goals and messages private. Downloads and attempts must not become engagement scores, reputation or credentials. Community review is not accreditation.

### Next

1. Assessments: quizzes, learner attempts, scoring and instructor feedback. Research Frappe Learning quizzes, ClassroomIO exercises and LearnHouse assignments at pinned commits first; extend the existing draft/publication/revision model and review conventions; additive migration 0010.
2. Queued follow-up: contrast of decorative cover text on newly created tracks (outside the resources slice).
3. Deployment remains deferred by the user: bucket, Neon, Vercel, sender and scheduler are all unprovisioned.

---
## Historical Alpha 08 handover: Creator Studio 2 rich lessons

Read AGENTS.md, platform/docs/BUILD_STATUS.md, RICH_LESSONS.md and ROADMAP.md. UI_DESIGN_DIRECTION.md remains authoritative. Continue the existing React/Vite + Hono + Better Auth + PostgreSQL app.

## Verified delivery

Published source commit: `24eeebfdc14aefed457bdd513f378b65d6fd9be8` on `feat/creator-rich-lessons`, PR #2. The remote tree was fetched and compared with the local source. GitHub [run 36969054997](https://github.com/EmotiveImpact/REUNIR/actions/runs/36969054997) passed both application and PostgreSQL jobs.

383 application/database/API/rendering tests; 204 demo-browser checks (including 11 new rich lesson checks); 12 connected-browser checks; 17 HTTP checks; 32 helper checks; TypeScript and both builds passed. PostgreSQL CI exercised restricted-role rich publication/restoration and tenant isolation. Desktop/mobile screenshots were reviewed. The adjacent-media insertion issue and the browser-context harness issue are fixed.

This receipt changes documentation and source hashes only. Merge status is tracked in [PR #2](https://github.com/EmotiveImpact/REUNIR/pull/2); clone main after merge, or the feature branch before merge. No cloud database, Vercel deployment, mail sender or scheduler has been provisioned. The user will deploy and run hosted tests later. Apply migration 0008 before running this version against PostgreSQL. Next product slice: private resources with lesson/space access inheritance, then assessments.

---
## Historical Alpha 07 handover

# START HERE: REUNIR Alpha 07, approved v4 integrated

## What the user wants

The approved v4 visual design belongs IN the existing React application, not in another standalone mock. Preserve all existing work, keep pushing coherent source waves, and report what remains. The user explicitly requested merging appropriate completed work. Do not merge incomplete transfer/archive branches or overwrite concurrent work to satisfy the word "everything".

## Exact source to continue

The complete application is now on GitHub in PR #1, branch `integration/alpha07-source-2026-10-02`. Publication commit `5e88b30675832fcedfb0a26491484851d951dd59` has the exact same tree as recovered Alpha 07 `76b31ab787029126e6462f747f7127a224212899`: `5b9d79453d07c75f5d71e0374889d945a3ee1eb8`. It was fetched back through Git and compared with no differences. Use the latest verified remote branch, or main after the PR is merged. Do not repeat the source recovery/import or return to a transport branch. Earlier local history remains in the saved Alpha 07 bundle; the publication snapshot is parented to GitHub's original main.

Restore the accompanying `REUNIR-Alpha-07.bundle` into a fresh worktree, or use a later remotely verified complete source branch. Read `RELEASE_METADATA.json` beside the bundle for the final commit and hashes, then verify SOURCE_MANIFEST.json. Do not assume an old temporary folder or node_modules symlink will exist in a new conversation.

Baseline preserved: `e834a1742e9b7f8c741ff362ba5a2584b3cdabf8` (Alpha 06 monochrome, 206 source-manifest entries), itself built on the complete Alpha 06 creator checkpoint `a09cd7db8f71462328b68a3c49b52dae4299dd97`. The first new integration checkpoint is `bb1dc52`. Current local branch: `integration/v4-application-2026-10-02`. Do not treat an earlier checkpoint in this paragraph as the final release commit.

## Read before editing

AGENTS.md; platform/docs/BUILD_STATUS.md; PRODUCT_DOCTRINE.md; PRD.md; ROADMAP.md; ARCHITECTURE.md; UI_DESIGN_DIRECTION.md; CREATOR_AUTHORING.md; RELEASE_GATES.md; research/reuse-register.json and the relevant research-to-build note. Earlier handover/status are under platform/docs/history, for provenance only.

## Approved design

Far-left workspace rail; navigation-only second sidebar with NO search or community switcher; one top-right account portrait/menu; natural photo avatars, not coloured initials; no duplicate account blocks in sidebars. Neutral chrome, fine borders, clean white/outline buttons, proper Lucide icons, Inter-first UI and a restrained editorial Home heading. Keep the approved mountain and quieter hierarchy. Do not revive coloured tiles, side stripes, glitter, generic dashboards or another visual exploration.

Actual shadcn Button/Avatar/Menu source is now incorporated and attributed, with Radix primitives and Tailwind utilities. Not every legacy form/dialog has been converted. Shared styling carries into the existing routes, which still invoke the original domain/data model. Demo portraits are only for explicit fictional fixture IDs; no invented face is assigned to a connected user.

## Product invariants

People + Purpose + Progress + Projects + Proof. Preserve Become/Build/Achieve, private goals/messages, tenant isolation, current role checks, existing lesson completion evidence, immutable draft/publication history, task proof and separate community-review outcomes. No force-feeding progress metadata into arbitrary posts. All seven migration files remain byte-identical. No AI, funding or credential expansion during this UI slice.

## GitHub and deployment

Before publication, all 11 remote branches and open PRs were checked. Main was the README-only `551d7a2da3914080956372beced5f01debc898a8`; the other branches contained dependency/transport material and no newer application. Those branches were preserved. PR #1 now contains the normal complete source tree.

The current workspace can fetch GitHub but has no direct Git write credential. The authenticated GitHub connection published all 240 tracked files, including nine binary assets; every binary blob and the final complete tree were hash-verified. A subsequent Git fetch, exact-tree diff and all 239 manifest entries passed. Local verification reran 369 application tests, 32 helper checks, TypeScript and the production build. This workspace denies sockets and could not download Playwright Chromium, so HTTP/browser/PostgreSQL verification runs in GitHub Actions. Consult BUILD_STATUS.md for the recorded CI result. Never infer deployment from a source push or bypass a failed release gate.

No live Neon/Vercel/email/bucket/scheduler or production database was changed. Complete the existing staging/receipt/hosted-session/privacy/restore gates separately.

## Verification and continuation

Read BUILD_STATUS.md and the current release evidence for completed results and limitations. Browser demos exercise actual bundled React against fictional local state, not a live API. Node HTTP checks use local PGlite and captured email. Tests updated the intentionally moved control selectors, not their business assertions. The historical Events journey fixes Date to its September fixture period; a new v4 test verifies an honest empty future calendar.

Run from platform: npm ci; npm run typecheck; npm test; npm run test:http; npm run build; npm run bundle:preview; npm run test:browser; npm run test:browser:operations; npm run test:browser:work; npm run test:browser:authoring; npm run test:browser:monochrome; npm run test:browser:v4. The real PostgreSQL and connected-browser scripts require their documented disposable environments. Run the Python provenance/design/publication checks from the repository root.

Full application and PostgreSQL CI passed on `75b3f2ba23261dda10032eb621220a3e0b670262` in [run 36964804738](https://github.com/EmotiveImpact/REUNIR/actions/runs/36964804738), including all 12 connected-browser journeys. The receipt commit only updates documentation and manifest hashes. Check PR #1 for merge status; once merged, continue from main with connected Code Black pilot gates, followed by Creator Studio 2 and private resources. Keep release status current and inspect current main/PRs before starting concurrent work. Do not reconstruct or redesign the application from this summary when the real source is on GitHub.
