# Alpha 13 cover library

3 October 2026. Application 0.13.0-alpha.1. Covers can come from a community cover library as well as an upload. Owners and administrators keep up to 24 named pictures in Community settings; anyone who may change a track or project cover chooses one in the cover dialogue, with its own focal point, without copying it. A picture stays in the library while any cover shows it. See COVERS.md and decisions/013-cover-library.md.

## Status at a glance

| Item | State |
| --- | --- |
| Implemented | Yes, on `claude/laughing-goodall-2p7z0v` ([PR EmotiveImpact/REUNIR#5](https://github.com/EmotiveImpact/REUNIR/pull/5)), after Alpha 11 and Alpha 12 on the same branch |
| Verified locally | Yes: every suite, from a clean worktree of tested commit `208e9be` after `npm ci` (see below) |
| Verified remotely (GitHub Actions) | See the publication receipt below |
| Merged | No. Merging into main needs the owner's approval |
| Deployed | No. No Neon database, Vercel project, bucket, sender or scheduler was created |
| Operated with real members | No |

## What changed

- Migration `0013_cover_library.sql` (additive): library uploads (`purpose='cover_library'`, no track or project, a generation once ready, at most 3 MB); a `cover_library` table with forced RLS (read in the tenant; inserted only by an active owner or administrator in their own name; deleted only by them; each upload listed once; foreign keys to the upload and the adding member); and a restrictive `cover_library_read` policy that keeps unlisted library uploads with their active uploader and active owners and administrators. Migrations 0001 to 0012 are byte-identical. `npm run db:grant-runtime` grants the table without UPDATE.
- Command `cover.library.add`; upload purpose `cover_library` under `organisations/{organisation}/covers/library/`; `GET /api/organisations/:slug/cover-library/:itemId` serves the verified bytes with the cover headers; `POST .../cover-library/:itemId/remove` deletes the row, the upload record and the stored object, and answers 409 `COVER_IN_USE` while any cover shows the picture. Choosing a library picture for a cover uses the existing `track.cover.set` and `project.cover.set` commands and rights.
- The cover dialogue offers **Upload your own** or **Community library** whenever the library holds a picture; pictures are native radio buttons named after their pictures. Community settings gains a Cover library section for owners and administrators: add a named picture, see how many covers use each, remove unused ones.
- The demo library seeds one picture, Mountain ridge: the bundled landscape cropped to 440 × 288 so its caption does not show.
- The connected cover suite now runs the live API under the restricted runtime role with forced RLS, as the instructor suite does.
- No new runtime dependency. Release constant and package version are 0.13.0-alpha.1.

## Local verification, 3 October 2026

Node 22.22.0, npm 10.9.4, `npm ci` from the committed lockfile in a clean worktree of tested commit `208e9be`, Playwright with Chromium 141 at `/opt/pw-browsers/chromium` through `CHROMIUM_PATH`, PostgreSQL 16.14 in a disposable loopback cluster (CI uses PostgreSQL 17).

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm test` | 529 passed, 0 failed (507 existing plus 11 domain, 6 database and 5 HTTP library tests) |
| `npm run test:http` | 17 passed |
| `npm run build`, `npm run bundle:preview` | Passed (existing chunk-size advisory on the single-file preview only) |
| Existing demo-browser suites | 247 passed: 85 regression, 17 operations, 29 project work, 27 authoring, 11 rich lessons, 19 resources, 14 knowledge checks, 9 instructors, 16 monochrome (its settings check now includes the library section), 20 v4 |
| `npm run test:browser:covers` | 16 passed (11 existing plus 5 for the library): adding a named picture in Community settings through an accessible dialogue; choosing a library picture by pointer and by keyboard, with its own focal point; a picture in use stays until its covers change, then is removed; an instructor choosing one for their own track; members seeing library covers with no controls |
| Existing connected-browser suites | 35 passed: 12 connected, 9 resources, 8 knowledge checks, 6 instructors |
| `npm run test:browser:covers-connected` | 13 passed (9 existing plus 4 for the library), now with the API under the restricted runtime role and forced RLS: the owner's picture reaches the bucket under the community key without photo metadata; a member chooses it for their own project; members cannot add pictures and other communities and visitors cannot read them; removal waits until nothing shows the picture and then deletes the stored object |
| `npm run test:postgres` | 12 passed on PostgreSQL 16.14, including the new restricted-role library check |
| Python helpers, `scripts/check_research.py` | 34 passed; the register validates with 42 pinned sources and 15 decisions at the documentation commit (35 and 14 at the tested commit, before the Alpha 13 review was recorded) |

Tests changed rather than added: seven migration-count assertions moved from 12 to 13; the lesson file pruning test now expects the seeded library picture and so also checks that pruning leaves it alone; the old-schema fixture skips the new table; the connected cover suite's API moved from the owner connection to the restricted runtime role. No business assertion was weakened.

## Corrections made while verifying

- The bundled landscape photograph carries a caption ("DISCIPLINE TODAY. A BRI…") along its bottom rows, and a cover must carry no words. The demo library uses a copy cropped above it; the original stays where the purpose page uses it. A unit test ties the seeded size, type and dimensions to the real file and checks it has no camera metadata.
- In the Add a library picture dialogue the name hint sat inside the label, which made the field's accessible name a whole sentence. The hint is now attached with `aria-describedby`.
- A new test expected a rejected library upload to survive until an hour had passed; the code prunes rejected uploads at the next start, as it does for covers, and the test now says so.
- Before the library checks were trusted, the restrictive policy was dropped in a throwaway database to confirm a member could then see an unlisted upload, so the test fails when the policy is missing.

## Not verified, and why

- Hosted behaviour on Neon and Vercel, a real bucket's signing, IAM and CORS, email and backups remain deferred by the user.
- Library pictures, like covers, are served at one size.
- In connected development against the seeded database, the seeded library picture has no stored object, so it shows the plain panel, as the seeded lesson worksheet cannot be downloaded there.

## Preview

The demo runs inside this workspace with `VITE_DATA_MODE=demo npm run dev` at `http://127.0.0.1:5173`, reachable only from inside the container. Use the account menu's **Preview as admin**, then **Community settings → Cover library** to add or remove a picture; open a track and choose **Add a cover → Community library** to pick one. Clone the branch and run `npm ci && npm run dev` from `platform/`.

## Publication receipt

Pending: the push, the remote read-back and the GitHub Actions runs are recorded here after they happen.

## Next actions

1. Owner review of PR #5 (Alpha 11, 12 and 13) in the demo; merge only with the owner's approval, then read back main.
2. A paginated review queue and a learner's export of their own attempts.
3. An operator erasure procedure covering a learner's answers and removed covers.
4. When deployment resumes: Neon staging with thirteen migrations and runtime grants, Vercel live mode, bucket setup (SETUP.md section 6), then hosted privacy tests.

---
## Historical Alpha 12 evidence: track instructors

3 October 2026. Application 0.12.0-alpha.1. Owners and administrators name instructors for a track; an instructor authors that track's lessons, files, knowledge checks and cover, and marks its knowledge checks, from a teaching page, without community-wide administrator rights. Being shown as a track's author grants nothing. See INSTRUCTORS.md and decisions/012-track-instructors.md.

## Status at a glance

| Item | State |
| --- | --- |
| Implemented | Yes, on `claude/laughing-goodall-2p7z0v` ([PR EmotiveImpact/REUNIR#5](https://github.com/EmotiveImpact/REUNIR/pull/5)), after Alpha 11 cover images on the same branch |
| Verified locally | Yes: every suite, from a clean worktree of tested commit `75e89f6` after `npm ci` (see below) |
| Verified remotely (GitHub Actions) | Yes: both jobs passed on `a941245` in the push and pull request runs (publication receipt below) |
| Merged | No. Merging into main needs the owner's approval |
| Deployed | No. No Neon database, Vercel project, bucket, sender or scheduler was created |
| Operated with real members | No |

## What changed

- Migration `0012_track_instructors.sql` (additive): a `track_instructors` table with forced RLS (read in the tenant; inserted only by an active owner or administrator in their own name; deleted only by them), instructor policies on lesson drafts, revisions and knowledge-check attempts, and the restrictive lesson file read policy recreated to admit instructors of the file's own track. Migrations 0001 to 0011 are byte-identical. `npm run db:grant-runtime` grants the table without UPDATE.
- Commands `track.instructor.add` and `track.instructor.remove`, administrator-only. One domain rule, `teaches`, decides drafts, history, lesson files, answer keys, attempts, reviews and the track cover; other tracks stay invisible to an instructor; suspension ends access at once. The repository now refuses to change rows that have no mutable properties in place.
- A Teaching page (sidebar link for instructors who are not administrators) with their tracks and review queue; Creator studio, cover and file tools on their own tracks; an Instructors dialogue for administrators; Preview as instructor in the demo (Idris Cole on the product track). The review queue now lists only attempts on tracks the reviewer teaches and never their own.
- No new runtime dependency. Release constant and package version are 0.12.0-alpha.1.

## Local verification, 3 October 2026

Node 22.22.0, npm 10.9.4, Playwright with Chromium 141 at `/opt/pw-browsers/chromium` through `CHROMIUM_PATH`, PostgreSQL 16.14 in a disposable loopback cluster (CI uses PostgreSQL 17). Run in this workspace on the source of feature commit `974fa36`; `75e89f6` only changes the version number.

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm test` | 507 passed, 0 failed (486 existing plus 9 domain, 8 database and 4 HTTP instructor tests) |
| `npm run test:browser:instructors` (new) | 9 passed: no teaching tools for members, the instructor's teaching page, feedback on a waiting answer, a lesson written and published on their own track, no tools on another track, the administrators' Instructors dialogue, the review on record, axe scans and no overflow at 390px |
| `npm run test:browser:instructors-connected` (new) | 6 passed: live build and Better Auth sessions with the API under the restricted runtime role and forced RLS; grant from the live track page, teaching page, review in the instructor's name, publishing on their track, refusals, revocation |
| `npm run test:postgres` | 11 passed, including the new restricted-role instructor check |
| Python helpers, `scripts/check_research.py` | 34 passed; 35 pinned sources, 14 decisions |

The full run from a clean worktree of `75e89f6`, after `npm ci` from the committed lockfile, finished after that commit and passed all 24 steps: the research checker, typecheck, `npm test` (507), `npm run test:http` (17), both builds, 258 demo-browser checks (85 regression, 17 operations, 29 project work, 27 authoring, 11 rich lessons, 19 resources, 14 knowledge checks, 11 covers, 9 instructors, 16 monochrome, 20 v4), 44 connected-browser checks (12 connected, 9 resources, 8 knowledge checks, 9 covers, 6 instructors) and 34 Python helpers.

Tests changed rather than added: six migration-count assertions moved from 11 to 12, the old-schema fixture skips the new table, and the knowledge-check notification test now expects the seeded product-track instructor to be told as well as the owner, on their teaching page. No business assertion was weakened.

## Corrections made while verifying

- The repository writes ordinary rows with an upsert, which needs UPDATE; grants deliberately have none. Grants are now append-only rows, and changing any row without mutable properties in place raises an error instead of silently upserting.
- The teaching page's track cover and the dialogue's portraits stretched because a child selector also matched them. Each text block now has its own class.

## Not verified, and why

- Hosted behaviour on Neon and Vercel, real sessions over the internet, email and backups remain deferred by the user.
- Instructors receive notifications in the application only; no email is sent for a grant.

## Preview

The demo runs inside this workspace with `VITE_DATA_MODE=demo npm run dev` at `http://127.0.0.1:5173`, reachable only from inside the container. Use the account menu's **Preview as instructor** to see the teaching page, or **Preview as admin** and **Instructors** on a track to add or remove one. Clone the branch and run `npm ci && npm run dev` from `platform/`.

## Publication receipt

Pushed to `claude/laughing-goodall-2p7z0v` ([PR EmotiveImpact/REUNIR#5](https://github.com/EmotiveImpact/REUNIR/pull/5)). The remote ref was fetched back and matched the local commit and tree: head `a94124599ef821836618f56cc0d41547010db6f7` (tree `1c128d48ac69b2661ac0f8c52313b22003158eed`), which is tested commit `75e89f6` plus documentation and the source manifest.

Both jobs passed on that head in [run 37096048793](https://github.com/EmotiveImpact/REUNIR/actions/runs/37096048793) (push) and [run 37096051607](https://github.com/EmotiveImpact/REUNIR/actions/runs/37096051607) (pull request). The application job ran the research checker, typecheck, all application tests, 17 HTTP checks, both builds, every demo-browser suite including instructors, every connected-browser suite including instructors, and the Python helpers; the PostgreSQL 17 job ran the 11 restricted-role checks, including instructors.

This receipt commit changes only documentation and source hashes. Merging into main needs the owner's approval.

## Next actions

1. Owner review of PR #5 (Alpha 11 and Alpha 12) in the demo; merge only with the owner's approval, then read back main.
2. A paginated review queue and a learner's export of their own attempts.
3. An operator erasure procedure covering a learner's answers and removed covers.
4. When deployment resumes: Neon staging with twelve migrations and runtime grants, Vercel live mode, bucket setup (SETUP.md section 6), then hosted privacy tests.

---
## Historical Alpha 11 evidence: cover images

3 October 2026. Application 0.11.0-alpha.1. Communities upload their own track and project covers, or a plain neutral panel shows. The generated cover art and every word written on it are retired; titles stay below pictures. Administrators set track covers; a project's owner or an administrator sets its cover. See COVERS.md and decisions/011-cover-images.md.

## Status at a glance

| Item | State |
| --- | --- |
| Implemented | Yes, on `claude/laughing-goodall-2p7z0v` ([PR EmotiveImpact/REUNIR#5](https://github.com/EmotiveImpact/REUNIR/pull/5)), built from main `788e5d7` and merged with main `365e1c9` |
| Verified locally | Yes, every suite below, in this cloud workspace, from a clean worktree of the tested commit |
| Verified remotely (GitHub Actions) | See the publication receipt below |
| Merged | No. Merging into main needs the owner's approval |
| Deployed | No. No Neon database, Vercel project, bucket, sender or scheduler was created |
| Operated with real members | No |

## What changed

- Migration `0011_cover_images.sql` (additive): a nullable, size-bounded `cover_image` object on tracks and projects; `upload_intents` accepts the `cover_image` purpose with `cover_track_id` or `cover_project_id` (exactly one, foreign keys to the tenant's track or project), a generation once ready and at most 3 MB; and a restrictive `cover_image_read` row policy. Migrations 0001 to 0010 are byte-identical.
- Uploads reuse the verified private pipeline: subject-bound intents, five-minute signed POST policies for an exact key, type and size, and completion that checks size, type, signature and declared dimensions (16 to 4,096 pixels) on the pinned generation, deleting refused objects. Commands `track.cover.set` and `project.cover.set` set, refocus or remove a cover. `GET /api/organisations/:slug/covers/:kind/:subjectId/:fileId` serves bytes after checking access, with private caching, `nosniff` and a sandboxing content security policy.
- The web `Cover` component shows the picture with its focal point as the object position, or the plain panel, on every card, detail page, feed post, profile and home list. The cover dialogue resizes pictures in the browser to 1,600 pixels (dropping metadata such as location), sets the focal point by click, drag or keyboard sliders, previews three crops and saves or removes.
- The decorative shapes, labels, art variants and the earlier `.art-custom` contrast patch are removed from the stylesheets. The project post in the feed now links to the project it names, not always to Common Ground.
- No new runtime dependency. Release constant and package version are 0.11.0-alpha.1.

## Local verification, 3 October 2026

Node 22.22.0, npm 10.9.4, `npm ci` from the committed lockfile in a clean worktree of tested commit `f62d5134c30f2e6c9cd37d4729aa7c1a7419041b`, Playwright with Chromium 141 at `/opt/pw-browsers/chromium` through `CHROMIUM_PATH`, PostgreSQL 16.14 in a disposable loopback cluster (CI uses PostgreSQL 17).

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm test` | 486 passed, 0 failed (466 existing plus 9 domain, 5 database and 6 HTTP cover tests) |
| `npm run test:http` | 17 passed |
| `npm run build`, `npm run bundle:preview` | Passed (existing chunk-size advisory on the single-file preview only) |
| Existing demo-browser suites | 238 passed: 85 regression, 17 operations, 29 project work, 27 authoring, 11 rich lessons, 19 resources, 14 knowledge checks, 16 monochrome, 20 v4 |
| `npm run test:browser:covers` (new) | 11 passed: plain panels, member permissions, labelled dialogue with keyboard focus return, focal point by click and keyboard, metadata removed, 1,600-pixel resizing, PNG transparency kept, focus-only change, unreadable file refused, project owner journey, axe scans and no overflow at 390px |
| Existing connected-browser suites | 29 passed: 12 connected, 9 resources, 8 knowledge checks (whole-page axe scan) |
| `npm run test:browser:covers-connected` (new) | 9 passed: live build, Better Auth sessions, PGlite, stand-in bucket on a second origin; real Chrome JPEG output verified by the server, no cookies or metadata reaching storage, headers, other tenants and visitors refused, unpublished track hidden, removal |
| `npm run test:postgres` | 10 passed, including the new restricted-role cover check (run on the same source before the commit that only changes the version number) |
| Python helpers, `scripts/check_research.py` | 34 passed; 30 pinned sources, 13 decisions |

Negative control: with `cover_image_read` dropped inside a rolled-back transaction, a member's restricted-role transaction saw 1 unused cover upload instead of 0.

Tests changed rather than added: the old-schema fixture skips the new property, five migration-count assertions moved from 10 to 11, the project-work upgrade test from 0005 asserts the new `cover_image` column is null before comparing rows, the 0009 upgrade test also strips the two new upload columns, the monochrome check for text on custom covers now checks the plain panel on a new track, and the knowledge-check connected axe scan is no longer limited to `.lesson-content`. No business assertion was weakened.

## Corrections made while verifying

- The cover dialogue first rendered inside the page heading, so heading paragraph styles reached into it. It now renders at the document root.
- The slider values used `<output>`, which is a live region, so each step would have been announced twice. They are hidden text now; the sliders announce their own values.
- A failed capability request made the dialogue say storage was not configured. It now says availability could not be checked.
- In the demo, the note about browser-only storage appeared twice after saving. It appears once.

## Not verified, and why

- Real Google Cloud Storage signing, IAM and bucket CORS for cover uploads, as for lesson files; hosted behaviour is deferred by the user.
- Photos straight from phones: HEIC decoding on Safari, EXIF rotation and very large images on low-memory devices. The checks use desktop Chromium with JPEG and PNG.
- Removed pictures are pruned only by a later cover upload in the same community, after an hour; there is no operator erasure procedure yet. A browser can show a cached cover for up to an hour after access ends.
- One 1,600-pixel file serves every size, including small thumbnails; smaller renditions are a follow-up.

## Preview

The demo runs inside this workspace with `VITE_DATA_MODE=demo npm run dev` at `http://127.0.0.1:5173`, reachable only from inside the container. Use the account menu's Preview as admin, open a track or project and choose **Add a cover**. This environment does not publish a public preview URL. Clone the branch and run `npm ci && npm run dev` from `platform/`.

## Publication receipt

Pushed to `claude/laughing-goodall-2p7z0v` ([PR EmotiveImpact/REUNIR#5](https://github.com/EmotiveImpact/REUNIR/pull/5)). The remote ref was fetched back and matched the local commit and tree: head `108f0cebabfa0328812a883ca5b328accc2680d8` (tree `a551ccc8efbcdfabd840f17dfe2faffcef08c36a`), which is tested commit `f62d513` plus documentation and the source manifest.

Both jobs passed on that head in [run 37094420188](https://github.com/EmotiveImpact/REUNIR/actions/runs/37094420188) (push) and [run 37094422988](https://github.com/EmotiveImpact/REUNIR/actions/runs/37094422988) (pull request). The application job ran the research checker, typecheck, all application tests, 17 HTTP checks, both builds, every demo-browser suite including covers, every connected-browser suite including covers, and the Python helpers; the PostgreSQL 17 job ran the 10 restricted-role checks, including covers. The automated Codex review ran when the pull request was opened, on `8d87020`, and reported no findings; later pushes do not trigger it.

This receipt commit changes only documentation and source hashes. Merging into main needs the owner's approval.

## Next actions

1. Owner review of PR #5 in the demo; merge only with the owner's approval, then read back main.
2. Instructor-scoped authoring and review permissions, a paginated review queue and a learner export of their own attempts.
3. An operator erasure procedure covering removed covers and a learner's attempts.
4. When deployment resumes: Neon staging with eleven migrations and runtime grants, Vercel live mode, bucket setup (SETUP.md section 6), then hosted privacy tests.

---
## Historical Alpha 10 evidence: knowledge checks

2 October 2026. Application 0.10.0-alpha.1. Creators add an optional knowledge check to a lesson in the private draft; learners answer it and the server scores it; owners and administrators mark written answers and send feedback. Scores are private feedback, not reputation, completion or credentials. See ASSESSMENTS.md and decisions/010-knowledge-checks.md.

## Status at a glance

| Item | State |
| --- | --- |
| Implemented | Yes, on `claude/stoic-euler-lx2zk7`, restarted from main `788e5d7` after PR #3 merged |
| Verified locally | Yes, every suite below, in this cloud workspace |
| Verified remotely (GitHub Actions) | See the publication receipt below |
| Merged | Yes: main `365e1c9` merges PR #4, and its tree is identical to `abbb51f` (read back 3 October 2026) |
| Follow-up | Cover contrast on `claude/laughing-goodall-2p7z0v`, not yet merged; see "Follow-up: cover contrast" |
| Deployed | No. No Neon database, Vercel project, bucket, sender or scheduler was created |
| Operated with real members | No |

## What changed

- Migration `0010_assessments.sql` (additive): a nullable `quiz` object on lessons, drafts and revisions, and a `quiz_attempts` table with forced RLS, constraints that tie status to review fields and forbid self-review, and a uniqueness rule per learner, lesson and attempt number. `npm run db:grant-runtime` revokes UPDATE and DELETE on attempts and grants UPDATE only on the review columns. Migrations 0001 to 0009 are byte-identical.
- Commands `quiz.attempt.submit` and `quiz.attempt.review` on the existing commands route; `lesson.draft.save` carries the quiz. Answer keys are stripped for non-authors; stale answers are refused by fingerprint.
- Creator Studio gains a knowledge-check editor and preview; lessons gain the learner check; Community studio gains a Knowledge checks review tab reached from the notification.
- The fictional Code Black demo has two checks and one attempt waiting for review.
- Fixed a pre-existing bug: `npm run dev` rendered a blank page ("Cannot access 'lazy' before initialization") because `lib/context.tsx` declared a lazy page above its React import, which Vite's development server rewrites in place. Builds and the preview bundle were unaffected, so no browser check had caught it. `tests/web-modules.test.ts` now guards module order.
- No new runtime dependency. Release constant and package version are 0.10.0-alpha.1.

## Local verification, 2 October 2026

Environment as for Alpha 09: Node 22.22.0, npm 10.9.4, `npm ci` from the committed lockfile, Playwright Chromium at `/opt/pw-browsers/chromium` through `CHROMIUM_PATH`, PostgreSQL 16.14 in a disposable loopback cluster (CI uses PostgreSQL 17).

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm test` | 466 passed, 0 failed (425 existing plus 20 domain, 8 database, 6 HTTP, 6 rendering and 1 module-order test) |
| `npm run test:http` | 17 passed |
| `npm run build`, `npm run bundle:preview` | Passed (existing chunk-size advisory on the single-file preview only) |
| Existing demo-browser suites | 223 passed: 85 regression, 17 operations, 29 project work, 27 authoring, 11 rich lessons, 19 resources, 15 monochrome, 20 v4 |
| `npm run test:browser:assessments` (new) | 14 passed: creator, learner and reviewer journey, axe scans, neutral-colour checks, overflow at 390px and 360px |
| Existing connected-browser suites | 21 passed: 12 connected, 9 resources |
| `npm run test:browser:assessments-connected` (new) | 8 passed: live build, Better Auth sessions, PGlite, owner review and a concurrent edit refused then re-answered |
| `npm run test:postgres` | 9 passed, including the new restricted-role knowledge-check check |
| Python helpers, `scripts/check_research.py` | 32 passed; 22 pinned sources, 12 decisions |
| `VITE_DATA_MODE=demo npm run dev` | Renders in Chromium after the module-order fix; learner, reviewer and studio screens inspected |

Tests changed rather than added: the old-schema fixture skips the new collection and column (its documented rule), four migration-count assertions moved from 9 to 10, the 0008 and 0009 upgrade tests also strip the new nullable column, and one enrolment assertion now counts the acting member's own enrolments, because the seed adds a fictional enrolment for Sofia Chen. No business assertion was weakened.

## Corrections made while verifying

- Global form styles stretched radio buttons and checkboxes to full width, hiding the option text fields in the studio editor. Choice inputs now keep their natural size.
- A blank choice question reported "Each option needs different text" alongside "Give every option some text". Duplicate checks now consider only filled-in options.
- Database assertions written with `rowCount` were vacuous because the SQL wrapper does not expose it. They now use `RETURNING` counts, and a rolled-back positive control proves the same statement succeeds for an active owner.
- The automated Codex review on PR #4 found that the `attempt_review` row policy still matched attempts that were already reviewed, so SQL bypassing the domain could rewrite a finished review. Migration 0010 (not yet merged or applied anywhere outside test databases) now requires an unreviewed row before the update and a reviewed row at version 2 after, and inserts must start at version 1. New database and PostgreSQL assertions failed before the change and pass after it.

## Not verified, and why

- Hosted behaviour on Neon and Vercel, real sessions over the internet, email and backups remain deferred by the user.
- Very large review queues: attempts load with the bounded workspace snapshot; pagination is a follow-up.

## Preview

The demo runs inside this workspace with `VITE_DATA_MODE=demo npm run dev` at `http://127.0.0.1:5173`, reachable only from inside the container. This environment does not publish a public preview URL. Clone the branch (or main after merge) and run `npm ci && npm run dev` from `platform/`.

## Publication receipt

Pushed to `claude/stoic-euler-lx2zk7` and opened as [EmotiveImpact/REUNIR#4](https://github.com/EmotiveImpact/REUNIR/pull/4). After each push the remote ref was fetched back and matched the local commit and tree.

- First head `51dd503bccd18935a8935c692da0a8a4b5d919cc` (tree `df74f75c3b7f8d77c1c4af462092921f671b2c78`) passed both jobs in [run 37066181651](https://github.com/EmotiveImpact/REUNIR/actions/runs/37066181651) (push) and [run 37066222452](https://github.com/EmotiveImpact/REUNIR/actions/runs/37066222452) (pull request).
- The automated Codex review then found the review-policy gap described under corrections. The fix, `ea40ab917433382f3a40b48c57a7fcbe3e26e986` (tree `001f2a3e74a01b7a09115099edd71a648a7e0604`), passed both jobs in [run 37067079371](https://github.com/EmotiveImpact/REUNIR/actions/runs/37067079371) (push) and [run 37067083907](https://github.com/EmotiveImpact/REUNIR/actions/runs/37067083907) (pull request). The application job ran the research checker, typecheck, all application tests, 17 HTTP checks, both builds, every demo-browser suite including knowledge checks, every connected-browser suite including knowledge checks, and the Python helpers; the PostgreSQL 17 job ran the 9 restricted-role checks. The review thread was answered and resolved.

This receipt commit changes only documentation and source hashes; the merge into main is recorded in the pull request and in the next status update.

## Next actions

1. Done: merged as main `365e1c9`. Next, merge the cover contrast follow-up on `claude/laughing-goodall-2p7z0v`, then read back main.
2. Instructor-scoped authoring and review permissions, a paginated review queue and a learner export of their own attempts.
3. When deployment resumes: Neon staging with ten migrations and runtime grants, Vercel live mode, bucket setup (SETUP.md section 6), then hosted privacy tests.

## Follow-up: cover contrast

Superseded by Alpha 11 above: the decorative cover art, including the custom cover patched here, was removed and replaced by uploaded covers and a plain panel. Both items listed as still open below are resolved there. The record is kept as history.

Branch `claude/laughing-goodall-2p7z0v`, built from main `788e5d7` and merged with main `365e1c9`. It resolves the decorative cover finding recorded under Alpha 09.

Tracks and projects created in the app get the `custom` cover. It has no art rule of its own, so it uses the default translucent shapes, and these cross the text on narrow covers, above all the track detail cover (285px wide above 1080px, 190px at or below, hidden at 760px and below). axe measured the 6px footer at 4.25:1 (`#ececec` on `#6f6f6f`) at every detail width, and the 9px label too at 1080px and below. axe approximates the rotated shape by its bounding box, so the rendered pixels behind the glyphs were also sampled: the footer fell to 3.44:1, the label to 2.77:1 and the large title to 2.77:1, where large text needs 3:1. Seeded tracks use named covers, which is why the demo suites passed.

- `styles.css`, `.art-custom` only: white lettering; the label and footer sit on the cover's own ground (`#5d5d5d`) with a 3px knockout and 2px radius, and the label hugs its text so the knockout stays local. Named covers and layout are unchanged. Neutral colours only, with no gradient and no recolouring of images.
- `resources-connected-check.ts`: the axe scan is no longer limited to `.lesson-content`, and the check is renamed "the connected learner page with files passes automated accessibility checks".
- `monochrome-browser-check.ts`: a new check creates a track through the real form, then runs the neutral colour check and full-page axe scans on its page at 1512px and 1000px.

Before the merge with main, tested commit `43bdf4a` passed every local suite in a clean worktree (425 application tests, 224 demo-browser and 21 connected-browser checks, 32 helper tests), both negative controls (the full-page scans fail on `.cover-foot > span:nth-child(2)` at 4.25:1 with main's `styles.css`) and GitHub Actions [run 37062824183](https://github.com/EmotiveImpact/REUNIR/actions/runs/37062824183). A scratch contrast sweep of every cover type at 35 widths from 360px to 1640px found 63 failing text samples and 51 axe violation nodes on custom covers before the change and none after; named covers measured identically.

Still open: `assessments-connected-check.ts`, added in Alpha 10, limits its axe scan to `.lesson-content` for the same reason, and the seeded `notes` cover pairs `#eaeaea` with `#8c8c8c` at 2.79:1, so full-page scans of the demo `/projects` page and of that project fail.

---
## Historical Alpha 09 evidence: private lesson resources

2 October 2026. Application 0.9.0-alpha.1. Creators attach ordered, named and described files to lesson drafts, replace and remove them, preview them privately and release them by explicit publication. Learners download files only while they can open the lesson. See LESSON_RESOURCES.md and decisions/009-private-lesson-resources.md.

## Status at a glance

| Item | State |
| --- | --- |
| Implemented | Yes, on `claude/stoic-euler-lx2zk7`, built from main `016c16e` |
| Verified locally | Yes, every suite below, in this cloud workspace |
| Verified remotely (GitHub Actions) | Yes: runs 37060579827 (push) and 37060617081 (pull request) passed on `16f3071` |
| Deployed | No. No bucket, Neon database, Vercel project, sender or scheduler was created |
| Operated with real members | No |

## What changed

- Migration `0009_lesson_resources.sql` (additive): upload intents gain purpose, track scope, completion time and verified generation; lessons, drafts and revisions gain a nullable `resources` list; a restrictive RLS policy limits lesson files to active authors or published references. Migrations 0001–0008 are byte-identical.
- The existing upload-intent routes accept `purpose: 'lesson_resource'`; completion checks size, type and file signature at a pinned generation; new routes serve signed downloads for lessons, drafts and revisions; `discard` deletes unreferenced uploads. The member-private upload flow is unchanged, apart from returning 409 instead of 500 when completion is called before the object exists.
- Creator Studio gains a file editor (add, name, describe, reorder, replace, remove, re-attach, discard); preview, learner lessons and revision history list files with downloads.
- The fictional demo keeps file bytes in the browser and attaches a generated sample PDF to "Choose one real problem".
- No new runtime dependency. Release constant and package version are 0.9.0-alpha.1 (the API constant had remained at 0.7.0 through Alpha 08).

## Local verification, 2 October 2026

Environment: Node 22.22.0, npm 10.9.4, `npm ci` from the committed lockfile, Playwright Chromium 1194 preinstalled at `/opt/pw-browsers/chromium` (used through `CHROMIUM_PATH`), PostgreSQL 16.14 in a disposable loopback cluster (CI uses PostgreSQL 17). Unlike the earlier workspace, loopback sockets and the tsx CLI work here, so the HTTP, connected-browser and PostgreSQL gates ran locally too.

| Check | Result |
| --- | --- |
| Baseline on main `016c16e` before changes | 383 tests, 17 HTTP, 204 demo-browser, 12 connected-browser, 7 PostgreSQL, 32 helpers, typecheck and both builds: all passed |
| `npm run typecheck` | Passed |
| `npm test` | 425 passed, 0 failed (383 existing plus 22 domain, 7 database and 13 HTTP/adapter tests for resources) |
| `npm run test:http` | 17 passed |
| `npm run build`, `npm run bundle:preview` | Passed (existing chunk-size advisory on the single-file preview only) |
| Existing demo-browser suites | 204 passed: 85 regression, 17 operations, 29 project work, 27 authoring, 11 rich lessons, 15 monochrome, 20 v4 |
| `npm run test:browser:resources` (new) | 19 passed, including real downloaded bytes, axe scans at desktop and 390px, overflow at 360/390px |
| `npm run test:browser:connected` | 12 passed |
| `npm run test:browser:resources-connected` (new) | 9 passed: live build, Better Auth sessions, PGlite, stand-in bucket on a second origin |
| `npm run test:postgres` | 8 passed, including the new restricted-role resource check |
| Python helpers, `scripts/check_research.py` | 32 passed; 18 pinned sources, 11 decisions |

Tests changed rather than added: the old-schema fixture now skips the new collection and column (its documented rule), three migration-count assertions moved from 8 to 9, the 0008 upgrade test also strips the new nullable column, and the HTTP storage double gained the two new adapter methods. No business assertion was weakened.

## Corrections made while verifying

- The database run showed that restricted-role RLS already hides a pending file from members, returning 404 before the role check. The domain now checks the author role first, so members get the same clear 403 in every mode.
- An object overwritten between the metadata read and the pinned signature read surfaced as a 500. It now returns a retryable 409 `UPLOAD_CHANGED` and leaves the intent pending.
- The connected harness navigated to the same hash URL without reloading, so the learner saw a cached workspace. The harness now reloads. Live mode refreshes every 30 seconds in normal use.
- A full-page axe scan of a newly created connected track flagged 6px decorative cover text at 4.25:1. The cover is `aria-hidden` and outside this slice, so the connected scan covers the lesson article, and the cover fix is queued as a separate task. The demo learner page with files passes a full-page scan. Resolved by the cover contrast follow-up above.

## Not verified, and why

- Real Google Cloud Storage: signing is tested with the real SDK and a throwaway key offline; uploads and downloads use stand-ins. IAM, bucket CORS and real downloads need a configured bucket.
- Hosted behaviour on Neon and Vercel, real email and backups remain deferred by the user.
- No malware scanning or deep Office-file inspection exists.

## Preview

The demo runs inside this workspace with `VITE_DATA_MODE=demo npm run dev` at `http://127.0.0.1:5173`, which is reachable only from inside the container. This environment does not publish a public preview URL. Clone the branch (or main after merge) and run `npm ci && npm run dev` from `platform/`.

## Publication receipt

Pushed to `claude/stoic-euler-lx2zk7` at `16f3071d645f6bae54fd5c42716e562ccd72e186` (tree `7e33b8a84e25092123a89c2857cb14ef86670919`). The remote ref was fetched back and matched the local commit and tree exactly. Pull request: [EmotiveImpact/REUNIR#3](https://github.com/EmotiveImpact/REUNIR/pull/3).

GitHub Actions passed every job on that commit: [run 37060579827](https://github.com/EmotiveImpact/REUNIR/actions/runs/37060579827) (push) and [run 37060617081](https://github.com/EmotiveImpact/REUNIR/actions/runs/37060617081) (pull request), each with the application job (typecheck, all application tests, 17 HTTP checks, both builds, 223 demo-browser checks, 21 connected-browser checks, 32 helper tests, research checker) and the PostgreSQL 17 job (8 checks, including the restricted-role resource check). This receipt commit changes only documentation and source hashes; the merge into main is recorded in the pull request and in the next status update.

**Merged.** The receipt commit `a6d4adb8edce9a1eec652a25fe2f944575cadad4` passed both jobs again in [run 37061204163](https://github.com/EmotiveImpact/REUNIR/actions/runs/37061204163) (push) and [run 37061210244](https://github.com/EmotiveImpact/REUNIR/actions/runs/37061210244) (pull request). PR #3 was then merged with a merge commit: main is `788e5d70df7083a07c6a254b315e7aa97965fd5a` (parents `016c16e` and `a6d4adb`). Main was fetched back; its tree `ae626acb8109f8afd65d01c05a3d8ced1a78c4f9` is identical to the tested PR head's tree.

## Next actions recorded at the time

1. Merge this slice once GitHub Actions passes, then read back main (done; see above).
2. Build assessments (done in Alpha 10).
3. When deployment resumes: configure the private bucket (SETUP.md section 6), verify real signed uploads and downloads, then add scanning and an orphaned-object sweep.

---
## Historical Alpha 08 evidence: rich lesson authoring

2 October 2026. Actual Creator Studio rich editing, safe external media, private preview/publication and compatible rich/plain revisions. See RICH_LESSONS.md.

## Verified delivery

Published source commit: `24eeebfdc14aefed457bdd513f378b65d6fd9be8` on `feat/creator-rich-lessons`, PR #2. The remote tree was fetched and compared with the local source. GitHub [run 36969054997](https://github.com/EmotiveImpact/REUNIR/actions/runs/36969054997) passed both application and PostgreSQL jobs.

383 application/database/API/rendering tests; 204 demo-browser checks (including 11 new rich lesson checks); 12 connected-browser checks; 17 HTTP checks; 32 helper checks; TypeScript and both builds passed. PostgreSQL CI exercised restricted-role rich publication/restoration and tenant isolation. Desktop/mobile screenshots were reviewed. The adjacent-media insertion issue and the browser-context harness issue are fixed.

PR #2 was merged into main as `016c16e51212f9a71aff3f9b18b311d209194d9d`. This receipt changed documentation and source hashes only. Merge history: [PR #2](https://github.com/EmotiveImpact/REUNIR/pull/2); clone main after merge, or the feature branch before merge. No cloud database, Vercel deployment, mail sender or scheduler has been provisioned. The user will deploy and run hosted tests later. Apply migration 0008 before running this version against PostgreSQL. Next product slice: private resources with lesson/space access inheritance, then assessments.

---
## Historical Alpha 07 evidence

# REUNIR Alpha 07: approved v4 integrated into the application

2 October 2026. Application 0.7.0-alpha.1, PRD 0.8. Local engineering release. The user-approved design is implemented in the existing React application, not just the reference HTML.

## Delivered

The app now has the v4 two-level community/navigation shell; no search or community switcher in the second sidebar; one top-right account portrait/menu; no duplicate bottom account controls; natural demo portrait images with safe neutral fallbacks; Lucide icons, neutral surfaces, restrained borders and white/outline controls. Home preserves the editorial heading and photographic hero, but its progress, goals, projects, activity and outputs come from the existing authorised workspace. Past fixture events are not presented as upcoming.

Three actual shadcn registry-source adaptations are included: Button, Avatar and Dropdown Menu, with full MIT attribution, pinned Radix primitives, class-variance-authority and Tailwind utilities through Vite. Unused upstream subcomponents are not imported. Existing native-dialog forms remain; there is no claim that every control in the legacy application has been converted to shadcn.

The previous community, learning, mission proof, purposes/paths/private goals, project workboards/contribution review, outcomes/outputs, messaging, access management and Creator Studio routes remain. The seven SQL migrations are byte-identical to the Alpha 06 baseline. The shared release label changes, but API/domain authorisation and data semantics are unchanged. No new backend service is introduced.

## Publication follow-up: 2 October 2026

The full application was published in [PR #1](https://github.com/EmotiveImpact/REUNIR/pull/1), branch `integration/alpha07-source-2026-10-02`, at `5e88b30675832fcedfb0a26491484851d951dd59`. Its complete Git tree `5b9d79453d07c75f5d71e0374889d945a3ee1eb8` exactly matches recovered checkpoint `76b31ab787029126e6462f747f7127a224212899`. All 240 tracked files are present, including nine binary image assets. A Git fetch followed by a tree diff and 239-file manifest verification passed. No newer application or open PR was found among the earlier remote branches.

Fresh local verification: 369 application tests, 32 Python helper checks, TypeScript and production build passed. The tests used `node --import tsx --test --test-concurrency=1 tests/*.test.ts` because this workspace disallows the optional tsx CLI IPC socket. The test files and assertions were unchanged. HTTP/browser/PostgreSQL checks run in GitHub Actions because local sockets are denied and the Playwright browser download failed.

The first full remote run [36964413876](https://github.com/EmotiveImpact/REUNIR/actions/runs/36964413876) passed all 369 application tests, 17 HTTP checks, both builds, all 193 demo-browser checks and the six real PostgreSQL checks. Connected browser verification passed four checks before an exact accessible-name lookup failed on the new-password field. Its helper text was being included in the field's name. The follow-up gives the field an explicit label and links the password guidance as its accessible description, retaining both the visible design and the exact-name test. Both signup and reset now also assert the description. No authentication rules or migrations were changed.

The complete [follow-up CI run 36964804738](https://github.com/EmotiveImpact/REUNIR/actions/runs/36964804738) passed on `75b3f2ba23261dda10032eb621220a3e0b670262`: 369 application tests, 17 HTTP checks, 193 demo-browser checks, all 12 connected-browser checks, 32 Python helper checks, six real PostgreSQL checks, TypeScript and both builds. Both required jobs succeeded. The connected journey now verifies real HTTP sign-in, invitation account creation, message persistence, password recovery/reset and used-invitation rejection, with captured email and a disposable local database. This does not establish external email delivery or hosted Neon/Vercel behaviour.

The documentation receipt following that tested commit changes no application, test, dependency or migration files. Current merge status and final checks are linked from [PR #1](https://github.com/EmotiveImpact/REUNIR/pull/1). The initial failed run is retained as evidence rather than counted as a complete pass.

No deployment, real sender or scheduler has been configured in this publication work. Connected pilot gates remain separate from the repository integration.

## Completed verification in the saved Alpha 07 release

| Check | Result |
| --- | --- |
| Full domain/database/API suite | 369 passed, 0 failed/skipped/cancelled |
| Existing community browser journey | 24 passed |
| Existing purpose/progress browser journey | 34 passed |
| Existing messages/access browser journey | 27 passed |
| Existing pilot-operations browser journey | 17 passed |
| Existing project-work browser journey | 29 passed |
| Existing creator-authoring browser journey | 27 passed |
| Existing monochrome browser journey | 15 passed |
| New v4 integration browser journey | 20 passed |
| Total completed fictional demo-browser checks | 193 |
| Actual local Node HTTP integration | 17 passed |
| Publication/research/design helper checks | 32 passed |
| Strict TypeScript, deployment build, standalone preview | Passed |
| Research register | 9 pinned sources, 9 linked decisions |

The new browser checks cover mounted shadcn primitives, two-level navigation, one account menu, photo loading, genuine evidenced progress, creation/search/profile actions, authorised management, mobile switching, keyboard menu/drawer focus and Escape, empty future calendar, no overflow at 360/390/640/768/999/1000/1200px and no uncaught JavaScript exceptions. Automated accessibility scans passed on the tested Home, account-menu and mobile drawer states, as well as retained feature states. This is not an accessibility certification.

## Corrections made while verifying

Historical browser selectors were updated to the intentionally moved account/search controls; functional authorisation and data-mutation assertions were retained. The original Events fixture dates are now in the past, so the historical event journey fixes Date to 24 September 2026. A separate current-design check confirms that the real Home shows an honest empty calendar once fixtures are past. The application itself does not freeze time.

Avatar accessibility semantics were corrected by labelling the image role instead of an anonymous span. The account menu uses Radix's supported non-modal mode: its actions are a menu, not a dialog that hides the rest of the page. The initial menu scan found focusable content in an aria-hidden app shell; the final menu/drawer scans pass without suppressing that rule.

One parallel operational browser run reported a browser target crash at its mobile accessibility scan. Its partial checks are not counted. The complete operational suite was rerun alone and passed all 17; the interrupted log is retained separately.

## Verification boundaries and historical blockers in the saved release

The demo-browser tests run the actual compiled React against fictional local state. HTTP tests run the real Node/Hono/Better Auth path with local PGlite and captured mail. They are not Neon pooling/concurrency, production email receipt, public hosting or backup/restore proof.

The connected-browser test was attempted and was blocked at navigation to the loopback HTTP server with ERR_BLOCKED_BY_ADMINISTRATOR, before its first check. The policy was not disabled or bypassed. That attempt is recorded separately, not included in 193 or 17. A disposable real-PostgreSQL CI job exists, but it has not run in this pass.

At the saved-release checkpoint, only dependency-resolution workflows had run remotely and source publication was blocked by DNS. The publication follow-up above supersedes that source-delivery blocker and records current remote verification; the older test evidence remains provenance for the recovered build.

No live Neon database, Vercel deployment, Google bucket, production sender or scheduler was changed. The package is a source/preview release, not a hosted pilot.

## Distribution and remaining work

Read RELEASE_METADATA.json alongside the source ZIP/bundle for the final commit, exact manifest count and recovery verification. The updated roadmap, entire product doctrine, design direction, research register and handover are included. Dependencies, private environment files, databases and font binaries are excluded.

The split deployment build remains under the default large-chunk threshold (largest JS chunk approximately 347 kB before gzip). The intentionally single-file offline preview retains a size advisory, and existing dependency annotation warnings remain. Neither build is a performance benchmark or dependency security audit.

After PR #1 is merged, the next gate is to operate the intended invitation-only Code Black staging pilot with verified accounts, email, privacy and restore. Next product work: richer lesson authoring/private resources, scalable paginated reads, notification preferences and account/trust operations. Commercial billing and the longer-term contribution/mentorship/AI vision remain in ROADMAP.md, not falsely marked complete.
