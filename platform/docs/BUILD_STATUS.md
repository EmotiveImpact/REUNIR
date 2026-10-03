# Alpha 28 collections of useful content

3 October 2026. Release 0.28.0-alpha.1; the package version stays at 0.39.0-alpha.1 because Alpha 31 and Alpha 39 reached main first. Owners, administrators and moderators gather useful posts, tracks, lessons, paths, projects, events, missions and community outputs into collections with notes and a chosen order; one published collection can be featured on Home. See decisions/028-curated-collections.md and CURATION.md.

## Status at a glance

| Item | State |
| --- | --- |
| Implemented | Yes, on `claude/everyday-use-4z9rmz`, from main `f9f32d6` (the merge of PR #22, Alpha 27), with main `b80fc04` (Alpha 31 data retention), main `16b2768` (Alpha 23 virus scanning of uploads) and main `0a818fa` (Alpha 39 cover library) merged in |
| Verified locally | Yes: the full suite on base `b24095a`, and the checks below on top of Alpha 27 and main `fab9510` |
| Verified remotely (GitHub Actions) | Recorded on the pull request once its runs finish |
| Merged | Not yet. The owner approved merging each feature into main once its checks pass (3 October 2026) |
| Deployed | No. Nothing was provisioned |
| Operated with real members | No |

## PR #22 merged into main

Alpha 27 was merged into main on 3 October 2026 as `f9f32d6`, a merge commit whose parents are main `fab9510` (PR #20, Alpha 25) and the tested head `297dab8`; its tree is identical to the tested head's tree. CI runs 37127344409 and 37127347035 (application and postgres) passed on `297dab8`.

## What changed

- `packages/contracts/src/collections.ts`, `packages/domain/src/collections.ts`: eight item kinds, curator checks, visibility filtering (run last, after every other filter) and eight commands through the existing command pipeline.
- Additive migration 0028: `collections` and `collection_items` with composite tenant keys, forced row security, drafts readable only by curators, writes only by an active curator in their own name, one featured collection per community, and runtime updates limited to wording, status, feature flag and editor (collections) and order and note (items). Run `npm run db:grant-runtime` after migrating.
- Web: Collections page and detail with management for curators, a compact featured block on Home, global search includes collections. The existing private Saved page is unchanged and now browser-checked.
- Demo: fictional "Start here" (published, featured, with one item from a private space members never see) and a draft by Maya Bennett.
- Migrations 0001 to 0023 and 0030 are byte-identical; migration counts come from the migrations directory. No new dependency.

## Local verification, 3 October 2026

On base `b24095a` (by the building agent): typecheck, builds, `npm test` 644 passed, `test:http` 19, every demo suite including the new `test:browser:curation` (9), every connected suite (60), `test:postgres` 21 on PostgreSQL 16, Python helpers 35 and the research register.

On this branch, on top of Alpha 27 and main `fab9510`: typecheck, build and bundle passed; `npm test` 697 passed, 0 failed (after main `fab9510`); `test:postgres` passed on a fresh PostgreSQL 16 loopback cluster with no leftover `reunir_*` roles; `curation` 9, `groups` 11, `states` 12, `v4` 20 and `monochrome` 16 passed.

## Review fix

The Codex review of PR #25 found that a mission on an unpublished track was offered to curators as live, although members lose it with the track. Missions now follow their track's publication like lessons do; `tests/collections.test.ts` refuses adding such a mission (failed before the fix, passes after). `npm test` 697 passed and `curation` 9 passed after the fix.

After merging main `b80fc04` (Alpha 31 data retention): typecheck, build and bundle passed; `npm test` 702 passed, 0 failed; `test:postgres` 23 passed on a fresh PostgreSQL 16 cluster; `curation` 9, `v4` 20 and `monochrome` 16 passed.

After merging main `16b2768` (Alpha 23 virus scanning of uploads): typecheck and build passed; `npm test` 715 passed, 0 failed; `curation` 9, `v4` 20 and `monochrome` 16 passed.

After merging main `0a818fa` (Alpha 39 cover library management): the collections upgrade test now leaves library pictures and uploads out of its pre-0038 seed, as main's own upgrade tests do. Typecheck, build and bundle passed; `npm test` 741 passed, 0 failed; `curation` 9, `covers` 20, `v4` 20 and `monochrome` 16 passed.

## Not verified, and why

- PostgreSQL 17 runs in CI only. No hosted deployment.
- Browsers with older saved demo data see no seeded collections until the demo is restarted; their data upgrades to empty collections.

## Next actions

1. Drive the pull request green and merge with the owner's standing approval; read back main.
2. Task files with live updates (Alpha 29) and shared form components (Alpha 30).

## Historical evidence: Alpha 39 cover library management and small copies of covers

3 October 2026. Application 0.39.0-alpha.1. Administrators rename and tag cover library pictures, the library holds up to 60, the cover picker can be filtered, and cards and lists load a small copy of each cover instead of the full picture. See decisions/039-cover-library-management-and-small-copies.md and COVERS.md.

## Status at a glance

| Item | State |
| --- | --- |
| Implemented | Yes, on `claude/build-out-tvzn40` ([PR #21](https://github.com/EmotiveImpact/REUNIR/pull/21)), first opened on main `f5ec8d3` and brought up to main `16b2768` (the merge of PR #16, Alpha 23) |
| Verified locally | Yes: every suite (see below) |
| Verified remotely (GitHub Actions) | Recorded on the pull request once its runs finish |
| Merged | Not yet. The owner approved merging each feature into main once its checks pass (3 October 2026) |
| Deployed | No. No Neon database, Vercel project, bucket, mail sender or scheduler was created |
| Operated with real members | No |

## Other releases merged into main while this slice was open

Six other threads' releases reached main while this slice was open. Alpha 24 (group conversations) was merged as `d62424dc5b68cf9386757173a89464211f5b7021` on top of `f5ec8d3`, its tree `85e91e8022d87830336918d8765392698795b48d` identical to its tested head `5c97bb4` (CI runs 37123762116 and 37123778756). Alpha 26 (email confirmation and change) was then merged as `9b34cac`, its tree `2e61a0a1ea8f287c3fe3e8dc6a2f455f57a7e3b5` identical to its tested head `a427140` (CI runs 37124821464 and 37124825018). Alpha 25 (contributor roles for teaching, migration 0023) was merged as `fab9510`, its tree `b07530cedae56e6c312e45318a4797e395889069` identical to its tested head `518bc06` (CI runs 37126085213 and 37126087981); it also replaced the fixed migration counts in upgrade tests with a count of the migration files. Alpha 27 (loading, error and empty screens, no migration) was merged as `f9f32d6`, its tree `e9981087152749e62cb402b8f5d3eb0150030215` identical to its tested head `297dab8` (CI runs 37127344409 and 37127347035). Alpha 31 (data retention rules, migration 0030) was merged as `b80fc04`, its tree `3ab0d17291ed1aea25d4d25c5052c458c4cdf65c` identical to its tested head `5635bde` (CI runs 37128602184 and 37128604626). Alpha 23 (virus scanning of uploads, no migration) was merged as `16b2768`, its tree `10e737770f6d871a42842a8fccd6962668c45abe` identical to its tested head `3359707` (CI runs 37139393314 and 37139400276). This slice merged all six in. When a scanner is configured, the small copy of a cover is scanned too, and a flagged copy is deleted while the picture is kept.

Numbering: Parallel threads now take numbers from agreed blocks, and this one holds Alpha 39 to 40, migrations 0038 to 0039 and decisions 039 to 040, so this release is Alpha 39 with migration 0038 and decision 039. It was first opened as Alpha 23, then renumbered to Alpha 27 before the blocks were agreed; gaps in the sequence on main are expected.

## What changed

- **Library management.** `POST /api/organisations/:slug/cover-library/:itemId/details` renames a picture and sets up to five tags (lower case, 1 to 24 characters, letters and numbers with single spaces or hyphens; too many or too long are refused, never cut). It requires two-step sign-in when the server does, and each change is audited as `cover.library.updated`. Community settings has an Edit dialogue; the cover picker has **Find a picture** and a toggle per tag.
- **Limit raised from 24 to 60**, enforced by the domain on every library upload.
- **Small copies.** When the browser prepares a picture wider than 480 pixels it also draws a 480-pixel copy (WebP, or JPEG where WebP cannot be written), at most 256 KB, uploaded under a second five-minute policy tied to the same upload record. On completion the server checks the copy's signature, size, type and dimensions from its own stored generation; a failed copy is deleted and dropped while the picture is kept. New `/thumbnail` routes serve the copy, or the full picture when there is none, so existing covers keep working. Every deletion path removes both files.
- **Additive migration 0038** adds `cover_library.tags` with a shape check, an update policy for active owners and administrators, and four checked small-copy columns on `upload_intents`. The runtime role may update only `label` and `tags` on `cover_library`; run `npm run db:grant-runtime` after migrating.
- Migrations 0001 to 0022 are byte-identical; no new runtime dependency. Release constant and package version are 0.39.0-alpha.1.

## Local verification, 3 October 2026

Node 22.22.0, npm 10.9.4, Playwright with Chromium at `/opt/pw-browsers/chromium` through `CHROMIUM_PATH`, PostgreSQL 16 in a disposable loopback cluster (CI uses PostgreSQL 17). The full run below, every step including the new states suite, ran on this branch's tree on top of main `16b2768`. An earlier full run on top of main `9b34cac`, before the renumbering to Alpha 39, also passed.

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm test` | 722 passed, 0 failed (696 on main `16b2768` plus 26: 6 library management, 6 small copies, 6 database tests under the restricted role including cross-tenant and inactive-role refusals, 7 HTTP, 1 scanning of small copies) |
| `npm run test:http` | 19 passed (unchanged) |
| `npm run build`, `npm run bundle:preview` | Passed (existing chunk-size advisory on the single-file preview only) |
| Demo-browser suites | 312 passed: 85 regression, 17 operations, 29 project work, 27 authoring, 11 rich lessons, 19 resources, 16 assessments, 20 covers (3 new), 11 instructors, 13 accounts, 16 monochrome, 20 v4, 5 notifications, 11 groups, 12 states |
| Connected-browser suites | 64 passed: 12 connected, 9 resources, 9 assessments, 15 covers (2 new), 6 instructors, 13 accounts |
| `npm run test:postgres` | 23 passed on PostgreSQL 16 (1 new for renaming and tagging through the restricted role; the existing library case now checks that changing the picture itself is refused) |
| Python helpers, `scripts/check_research.py` | 35 passed; the register validates with 55 pinned sources and 18 register decisions |

Tests changed rather than added: upgrade tests count the migration files (from PR #20), and the 0038 upgrade test starts from a database at 0022; the 0009, 0011 and 0013 upgrade tests strip the four new upload columns and assert they are empty; the operator-erasure test seeds its 0013-era database without uploads or library pictures; the library grant test also asserts the two updatable columns; the two-step sign-in HTTP test lists the new route among those that refuse.

## Corrections made while verifying

- The local disposable PostgreSQL cluster had stopped before the PostgreSQL step; it was restarted and the suite passed unchanged.

## Not verified, and why

- Real Google Cloud Storage signing and bucket CORS for the second upload policy were not exercised; no bucket was created, by the owner's instruction.
- WebP encoding was exercised only in Chromium; the JPEG fallback for other browsers is untested. Existing covers get no small copy until they are replaced.

## Next actions

1. Drive the pull request green and merge with the owner's standing approval; read back main.
2. When deployment resumes: follow LAUNCH_RUNBOOK.md, and run `npm run db:grant-runtime` after migrating.

## Historical Alpha 23 evidence: virus scanning of uploads

3 October 2026. Application version stays 0.31.0-alpha.1: Alpha 23 was allocated before it was built and reaches main after Alpha 31. When a ClamAV scanner is configured, every upload is scanned before it can be used; flagged files are deleted and uploads wait while the scanner is unavailable. Required by default in production. See decisions/023-upload-scanning.md, SECURITY.md and SETUP.md section 6.

## Status at a glance

| Item | State |
| --- | --- |
| Implemented | Yes, on `claude/upload-scanning-1p9o9m`, from main `b24095a` (PR #14, Alpha 21), with main merged in at `ec4285d` (Alpha 22) and `b80fc04` (PR #23, Alpha 31, which brought Alpha 24 to 27) |
| Verified locally | Yes: typecheck, `npm test`, `npm run test:http`, build, preview bundle, Python helpers and the research register (see below) |
| Verified remotely (GitHub Actions) | Yes: runs 37139393314 and 37139400276 on `3359707` (application and postgres) |
| Merged | Yes: [PR #16](https://github.com/EmotiveImpact/REUNIR/pull/16), merged into main as `16b2768` |
| Deployed | No. No clamd, bucket, database or other service was created |
| Operated with real members | No |

## What changed

- **`apps/api/src/scanner.ts`** speaks clamd's `INSTREAM` protocol over TCP with `node:net`: length-prefixed chunks, a zero-length end, and a strict reading of `stream: OK` or `stream: <signature> FOUND`. Anything else, a timeout (30 seconds) or a refused connection is `ScannerUnavailable`, never clean. No new runtime dependency.
- **Upload completion** reads the whole object once at the generation just measured, scans it, and uses the same bytes for the signature and dimension checks. Lesson files, track and project covers, library pictures and member attachments are all covered.
- **Flagged** files become `rejected`, are deleted and return 422 `FILE_FLAGGED`; the log records the request ID and signature name only. **No verdict** returns 503 `SCAN_UNAVAILABLE` and leaves the upload pending with its object kept, so completing again succeeds later.
- **A rejected member attachment** now returns 409 `FILE_REJECTED` if completion is tried again, so a second upload under the same policy cannot be marked ready unscanned.
- **Configuration:** `CLAMAV_HOST`, `CLAMAV_PORT` (default 3310) and `UPLOAD_SCANNING` (`required` or `optional`, required by default in production). A new `upload-scanning` pilot check blocks start-up when scanning is required, a bucket is set and no scanner is configured, or when the setting or port is invalid. `/api/account/capabilities` reports `uploadScanning`.
- **`npm run scan:check`** pings a configured clamd and checks a harmless sample and the EICAR test file. It is not run in CI because no clamd is provisioned.
- **Launch kit:** `npm run launch:preflight` fails a production environment with a bucket and no `CLAMAV_HOST` (unless `UPLOAD_SCANNING=optional`, which warns) or with an invalid setting or port, and never prints the host. LAUNCH_RUNBOOK.md section 6 adds running clamd on a private network beside the API, since Vercel functions cannot run it.
- No migration; every existing migration is byte-identical. The release constant, package version and research register stay at main's 0.31.0-alpha.1.

## Local verification, 3 October 2026

Node 22, npm 10, on this branch's tree after merging main `b80fc04`.

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm test` | 696 passed, 0 failed: main's tests plus 12 in `tests/scanner.test.ts` (reply parsing, the clamd client against a stand-in clamd on a real TCP socket, silent, erroring and closed scanners, the settings and pilot check, and HTTP completion for lesson files, covers and member attachments with a stand-in scanner) and 1 launch-preflight test |
| `npm run test:http` | 19 passed (unchanged) |
| `npm run build`, `npm run bundle:preview` | Passed (existing chunk-size advisory) |
| Python helpers, `scripts/check_research.py` | Passed; the register validates with 55 pinned sources and 18 register decisions |

Browser suites and `npm run test:postgres` were not rerun locally: no interface, migration or grant changed. CI runs both on the pull request.

## Not verified, and why

- No real clamd was run. The client is tested against a stand-in that speaks the same wire protocol; `npm run scan:check` is the first check to run against a real one.
- Files made ready before scanning was turned on are not rescanned, and stored files are not rescanned when signatures update.
- clamd's `StreamMaxLength` must be at least 10 MB; a lower limit makes uploads wait with `SCAN_UNAVAILABLE` rather than pass.

## Next actions

1. Drive the pull request green and merge with the owner's standing approval; read back main.
2. Group conversations (Alpha 24) continue in their own thread.
3. When deployment resumes: run clamd on a private network beside the API, set `CLAMAV_HOST`, and run `npm run scan:check`.

## Historical Alpha 31 evidence: data retention rules

3 October 2026. Application 0.31.0-alpha.1. Housekeeping records are cleared on a schedule by one list of rules, and Your account says how long everything is kept. What people make, reviewed evidence and the audit trail are never cleared by the job. See decisions/031-data-retention.md and RETENTION.md.

Numbering follows the project's allocation of 3 October 2026: this thread holds Alpha 31 to 34, decision records 031 to 034 and migrations 0030 to 0033, so data retention is Alpha 31, decision 031 and migration 0030 (first opened as Alpha 27 with migration 0023). Migration 0023 (contributor roles, Alpha 25) is on main and 0024 to 0029 belong to other threads, so a gap before 0030 is expected; the runner applies files in order and does not need consecutive numbers.

## Status at a glance

| Item | State |
| --- | --- |
| Implemented | Yes, on `claude/accounts-trust-zojuqs`, restarted from main `9b34cac` (the merge of PR #18, Alpha 26), with main `fab9510` (PR #20, Alpha 25 contributor roles, migration 0023) and main `f9f32d6` (PR #22, Alpha 27 loading, error and empty screens) merged in |
| Verified locally | Yes: every suite (see below) |
| Verified remotely (GitHub Actions) | Yes: runs 37128602184 and 37128604626 on `5635bde` (application and postgres) |
| Merged | Yes: [PR #23](https://github.com/EmotiveImpact/REUNIR/pull/23), merged into main as `b80fc04` |
| Deployed | No. No Neon database, Vercel project, bucket, mail sender or scheduler was created |
| Operated with real members | No |

## What changed

- **Rules** (`packages/contracts/src/retention.ts`): expired sessions, expired links and rate counters one day after expiry; request receipts 30 days; internal change events 90 days; sent and cancelled mail records 90 days; undelivered mail contents 30 days, the record 90; read notices 180 days. Unread notices and queued mail are never touched.
- **Job** (`packages/db/src/retention.ts`): records outside any community are cleared directly; each community's receipts, change events and read notices inside its own tenant context. A dry run does the same work and rolls it back, so its counts are exact. Each applied run is recorded as `retention-job` in service observations.
- **Running it**: `npm run retention:run` (dry run unless `RETENTION=apply`) and `GET /api/internal/retention` with the scheduler secret (applies; `?dry=1` counts). Nothing is scheduled.
- **Migration 0030** (additive): `email_outbox.failed_at`, `organisations_retention`, a read-only policy that lists communities only when the transaction sets `app.worker` to `retention`, and `notifications_read_idx`. 0001 to 0023 unchanged; no grant change.
- **How long things are kept** panel on Your account, from the same list. RETENTION.md, PILOT_OPERATIONS.md and SECURITY.md updated.
- Review fixes on PR #23: migration 0030 also adds `email_outbox.failed_at` (set by the mail worker; mail already failed starts its period at migration), and failed mail is counted from it; `npm run launch:preflight` and LAUNCH_RUNBOOK.md now require `CRON_SECRET` even without mail, and list the retention route; against the blank `.env.example` the preflight now reports 6 failures and 5 warnings.
- Upgrade tests count the migration files (`tests/helpers/migrations.ts`, from Alpha 25), so no count changed.

## Local verification, 3 October 2026

Node 22.22.0, npm 10.9.4, Playwright with Chromium at `/opt/pw-browsers/chromium` through `CHROMIUM_PATH`, PostgreSQL 16 on loopback.

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm test` | 671 passed, 0 failed after the review fixes; 683 passed, 0 failed after main's Alpha 25 and Alpha 27 were merged in (5 new in `tests/retention-database.test.ts`: one list of rules, the worker-only community listing, an exact dry run then a real run that clears only what the rules name, the scheduled route, and failed mail counted from its failure) |
| `npm run test:http` | 19 passed |
| `npm run build`, `npm run bundle:preview` | Passed |
| Demo-browser suites | `accounts` 13 (1 new: the retention panel, at phone width too), `monochrome` 16, `v4` 20 |
| Connected-browser suites | `accounts-connected` 13; `instructors` 11 after the Alpha 25 merge; `states` 12 after the Alpha 27 merge |
| `npm run test:postgres` | 23 passed on PostgreSQL 16 (1 new: the worker policy and a dry and real run through the restricted runtime role) |
| Python helpers | 35 passed; research register valid |

## Not verified, and why

- No scheduler runs the job: the operator chooses one when deploying. Hosted PostgreSQL was not exercised.
- The periods are the same for every community; per-community settings and a period for the audit trail need the owner's decision.

## Next actions

1. Drive the pull request green and merge with the owner's standing approval; read back main.
2. Appeals of moderation decisions, a correction and withdrawal history for reviewed evidence, and consented credit for several contributors, one pull request each.
3. When deployment resumes: schedule the retention job daily after a dry run on staging.

## Historical Alpha 27 evidence: loading, error and empty screens

3 October 2026. Application 0.27.0-alpha.1. Shared loading, error and empty states across the web app: shell-preserving loading outlines, route error boundaries with Try again, a Not found page, offline and failed-refresh notices, marked command failures and role-aware empty states. See decisions/027-loading-error-empty-states.md and STATES.md. Alpha 23 is claimed by another open pull request, and Alpha 24 to 26 are on main, so this slice takes the next free number.

## Status at a glance

| Item | State |
| --- | --- |
| Implemented | Yes, on `claude/everyday-use-4z9rmz`, from main `f5ec8d3` (the launch kit after Alpha 22), with main `fab9510` (Alpha 24 group conversations, Alpha 26 email confirmation and Alpha 25 contributor roles) merged in |
| Verified locally | Yes: the full suite on the original base `b24095a`, and the checks below again on top of `f5ec8d3` |
| Verified remotely (GitHub Actions) | Run 37124475400 (application and postgres) passed on `bc37d8c` before main moved; the merge with Alpha 24 is recorded on the pull request |
| Merged | Yes: [PR #22](https://github.com/EmotiveImpact/REUNIR/pull/22), merged into main as `f9f32d6` |
| Deployed | No. Nothing was provisioned |
| Operated with real members | No |

## What changed

- `apps/web/src/components/states.tsx` and `states.css`: `Loading`, `PageLoading`, `ShellLoading`, `ErrorState`, `InlineError`, `PageBoundary`, `NotFound` and `ConnectionNotice`; `apps/web/src/lib/errors.ts` sorts failures into offline, session ended, two-step sign-in required, no access, not found, outdated code or unknown.
- Routes sit inside a page error boundary and a skeleton fallback; unknown addresses show Not found. A failed background refresh keeps the page and shows a notice; failed commands, uploads and downloads show a marked error toast and keep what was typed. The existing `TWO_FACTOR_REQUIRED` notice is unchanged.
- Empty states tell first run apart from no results, and offer actions only to roles allowed to take them. "Show more" buttons set `aria-busy`.
- A demo-only fault page (`#/states/fault`) exists only in the fictional demo build, for the browser check.
- No migration, no grant change, no new dependency. Migrations 0001 to 0021 are byte-identical.

## Local verification, 3 October 2026

Node 22.22.0, Chromium at `/opt/pw-browsers/chromium-1194` through `CHROMIUM_PATH`, PostgreSQL 16 in a disposable loopback cluster.

On the original base `b24095a`:

| Check | Result |
| --- | --- |
| `npm run typecheck`, `npm run build`, `npm run bundle:preview` | Passed |
| `npm test` | 627 passed, 0 failed (2 new in `tests/states.test.ts`) |
| `npm run test:http` | 19 passed |
| Demo-browser suites | 294 passed: the 282 existing checks unchanged, plus 12 in the new `test:browser:states` |
| Connected-browser suites | 60 passed |
| `npm run test:postgres` | 20 passed |
| Python helpers, `scripts/check_research.py` | 35 passed; register validates |

After merging main `f5ec8d3` (Alpha 22 and the launch kit), on this branch: typecheck, build and bundle passed; `npm test` 641 passed, 0 failed; `test:browser:states` 12, `covers` 17, `monochrome` 16, `v4` 20 and `work` 29 passed; Python helpers and the research register passed. The merge kept Alpha 22's described covers on the project and track pages, where both sides had changed the same lines.

After merging main `d62424d` (Alpha 24 group conversations): typecheck, build and bundle passed; `npm test` 656 passed, 0 failed; `test:browser` 24 + 34 + 27, `groups` 11, `states` 12, `v4` 20 and `monochrome` 16 passed. In Messages, the group inbox keeps its search by group name and people, and gains the shared loading, error and empty states; the new-message picker list is named `candidates` so it does not clash with the group People dialogue.

After merging main `9b34cac` (Alpha 26 email confirmation, which took the number this slice first used, so this slice became Alpha 27 and decision 027): typecheck, build and bundle passed; `npm test` 668 passed, 0 failed; `states` 12, `accounts` 12, `v4` 20 and `monochrome` 16 passed.

After merging main `fab9510` (Alpha 25 contributor roles): typecheck, build and bundle passed; `npm test` 678 passed, 0 failed; `states` 12, `instructors` 11, `authoring` 27, `v4` 20 and `monochrome` 16 passed. The learning, authoring and teaching pages keep Alpha 25's changes with this slice's empty states applied on top.

## Not verified, and why

- Connected-mode offline, expired-session, failed-refresh and outdated-code screens were not exercised in a browser; their classification is unit-tested and they share components with the browser-checked demo screens.
- No pilot observations exist yet, so the states follow an audit of every route rather than what members actually hit.

## Next actions

1. Drive the pull request green and merge with the owner's standing approval; read back main.
2. Content curation, task files with live updates, and the shared form components follow as their own pull requests from the same thread.

## Historical Alpha 25 evidence: contributor roles for teaching

3 October 2026. Alpha 26 (PR #18) reached main first, so the application version stays 0.26.0-alpha.1. An owner or administrator adds someone to a track as an instructor or a contributor. Contributors write the track's lesson drafts and files; instructors publish them, and only instructors see and review learners' knowledge-check answers. See decisions/025-contributor-roles.md and INSTRUCTORS.md.

## Status at a glance

| Item | State |
| --- | --- |
| Implemented | Yes, on `claude/courses-teaching-6hum2q`, from main `ec4285d` (the merge of PR #15, Alpha 22), with main `f5ec8d3` (PR #17, the launch kit) main `d62424d` (PR #19, Alpha 24) and main `9b34cac` (PR #18, Alpha 26) merged in |
| Verified locally | Yes: every suite (see below) |
| Verified remotely (GitHub Actions) | Passed on `919b352` (run 37125616557) before main moved again; the merge with Alpha 26 is recorded on the pull request |
| Merged | Yes: [PR #20](https://github.com/EmotiveImpact/REUNIR/pull/20), merged into main as `fab9510` |
| Deployed | No. No Neon database, Vercel project, bucket, mail sender or scheduler was created |
| Operated with real members | No |

Alpha 23 (upload scanning, PR #16) was still open when this slice started, and Alpha 24 was reserved for group conversations, so this slice took the next unreserved number. Group conversations then merged with migration 0022, so this slice's migration became 0023. Email change (PR #18) then merged as Alpha 26 with no migration.

## What changed

- **Instructor or Contributor** when adding someone in a track's Instructors dialogue, and a role menu beside each person. Instructor is the default for the command, the API and every existing grant.
- Contributors open, save, preview and restore drafts, upload and attach lesson files, and see the track's drafts, history and upload records. Publishing, archiving, reordering, the cover and knowledge-check attempts need an instructor or administrator (`INSTRUCTOR_REQUIRED`, or the existing cover and reviewer refusals).
- Changing a role replaces the grant in the acting administrator's name; grants are still never updated in place.
- Additive migration `0023_contributor_roles.sql`: `track_instructors.role` (`instructor` or `contributor`, NOT NULL, default `instructor`), and role-aware replacements for the published-revision, attempt read, attempt review and invitation policies. 0001 to 0022 are byte-identical; no grant change.
- Database upgrade tests count the migration files (`tests/helpers/migrations.ts`) instead of a fixed number, so additive migrations from parallel slices no longer edit nine tests.
- The 0014 upgrade test now seeds without teaching grants, whose newer columns do not exist at 0013.

## Local verification, 3 October 2026

Node 22.22.0, npm 10.9.4, Playwright with Chromium at `/opt/pw-browsers/chromium` through `CHROMIUM_PATH`, PostgreSQL 16 in a disposable loopback cluster (CI uses PostgreSQL 17). The final run was on `5882bb6`, this branch with main `d62424d` (Alpha 24 group conversations) merged in.

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm test` | 664 passed, 0 failed (main's 654 plus 6 contributor domain and 4 contributor database tests) |
| `npm run test:http` | 19 passed (unchanged) |
| `npm run build`, `npm run bundle:preview` | Passed (existing chunk-size advisory on the single-file preview only) |
| Demo-browser suites | 271 passed across 15 suites, including 11 group conversation checks from main and 11 instructor checks (1 new: adding a contributor and changing their role) |
| Connected-browser suites | 60 passed (unchanged; the instructor suite follows the renamed controls) |
| `npm run test:postgres` | Passed on PostgreSQL 16 |
| Python helpers, `scripts/check_research.py` | 35 passed; the register validates |

## Corrections made while verifying

- Merging main brought group conversations in as migration 0022, so this slice's migration was renamed from 0022 to 0023 before it reached main. The upgrade test now starts from 0022.
- The first full `npm test` run failed one test, the 0014 upgrade, because it seeded the current fixture (with a teaching role) into a 0013 schema. The test now seeds without grants; the rerun passed.

## Not verified, and why

- Contributor invitations by email are not built: an invitation still makes an instructor, and the 0023 policy refuses any other role on acceptance.

## Next actions

1. Drive the pull request green and merge with the owner's standing approval; read back main.
2. Per-lesson grants, instructor-started tracks and uploaded lesson video, each its own release.
3. When deployment resumes: follow the launch runbook once it lands.

## Historical Alpha 26 evidence: confirming and changing your email address

3 October 2026. Application 0.26.0-alpha.1. People confirm their email address by a link, and accepting an invitation confirms it. When the server requires it, the production default, an unconfirmed address cannot sign in. Anyone can move their account to a new address with their password and a link sent there. See decisions/026-email-confirmation-and-change.md and ACCOUNTS.md.

Numbering: first opened as Alpha 24. Alpha 23 is claimed by open pull requests (#16, #21), Alpha 24 (group conversations, PR #19) reached main first, and Alpha 25 is on PR #20, so this release is Alpha 26 with decision 026. It has no migration.

## Status at a glance

| Item | State |
| --- | --- |
| Implemented | Yes, on `claude/accounts-trust-zojuqs`, from main `b24095a` with main `ec4285d` (PR #15, Alpha 22) `f5ec8d3` (PR #17, launch kit) and `d62424d` (PR #19, Alpha 24 group conversations) merged in |
| Verified locally | Yes: every suite (see below) |
| Verified remotely (GitHub Actions) | Yes: runs 37124825018 and 37124821464 (application and postgres) on `a427140` |
| Merged | Yes: [PR #18](https://github.com/EmotiveImpact/REUNIR/pull/18), merged into main as `9b34cac` |
| Deployed | No. No Neon database, Vercel project, bucket, mail sender or scheduler was created |
| Operated with real members | No |

## What changed

- **Email address** panel on Your account: the address, Confirmed or Not confirmed, **Send a confirmation link** and **Change email address…**. The demo panel only explains the feature.
- **`EMAIL_VERIFICATION`** is `required` or `optional`; unset means required in production. It applies only where mail can be sent; required without a sender blocks the pilot checklist but does not stop the server, and an invalid value stops it. When required, Better Auth refuses a session to an unconfirmed address with `EMAIL_NOT_VERIFIED` and queues a fresh link.
- **Invitations confirm the address** they were sent to when accepted.
- **`POST /api/account/email`** checks the password (five attempts in fifteen minutes), then Better Auth sends a confirmation link to the new address; the address changes only when it is opened. The current address gets a notice with the new address masked and no link. A taken address gets the same answer and no mail. Better Auth's own `/api/auth/change-email` answers 404.
- `/api/account/capabilities` adds `emailVerification`, `emailConfirmation` and `emailChange`; `/api/session` adds the person's own `email` and `emailVerified`.
- Review fixes on PR #18: changing or resetting the password cancels any change link asked for before it (the server refuses an older link and the address stays), and the password check no longer needs a session started within the last day, so days two to seven of a session can change the address, delete the account or hand over a community.
- `npm run launch:preflight` (from PR #17) now also checks `EMAIL_VERIFICATION`: an invalid value fails, `optional` warns. Against the blank `.env.example` it reports 5 failures and 6 warnings.
- No migration, no grant change, no new runtime dependency. Release constant and package version are 0.26.0-alpha.1.

## Local verification, 3 October 2026

Node 22.22.0, npm 10.9.4, Playwright with Chromium at `/opt/pw-browsers/chromium` through `CHROMIUM_PATH`. The full suite ran on this slice before main `ec4285d` was merged in; typecheck, unit tests, both builds, the HTTP checks and the accounts and covers browser suites ran again after the merge.

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm test` | 634 passed before the merge (625 plus 9 new in `tests/email-http.test.ts`, real Better Auth with the outbox captured); 636 of 636 after merging main at `ec4285d`; 666 of 666 after the review fixes (2 new) and merging main at `d62424d` (Alpha 24) |
| `npm run test:http` | 19 passed (unchanged) |
| `npm run build`, `npm run bundle:preview` | Passed (existing chunk-size advisory on the single-file preview only) |
| Demo-browser suites | `test:browser` 85, `v4` 20, `monochrome` 16, `accounts` 12 (1 new: the explanatory email panel), `covers` 17 after the merge, `accounts-connected` 13 |
| Connected-browser suites | `accounts-connected` 13 (2 new: confirming an address by its link, and changing it in a real browser) |
| `npm run test:postgres` | 21 passed on PostgreSQL 16 after merging main at `d62424d` |
| Python helpers | 35 passed |

## Not verified, and why

- No real mail was sent; links were read from the encrypted outbox. Hosted Better Auth and a real reverse proxy were not exercised.
- Opening a change link while signed out creates a session without the second step, as Better Auth does (decision 026).

## Next actions

1. Drive the pull request green and merge with the owner's standing approval; read back main.
2. The remaining account and trust items: data retention rules, appeals of moderation decisions, a correction and withdrawal history for reviewed evidence, and consented credit for several contributors.
3. When deployment resumes: set `EMAIL_VERIFICATION` with a verified sender.

## Historical Alpha 24 evidence: group conversations

3 October 2026. Application 0.24.0-alpha.1. Members start named group conversations of up to 20 people from Messages. People added later read only what is written after they join. See decisions/024-group-conversations.md.

## Status at a glance

| Item | State |
| --- | --- |
| Implemented | Yes, on `claude/group-conversations-5arqv6`, from main `b24095a` with main `f5ec8d3` (PR #15 Alpha 22 and PR #17 launch kit) merged in |
| Verified locally | Yes: every suite on the merged tree (see below) |
| Verified remotely (GitHub Actions) | Yes, on PR #19 before it merged |
| Merged | Yes: [PR #19](https://github.com/EmotiveImpact/REUNIR/pull/19), merged into main as `d62424d` |
| Deployed | No. No Neon database, Vercel project, bucket, mail sender or scheduler was created |
| Operated with real members | No |

## PR #17 merged into main

The launch kit was merged into main on 3 October 2026 as `f5ec8d3ebd1f937990ef8139657af3e718cf1301`, a merge commit whose parents are the previous main `ec4285d` (PR #15, Alpha 22) and the tested head `8e2fdfc`; its tree, `47a92acd740b5ecfdd79106f5c2941093ba1883c`, is identical to the tested head's tree. This slice merged that main in before its final local runs.

## What changed

- **Messages** has **New group**: a name of up to 80 characters and at least two other active members, up to 20 people in all. The inbox lists groups by name and finds them by name or by anyone in them; each message from someone else shows their name; **People** lists everyone, adds people, renames the group and leaves it. Only the person who started a group can remove others. Direct threads, blocking and reporting are unchanged.
- **Privacy.** Only the people in a group can read it; there is no owner, administrator or moderator access. Someone added later reads only what is written after they join, enforced by a restrictive row-security policy on `messages` as well as the API. Leaving or removal ends access; their messages stay for the others.
- **Blocks** stop two people adding each other to a group but never pause a group they share.
- **Additive migration 0022** adds `kind`, `title` and `created_by` to `conversations` (existing rows become `direct`), replaces 0004's two-person column check with one shape check, adds `conversation_joins` with forced row security, and adds the late-joiner and leaving policies. `conversation_joins` is granted explicitly to the runtime role: run `npm run db:grant-runtime` after migrating.
- Five routes under `/api/organisations/:slug/`: `conversation-groups`, and `conversations/:id/title`, `/participants`, `/participants/:userId/remove` and `/leave`. The browser demo runs the same rules.
- Migrations 0001 to 0021 are byte-identical; no new runtime dependency. Release constant and package version are 0.24.0-alpha.1. Alpha 23 (PR #16) was still open, so this release skips 0.23.

## Local verification, 3 October 2026

Node 22.22.0, Playwright with Chromium at `/opt/pw-browsers/chromium` through `CHROMIUM_PATH`, PostgreSQL 16 in a disposable loopback cluster (CI uses PostgreSQL 17). Every step below ran on this branch's tree after merging main `f5ec8d3`.

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm test` | 654 passed, 0 failed (639 on main plus 11 database tests through the restricted runtime role and 4 HTTP tests for groups) |
| `npm run test:http` | 19 passed (unchanged) |
| `npm run build`, `npm run bundle:preview` | Passed (existing chunk-size advisory on the single-file preview only) |
| Demo-browser suites | 270 passed across the 15 demo scripts in CI, including 11 in the new `test:browser:groups` (start, send, sender names, people, add, rename, remove, leave, direct threads unchanged, phone width, accessibility and monochrome) |
| Connected-browser suites | 60 passed (unchanged) |
| `npm run test:postgres` | 21 passed on PostgreSQL 16 on a fresh database (1 new: late joiners, leaving and the new grant under row security) |
| Python helpers, `scripts/check_research.py` | 35 passed; the register validates |

Tests changed rather than added: migration-count assertions moved from 21 to 22. The groups browser check refreshes a thread after switching preview person, because the demo, like the live inbox between polls, keeps a thread it read under 30 seconds earlier.

## Not verified, and why

- Hosted PostgreSQL, Better Auth and polling under real load were not exercised. Nothing was deployed.
- A first attempt to apply a group conversations patch prepared by another thread was refused by this session's safety checks, so this slice was written afresh from main rather than from that patch.

## Next actions

1. Drive the pull request green and merge with the owner's standing approval; read back main.
2. Alpha 23 (PR #16) and the email confirmation slice (PR #18) must take the next free alpha and migration numbers when they merge after this.
3. When the owner decides to launch: follow LAUNCH_RUNBOOK.md, and run `npm run db:grant-runtime` after migrating to 0022.

## Historical launch kit evidence: runbook and offline preflight (no version change)

3 October 2026. Application still 0.22.0-alpha.1. Everything needed to switch the app on is written down and checkable offline. Nothing was provisioned, no account was created and nothing is live, by the owner's instruction. See LAUNCH_RUNBOOK.md.

## Status at a glance

| Item | State |
| --- | --- |
| Implemented | Yes, on `claude/build-out-tvzn40`, from main `ec4285d` (the merge of PR #15, Alpha 22) |
| Verified locally | Yes: typecheck, unit tests and the preflight against `.env.example` (see below) |
| Verified remotely (GitHub Actions) | Yes, on PR #17 before it merged |
| Merged | Yes: [PR #17](https://github.com/EmotiveImpact/REUNIR/pull/17), merged into main as `f5ec8d3` |
| Deployed | No. No Neon database, Vercel project, bucket, mail sender or scheduler was created |
| Operated with real members | No |

## PR #15 merged into main

Alpha 22 was merged into main on 3 October 2026 as `ec4285d41f7107fb44bfcd9a6b419d5eb31a3cc1`, a merge commit whose parents are the previous main `b24095a` (PR #14) and the tested head `1645ab7`; its tree, `e7da8b1618bb48e903444b596f74d5a3abeb4af3`, is identical to the tested head's tree. CI runs 37121503128 and 37121505780 (application and postgres) passed on `1645ab7`. This slice started from that main.

## What changed

- **`platform/docs/LAUNCH_RUNBOOK.md`**: the launch in order, with checkboxes. Neon project with separate administrative and `reunir_app` roles; migrations and runtime grants; the first owner; every server variable and where it must never be; Google Cloud Storage; Resend sender verification; the Vercel project; hosted health and privacy checks with two people and two communities; the mail and digest scheduler (deliberately no `crons` entry until the owner chooses); backups with a restore rehearsal; monitoring; rollback; the evidence log and the written approvals before pilot members are invited.
- **`npm run launch:preflight`** (`scripts/launch-preflight.ts`): checks the names and shapes of a production environment without printing any value, opening a connection or calling a provider. It fails on local or non-https origins, an owner role as the runtime database user, migration or provisioning credentials in the runtime, secret-like `VITE_` names, short, placeholder or reused secrets, a half-configured mail or storage pair and an invalid `ADMIN_TWO_FACTOR`; it warns on optional gaps.
- `.env.example` and SETUP.md point to both. No migration, no runtime code change, no new dependency.

## Local verification, 3 October 2026

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm test` | 639 passed, 0 failed (627 existing plus 12 for the preflight, including that no value ever appears in its output) |
| `npm run launch:preflight -- --env-file .env.example` | Exits 1 with 5 failures and 5 warnings, as expected for the blank example file |
| Python helpers, `scripts/check_research.py` | 35 passed; the register validates with 55 pinned sources and 18 register decisions |

The browser and PostgreSQL suites were not rerun locally: this slice changes no application code, and CI runs them on the pull request.

## Not verified, and why

- Every hosted step in the runbook is unverified until the owner decides to launch: Neon, Vercel, the bucket, Resend, the scheduler, backups and monitoring were deliberately not created.

## Next actions

1. Drive the pull request green and merge; read back main.
2. Cover thumbnails, cover library renaming and tags, and a higher library limit.
3. When the owner decides to launch: follow LAUNCH_RUNBOOK.md from section 0, running `npm run launch:preflight` against the staged values first.

## Historical Alpha 22 evidence: cover picture descriptions

3 October 2026. Application 0.22.0-alpha.1. Whoever may change a track or project cover can describe the picture, and a screen reader reads that description on the track's or project's own page. See decisions/022-cover-descriptions.md and COVERS.md.

## Status at a glance

| Item | State |
| --- | --- |
| Implemented | Yes, on `claude/build-out-tvzn40`, from main `b24095a` (the merge of PR #14, Alpha 21) |
| Verified locally | Yes: every suite (see below) |
| Verified remotely (GitHub Actions) | Yes: runs 37121503128 and 37121505780 on `1645ab7` (application and postgres) |
| Merged | Yes, [PR #15](https://github.com/EmotiveImpact/REUNIR/pull/15) as `ec4285d`, under the owner's standing approval (3 October 2026) |
| Deployed | No. No Neon database, Vercel project, bucket, mail sender or scheduler was created |
| Operated with real members | No |

## PR #14 merged into main

Alpha 21 was merged into main on 3 October 2026 as `b24095a115bf852558a8bc82b61dcb1f42678ab7`, a merge commit whose parents are the previous main `c137f90` (PR #13) and the tested head `3f573bd`; its tree, `b4bbfa3abd0abb16fc18d748d0bae80610c397cc`, is identical to the tested head's tree. CI runs 37120425288 and 37120428877 (application and postgres) passed on `3f573bd`. This slice started from that main.

## What changed

- **Describe the picture (optional)** in the cover dialogue: up to 150 characters on one line, with a counter. Stored with the cover itself, inside its existing 1,000-byte check.
- On a track's or project's own page a described cover is an image with that description (`role="img"` and `aria-label`); cards, lists, thumbnails and undescribed covers stay decorative.
- Moving the focal point keeps the description; choosing a new picture starts without one; removing the cover removes it.
- No migration, no grant change, no new runtime dependency. Release constant and package version are 0.22.0-alpha.1.

## Local verification, 3 October 2026

Node 22.22.0, npm 10.9.4, Playwright with Chromium at `/opt/pw-browsers/chromium` through `CHROMIUM_PATH`, PostgreSQL 16 in a disposable loopback cluster (CI uses PostgreSQL 17). Every step ran on this branch's tree on top of main `b24095a`.

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm test` | 627 passed, 0 failed (625 existing plus 2 for descriptions in the covers domain and database tests) |
| `npm run test:http` | 19 passed (unchanged) |
| `npm run build`, `npm run bundle:preview` | Passed (existing chunk-size advisory on the single-file preview only) |
| Demo-browser suites | 283 passed: as Alpha 21, with 17 covers (1 new: describing a picture, the counter and the announced image) |
| Connected-browser suites | 60 passed (unchanged) |
| `npm run test:postgres` | 20 passed on PostgreSQL 16 |
| Python helpers, `scripts/check_research.py` | 35 passed; the register validates with 55 pinned sources and 18 register decisions |

## Corrections made while verifying

- The first PostgreSQL run in this slice failed before any test because the local disposable cluster had stopped; it was restarted and the suite passed unchanged.

## Not verified, and why

- Screen readers themselves were not run; the covers browser suite checks the role and accessible name the page exposes.

## Next actions

1. Drive the pull request green and merge with the owner's standing approval; read back main.
2. Virus scanning of uploads (Alpha 23) and group conversations (Alpha 24), each built and tested locally.
3. When deployment resumes: follow LAUNCH_RUNBOOK.md once it lands.

## Historical Alpha 21 evidence: two-step sign-in for owners and administrators

3 October 2026. Application 0.21.0-alpha.1. Anyone can turn on two-step sign-in with an authenticator app and one-time backup codes. When the server requires it, owners and administrators need it to use their authority. See decisions/021-two-step-sign-in.md, ACCOUNTS.md and SECURITY.md.

## Status at a glance

| Item | State |
| --- | --- |
| Implemented | Yes, on `claude/build-out-tvzn40`, from main `c137f90` (the merge of PR #13, Alpha 20) |
| Verified locally | Yes: every suite (see below) |
| Verified remotely (GitHub Actions) | Yes: runs 37120425288 and 37120428877 on `3f573bd` (application and postgres) |
| Merged | Yes, [PR #14](https://github.com/EmotiveImpact/REUNIR/pull/14) as `b24095a`, under the owner's standing approval (3 October 2026) |
| Deployed | No. No Neon database, Vercel project, bucket, mail sender or scheduler was created |
| Operated with real members | No |

## PR #13 merged into main

Alpha 20 was merged into main on 3 October 2026 as `c137f9060edd6683b16ecbb65d9e040fda707812`, a merge commit whose parents are the previous main `648df31` (PR #12) and the tested head `19236bc`; its tree, `da77553516788ada343f0ab2abd152d2dfbafd6c`, is identical to the tested head's tree. CI runs 37119260110 and 37119273038 (application and postgres) passed on `19236bc`. This slice started from that main.

## What changed

- **Two-step sign-in** uses Better Auth's own two-factor plugin from the pinned `better-auth` 1.7.5: authenticator-app codes (RFC 6238, issuer "REUNIR") and ten one-time backup codes, both encrypted by the plugin. No SMS or email codes and no trusted devices.
- **Your account** has a Two-step sign-in panel: turning it on needs the password and a correct code, the backup codes are shown once, and turning it off or making new backup codes needs the password. The demo panel only explains the feature.
- **Sign-in** asks for the code or a backup code before any session exists, on the sign-in page and on an invitation page.
- **`ADMIN_TWO_FACTOR`** is `required` or `optional`; unset means required in production. An invalid value stops the server. Without two-step sign-in, an owner or administrator keeps reads and member or moderator actions, and owner or administrator commands and routes return 403 `TWO_FACTOR_REQUIRED`. A monochrome notice links to Your account.
- **Additive migration 0021** adds `auth_user.two_factor_enabled` and `auth_two_factor`, removed with the account and granted explicitly to the runtime role. Run `npm run db:grant-runtime` after migrating.
- Migrations 0001 to 0020 are byte-identical; no new runtime dependency. Release constant and package version are 0.21.0-alpha.1.

## Local verification, 3 October 2026

Node 22.22.0, npm 10.9.4, Playwright with Chromium at `/opt/pw-browsers/chromium` through `CHROMIUM_PATH`, PostgreSQL 16 in a disposable loopback cluster (CI uses PostgreSQL 17). Every step below ran on this branch's tree on top of main `c137f90`.

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm test` | 625 passed, 0 failed (611 existing plus 3 for the setting and helpers and 11 HTTP tests with a real Better Auth instance and independently computed codes) |
| `npm run test:http` | 19 passed (unchanged) |
| `npm run build`, `npm run bundle:preview` | Passed (existing chunk-size advisory on the single-file preview only) |
| Demo-browser suites | 282 passed: as Alpha 20, with 11 accounts (1 new: the explanatory panel as member and administrator) |
| Connected-browser suites | 60 passed: 12 connected, 9 resources, 9 assessments, 13 covers, 6 instructors, 11 accounts (4 new: notice and refusal, turning it on in a real browser, signing in with a backup code, turning it off) |
| `npm run test:postgres` | 20 passed on PostgreSQL 16 (1 new: the runtime role's grant on `auth_two_factor`) |
| Python helpers, `scripts/check_research.py` | 35 passed; the register validates with 55 pinned sources and 18 register decisions |

Tests changed rather than added: migration-count assertions moved from 20 to 21.

## Not verified, and why

- Hosted Better Auth and a real reverse proxy were not exercised; the plugin's per-address rate limit depends on the client address the proxy passes on.
- A code can be replayed within the library's 30-second window. There is no recovery for someone who has lost both their app and their backup codes except an operator reset (ACCOUNTS.md). Changing `BETTER_AUTH_SECRET` makes stored secrets and backup codes unreadable.

## Next actions

1. Drive the pull request green and merge with the owner's standing approval; read back main.
2. Cover picture descriptions (Alpha 22), virus scanning of uploads (Alpha 23) and group conversations (Alpha 24), each built and tested locally.
3. When deployment resumes: follow LAUNCH_RUNBOOK.md once it lands, set `ADMIN_TWO_FACTOR`, and run `npm run db:grant-runtime` after migrating.

## Historical Alpha 20 evidence: inviting someone new to teach a track

3 October 2026. Application 0.20.0-alpha.1. Owners and administrators can invite someone who is not yet a member to teach one track, from that track's Instructors dialogue. Accepting makes them a member and that track's instructor. See decisions/020-instructor-invitations.md and INSTRUCTORS.md.

## Status at a glance

| Item | State |
| --- | --- |
| Implemented | Yes, on `claude/build-out-tvzn40`, from main `648df31` (the merge of PR #12, Alpha 19) |
| Verified locally | Yes: every suite (see below) |
| Verified remotely (GitHub Actions) | Yes: runs 37119260110 and 37119273038 on `19236bc` (application and postgres) |
| Merged | Yes, [PR #13](https://github.com/EmotiveImpact/REUNIR/pull/13) as `c137f90`, under the owner's standing approval (3 October 2026) |
| Deployed | No. No Neon database, Vercel project, bucket, mail sender or scheduler was created |
| Operated with real members | No |

## PR #12 merged into main

Alpha 19 was merged into main on 3 October 2026 as `648df31ee27c41829bc1665fce73ce2dbfaa6e26`, a merge commit whose parents are the previous main `a211a09` (PR #11) and the tested head `dd50d86`; its tree, `7832b8907f96f6846e4d944052e3874d83d82f59`, is identical to the tested head's tree. CI runs 37118692649 and 37118705076 (application and postgres) passed on `dd50d86`. This slice started from that main.

## What changed

- **Invite to teach.** The Instructors dialogue has **Invite someone new to teach**. `POST /api/organisations/:slug/invitations` takes an optional `trackId`. The email and the invitation page name the track, and Member access lists the invitation with "To teach" and the track. The demo records a fictional invitation and sends nothing.
- **Acceptance.** Accepting an invitation that names a track inserts the grant in the sender's name, with an audit entry, only while the sender is an active owner or administrator and the track exists. Otherwise the person joins as a member only. The response says which track they can teach.
- **Additive migration 0020** adds `invitations.track_id` (tied to a track in the same community) and the insert policy `instructor_invited`, which admits a grant only for the accepting person, whose account has the invited address, for the invitation's track and sender, while the invitation is pending and the sender administers the community.
- The web client's invitation calls moved into `lib/invitations.ts`, shared by Member access and the Instructors dialogue.
- Migrations 0001 to 0019 are byte-identical; no grant changes; no new runtime dependency. Release constant and package version are 0.20.0-alpha.1.

## Local verification, 3 October 2026

Node 22.22.0, npm 10.9.4, Playwright with Chromium at `/opt/pw-browsers/chromium` through `CHROMIUM_PATH`, PostgreSQL 16 in a disposable loopback cluster (CI uses PostgreSQL 17).

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm test` | 611 passed, 0 failed (605 existing plus 6 for instructor invitations under the restricted role, including the row-security policy and the route) |
| `npm run test:http` | 19 passed (unchanged) |
| `npm run build`, `npm run bundle:preview` | Passed (existing chunk-size advisory on the single-file preview only) |
| Demo-browser suites | 281 passed: 85 regression, 17 operations, 29 project work, 27 authoring, 11 rich lessons, 19 resources, 16 assessments, 16 covers, 10 instructors (1 new: inviting someone to teach), 10 accounts, 5 notifications, 16 monochrome, 20 v4 |
| Connected-browser suites | 56 passed: 12 connected, 9 resources, 9 assessments, 13 covers, 6 instructors, 7 accounts |
| `npm run test:postgres` | 19 passed on PostgreSQL 16 |
| Python helpers, `scripts/check_research.py` | 35 passed; the register validates with 55 pinned sources and 18 register decisions |

Tests changed rather than added: migration-count assertions moved from 19 to 20.

## Corrections made while verifying

- The first version of the grant policy checked the invitation, track and sender but not the person: anyone holding the invitation's secret could have granted themselves. The policy now also requires the accepting account to have the invited address, and a test proves another member is refused.

## Not verified, and why

- No mail provider is configured, by the user's instruction; the invitation email was exercised through the encrypted outbox and opened in tests, not delivered.

## Next actions

1. Push, open the pull request, drive CI green and merge with the owner's standing approval; read back main.
2. Two-step sign-in for owners and administrators, and email verification and change.
3. When deployment resumes: follow LAUNCH_RUNBOOK.md once it lands (twenty migrations).

## Historical Alpha 19 evidence: notification settings and email digests

3 October 2026. Application 0.19.0-alpha.1. Members can turn off notices about conversations, learning, projects or events in each community, and can ask for a daily or weekly email digest of notices they have not read. Notices about their own access always arrive. See decisions/019-notification-settings-and-digests.md.

## Status at a glance

| Item | State |
| --- | --- |
| Implemented | Yes, on `claude/build-out-tvzn40`, from main `a211a09` (the merge of PR #11, Alpha 18) |
| Verified locally | Yes: every suite (see below) |
| Verified remotely (GitHub Actions) | Yes: runs 37118692649 and 37118705076 on `dd50d86` (application and postgres) |
| Merged | Yes, [PR #12](https://github.com/EmotiveImpact/REUNIR/pull/12) as `648df31`, under the owner's standing approval (3 October 2026) |
| Deployed | No. No Neon database, Vercel project, bucket, mail sender or scheduler was created |
| Operated with real members | No |

## PR #11 merged into main

Alpha 18 was merged into main on 3 October 2026 as `a211a094c83d37daf68d78c0465c10cd2ea225b4`, a merge commit whose parents are the previous main `a924295` (PR #10) and the tested head `595dee2`; its tree, `acad198e1bbb91867b021d2934f58d546630977a`, is identical to the tested head's tree. CI runs 37118025779 and 37118037759 (application and postgres) passed on `595dee2`. This slice started from that main.

## What changed

- **Notification settings.** On the Notifications page, **Notification settings** opens a dialogue with four topics (conversations, learning, projects, events) and a digest choice (none, daily, weekly). A new command, `notification.preferences.save`, stores them; it writes no audit entry and is refused for suspended members. Notices are grouped by where they lead (`noticeTopic`); access, role, ownership and teaching notices have no switch. Muted notices are dropped when a command creates them, in the domain shared with the demo, and earlier notices stay.
- **Additive migration 0019** adds `notification_preferences` with checks on the allowed topics and digests, one row per member and community, and row security: members read their community's settings (the domain needs them to filter new notices), but write only their own row, and insert only while active. A narrow read policy lets the digest job list who is due across communities when the transaction sets `app.worker='digest'`. The browser receives only the person's own row. Account deletion removes it.
- **Email digests.** `DigestService` lists who is due, then works inside each member's own community context: it locks and re-checks the row, skips suspended members and missing accounts, counts unread notices since the last digest, stamps the time and queues one encrypted email with at most 20 notices and a count of the rest. Nothing is queued when there is nothing new. `GET /api/internal/digests` (the existing `CRON_SECRET` bearer) and `npm run digests:queue` run it; the existing mail drain sends what it queues. Digests are only constructed when a mail provider is configured, and `/api/account/capabilities` says whether they are sent.
- Migrations 0001 to 0018 are byte-identical. No new grants beyond the runtime grant every domain table receives. No new runtime dependency. Release constant and package version are 0.19.0-alpha.1.

## Local verification, 3 October 2026

Node 22.22.0, npm 10.9.4, Playwright with Chromium at `/opt/pw-browsers/chromium` through `CHROMIUM_PATH`, PostgreSQL 16 in a disposable loopback cluster (CI uses PostgreSQL 17).

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm test` | 605 passed, 0 failed (595 existing plus 10: 5 domain rules for topics, muting and privacy; 5 for row security, the digest job and its scheduled route under the restricted role) |
| `npm run test:http` | 19 passed (unchanged) |
| `npm run build`, `npm run bundle:preview` | Passed (existing chunk-size advisory on the single-file preview only) |
| Demo-browser suites | 280 passed: 85 regression, 17 operations, 29 project work, 27 authoring, 11 rich lessons, 19 resources, 16 assessments, 16 covers, 9 instructors, 10 accounts, 5 notifications (new), 16 monochrome, 20 v4 |
| Connected-browser suites | 56 passed: 12 connected, 9 resources, 9 assessments, 13 covers, 6 instructors, 7 accounts |
| `npm run test:postgres` | 19 passed on PostgreSQL 16 (18 existing plus 1: overlapping digest runs queue one email) |
| Python helpers, `scripts/check_research.py` | 35 passed; the register validates with 55 pinned sources and 18 register decisions |

Tests changed rather than added: migration-count assertions moved from 18 to 19; the account deletion tests now include notification settings among the personal records removed.

## Corrections made while verifying

- The digest query multiplied a text parameter by an interval; the database test caught it and the parameters are now cast.
- Being asked to teach a track first counted as a learning notice, so muting learning would have hidden it; it now counts as an access notice and always arrives.

## Not verified, and why

- No mail provider or scheduler is configured, by the user's instruction; digests were exercised with the encrypted outbox and opened in tests, not delivered.

## Next actions

1. Push, open the pull request, drive CI green and merge with the owner's standing approval; read back main.
2. Instructor email invitations and two-step sign-in for owners and administrators.
3. When deployment resumes: Neon staging with nineteen migrations and runtime grants, Vercel live mode, a mail provider, a scheduler for `/api/internal/mail` and `/api/internal/digests`, bucket setup (SETUP.md section 6), then hosted privacy tests.

## Historical Alpha 18 evidence: server pages for long lists

3 October 2026. Application 0.18.0-alpha.1. Notices, the knowledge-check review queues and the audit trail now load a page at a time from the server, with exact counts, so a busy community no longer sends ever larger snapshots to every browser. See decisions/018-server-pages-for-long-lists.md.

## Status at a glance

| Item | State |
| --- | --- |
| Implemented | Yes, on `claude/build-out-tvzn40`, from main `a924295` (the merge of PR #10, Alpha 17) |
| Verified locally | Yes: every suite (see below) |
| Verified remotely (GitHub Actions) | Yes: runs 37118025779 and 37118037759 on `595dee2` (application and postgres) |
| Merged | Yes, [PR #11](https://github.com/EmotiveImpact/REUNIR/pull/11) as `a211a09`, under the owner's standing approval (3 October 2026) |
| Deployed | No. No Neon database, Vercel project, bucket, sender or scheduler was created |
| Operated with real members | No |

## PR #10 merged into main

Alpha 17 was merged into main on 3 October 2026 as `a924295aa767b2301dcacb30bf73a0baf8247343`, a merge commit whose parents are the previous main `b68ba2e` (PR #9) and the tested head `8f73bdd`; its tree, `980e6f9e2f940b30838b8cc64719deb0aefe2cde`, is identical to the tested head's tree. CI run 37117343967 (application and postgres) passed on `8f73bdd`, as did runs 37116692953 and 37116701760 on the earlier head `78140d5`, whose tree differs only by PR #9's already-included record. This slice started from that main.

## What changed

- **One paging route.** `GET /api/organisations/:slug/pages/:list` serves `notifications`, `review-waiting`, `review-scored`, `review-reviewed` and `audit`, 20 a page by default and at most 50, with an opaque keyset cursor (time and id). Offsets and foreign cursors are refused; unknown lists return 404; members get 403 for the audit trail; strangers get 404 and signed-out visitors 401.
- **The snapshot carries a window and a summary.** The newest 30 notices, the newest 12 audit entries for administrators, only the person's own knowledge-check attempts, and exact counts for unread notices, each review queue, waiting answers per track and the whole audit trail.
- **Reads are bounded.** A workspace read skips the outbox, reads the newest 100 audit entries and only the acting person's own notices; account deletion and operator erasure still read in full. The audit page is read in SQL with millisecond keyset ordering.
- **Interface.** Notices show "Show older notices" and keep focus on the first new one; the three knowledge-check queues page from the server, the scored and reviewed lists only once opened; the community studio opens "the full audit trail" a page at a time; tab and badge counts come from the summary. The demo uses the same domain paging over fictional data.
- No migration, no grant change, no new runtime dependency. Release constant and package version are 0.18.0-alpha.1.

## Local verification, 3 October 2026

Node 22.22.0, npm 10.9.4, Playwright with Chromium at `/opt/pw-browsers/chromium` through `CHROMIUM_PATH`, PostgreSQL 16 in a disposable loopback cluster (CI uses PostgreSQL 17).

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm test` | 595 passed, 0 failed (584 existing plus 11: 4 domain paging, 5 under the restricted role, 2 through the API) |
| `npm run test:http` | 19 passed (unchanged) |
| `npm run build`, `npm run bundle:preview` | Passed (existing chunk-size advisory on the single-file preview only) |
| Demo-browser suites | 275 passed: 85 regression, 17 operations, 29 project work, 27 authoring, 11 rich lessons, 19 resources, 16 assessments, 16 covers, 9 instructors, 10 accounts, 16 monochrome, 20 v4 |
| Connected-browser suites | 56 passed: 12 connected, 9 resources, 9 assessments, 13 covers, 6 instructors, 7 accounts |
| `npm run test:postgres` | 18 passed on PostgreSQL 16 |
| Python helpers, `scripts/check_research.py` | 35 passed; the register validates with 55 pinned sources and 18 register decisions |

Tests changed rather than added: knowledge-check and instructor tests that read other people's attempts from the snapshot now read them from the review pages or the unshortened domain view.

## Corrections made while verifying

- The first database tests missed the community filter on two counts and used a role change that changed nothing; both were corrected before the run above.
- The seed has no audit entries, so the API test now inserts some before paging the audit trail.

## Not verified, and why

- Hosted PostgreSQL and real traffic remain deferred by the user; page timings on a large community are not measured.

## Next actions

1. Push, open the pull request, drive CI green and merge with the owner's standing approval; read back main.
2. Notification settings and email digests (Alpha 19).
3. When deployment resumes: Neon staging with eighteen migrations and runtime grants, Vercel live mode, bucket setup (SETUP.md section 6), then hosted privacy tests.

## Historical Alpha 17 evidence: loose ends after account deletion

3 October 2026. Application 0.17.0-alpha.1. Deleting your own account now hands back claimed tasks in every community, including one where you were suspended; a replaced or removed cover picture is erased at once; the deletion-during-acceptance timing case has a PostgreSQL test; mentions in other people's posts stay as written. See decisions/017-follow-ups-after-account-deletion.md.

## Status at a glance

| Item | State |
| --- | --- |
| Implemented | Yes, on `claude/build-out-tvzn40`, from main `12ed75c` (the merge of PR #8, Alpha 16) |
| Verified locally | Yes: every suite (see below) |
| Verified remotely (GitHub Actions) | Yes: run 37117343967 on `8f73bdd` (application and postgres) |
| Merged | Yes, [PR #10](https://github.com/EmotiveImpact/REUNIR/pull/10) as `a924295`, under the owner's standing approval (3 October 2026) |
| Deployed | No. No Neon database, Vercel project, bucket, sender or scheduler was created |
| Operated with real members | No |

## PR #8 merged into main

Ownership transfer (Alpha 16) was merged into main on 3 October 2026 as `12ed75c32cefb4eed90e97b9c295524ba57bc6cf`, a merge commit whose parents are the previous main `4bda5e7` and the tested head `d9568fa`; its tree, `94713f44478b95c44b836809a788c4f11ecb4402`, is identical to the tested head's tree. This slice started from that main.

## What changed

- **Claimed tasks go back everywhere.** Deleting your own account releases tasks you had claimed without proof in every community. Where you were suspended, suspension had closed the project's work to you, so they used to stay assigned; additive migration `0018_account_deletion_tasks.sql` now admits exactly those tasks while the transaction is marked as your own deletion, and an update may only leave them unassigned, without proof and in "to do". PostgreSQL also requires an updated row to stay readable, so the deletion names the tasks it releases (`app.released_tasks`) and the read policy admits only those once unassigned. The repository releases tasks with one direct update and refuses the whole deletion if row security admitted fewer than planned.
- **Replaced covers go at once.** Changing or removing a track or project cover deletes the upload record of the picture nothing shows any more in the same change; `POST /commands` deletes its stored file straight after commit (`releasedCoverKeys`). Moving the focal point keeps the picture; library pictures stay in the library; no storage key reaches the browser.
- **The timing case is tested.** A new PostgreSQL check holds an acceptance's share lock on an account, starts a deletion on another connection, proves it waits, commits the new membership and proves the deletion removes it with the rest.
- **Mentions stay as written** (decision 017): REUNIR has no mention links, and rewriting other people's words would alter their record.
- Migrations 0001 to 0017 are byte-identical; no grants change. Release constant and package version are 0.17.0-alpha.1. No new runtime dependency.

## Local verification, 3 October 2026

Node 22.22.0, npm 10.9.4, `npm ci` from the committed lockfile, Playwright with Chromium at `/opt/pw-browsers/chromium` through `CHROMIUM_PATH`, PostgreSQL 16 in a disposable loopback cluster (CI uses PostgreSQL 17).

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm test` | 584 passed, 0 failed (581 existing plus 3: a replaced or removed cover in the domain, under the runtime role and through the API with storage removal); the account deletion database test now expects three released tasks, two of them where Alex was suspended, and adds row-security assertions for 0018 |
| `npm run test:http` | 19 passed (unchanged) |
| `npm run build`, `npm run bundle:preview` | Passed (existing chunk-size advisory on the single-file preview only) |
| Demo-browser suites | 275 passed: 85 regression, 17 operations, 29 project work, 27 authoring, 11 rich lessons, 19 resources, 16 assessments, 16 covers, 9 instructors, 10 accounts, 16 monochrome, 20 v4 |
| Connected-browser suites | 56 passed: 12 connected, 9 resources, 9 assessments, 13 covers, 6 instructors, 7 accounts |
| `npm run test:postgres` | 18 passed on PostgreSQL 16 (17 existing plus 1: the deletion that starts while an acceptance holds the account) |
| Python helpers, `scripts/check_research.py` | 35 passed; the register validates with 55 pinned sources and 18 decisions |

Tests changed rather than added: nine migration-count assertions moved from 17 to 18; one cover test now expects the replaced picture to go at once rather than after an hour.

## Corrections made while verifying

- Releasing tasks through the generic upsert failed where the person was suspended: an `INSERT ... ON CONFLICT` needs the insert policy, which suspension closes. The release is now a direct update.
- A direct update with `RETURNING` then failed, and so did one without it: PostgreSQL requires the updated row to pass the read policies when the statement reads the table. The read policy now admits the tasks the deletion names once they are unassigned, and a test proves an unnamed unassigned task stays hidden and a named one cannot be changed.
- The local PostgreSQL run needs a fresh database and no leftover `reunir_*` roles; a second run against the same cluster fails its emptiness check by design.

## Not verified, and why

- Hosted PostgreSQL, Better Auth and a real bucket's object deletion remain deferred by the user; the cover removal was exercised with the in-process storage stand-in.

## Next actions

1. Push, open the pull request, drive CI green and merge with the owner's standing approval; read back main.
2. Server-side pagination for review queues and other long lists (Alpha 18).
3. When deployment resumes: Neon staging with eighteen migrations and runtime grants, Vercel live mode, bucket setup (SETUP.md section 6), then hosted privacy tests.

---
## Historical Alpha 16 evidence: ownership transfer

3 October 2026. Application 0.16.0-alpha.1. A community's owner hands it to one of its administrators, after re-entering their password and typing the community's name. The previous owner stays as an administrator and, once they own no community, can delete their account. See ACCOUNTS.md and decisions/016-ownership-transfer.md.

## Status at a glance

| Item | State |
| --- | --- |
| Implemented | Yes, on `claude/ownership-transfer-7kx603`, from main `cc806e7` with main `4bda5e7` (PR #7, the changelog) merged in ([PR EmotiveImpact/REUNIR#8](https://github.com/EmotiveImpact/REUNIR/pull/8)) |
| Verified locally | Yes: every suite (see below) |
| Verified remotely (GitHub Actions) | Passed on `553e0a7`: [run 37110819170](https://github.com/EmotiveImpact/REUNIR/actions/runs/37110819170) and [run 37110833684](https://github.com/EmotiveImpact/REUNIR/actions/runs/37110833684), both jobs (application and PostgreSQL 17) green |
| Merged | Yes: merged into main as `12ed75c`; the owner confirmed it on 3 October 2026 |
| Deployed | No. No Neon database, Vercel project, bucket, sender or scheduler was created |
| Operated with real members | No |

## What changed

- **Hand over ownership.** In Members and access, the owner opens an active administrator's access settings and chooses **Hand over ownership…**. The dialogue explains what changes and asks for the current password (live mode) and the community's name. For anyone who is not an administrator, the settings say to make them one first; the owner's own settings say how a handover works.
- **The route.** `POST /api/organisations/:slug/ownership` is same-origin JSON for signed-in members, rate limited to five attempts in fifteen minutes, and checks the password with Better Auth before calling `WorkspaceRepository.transferOwnership`. It is not a workspace command: the command schema has no handover and still refuses `owner` as a role, so the generic route cannot skip the password.
- **The rules** (`packages/domain/src/ownership.ts`, shared with the demo). Only the active owner, only to an active administrator of the same community, with the name typed (case and outer spaces ignored). The previous owner becomes an administrator; the audit entry `member.owner.transferred` names both memberships; the new owner gets a notice; the revision and outbox advance.
- **One owner, always.** Migration `0017_single_owner.sql` (additive) adds a unique index on `members(organization_id) WHERE role='owner'`. The repository demotes the previous owner before promoting the new one, under the community lock, so concurrent handovers let exactly one through. Migrations 0001 to 0016 are byte-identical; no grant changes.
- **Your account.** Owners now read "Hand each one to an administrator first, from that person's access settings", with a link to Members and access. After the last handover the delete button appears.
- Upstream review: HumHub's change-owner form, controller rules and owner membership (research note 21); no code copied. Release constant and package version are 0.16.0-alpha.1. No new runtime dependency.

## Local verification, 3 October 2026

Node 22.22.0, npm 10.9.4, `npm ci` from the committed lockfile, Playwright with Chromium at `/opt/pw-browsers/chromium` through `CHROMIUM_PATH`, PostgreSQL 16 in a disposable loopback cluster (CI uses PostgreSQL 17).

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm test` | 581 passed, 0 failed (562 existing plus 8 ownership domain, 5 database and 6 HTTP tests) |
| `npm run test:http` | 19 passed (unchanged) |
| `npm run build`, `npm run bundle:preview` | Passed (existing chunk-size advisory on the single-file preview only) |
| Existing demo-browser suites | 265 passed: 85 regression, 17 operations, 29 project work, 27 authoring, 11 rich lessons, 19 resources, 16 assessments, 16 covers, 9 instructors, 16 monochrome, 20 v4 |
| `npm run test:browser:accounts` | 10 passed (9 existing plus 1: the owner makes Maya an administrator, a mistyped name is refused, the handover succeeds, Maya's role can no longer be changed by the previous owner, and Your account lists only Studio North as owned; axe and neutral-colour checks) |
| Existing connected-browser suites | 49 passed: 12 connected, 9 resources, 9 assessments, 13 covers, 6 instructors |
| `npm run test:browser:accounts-connected` | 7 passed (6 existing plus 1, live build with Better Auth and the restricted runtime role: a wrong password is refused, the handover succeeds, Your account shows the previous owner as administrator with no refusal, and they delete their account; the steward remains the owner) |
| `npm run test:postgres` | 17 passed on PostgreSQL 16 (16 existing plus 1: the unique index refuses a second owner, two handovers at once on separate connections let exactly one through, and the previous owner then deletes their account) |
| Python helpers, `scripts/check_research.py` | 35 passed (unchanged); the register validates with 55 pinned sources and 18 decisions |

Tests changed rather than added: nine migration-count assertions moved from 16 to 17. The demo account suite's new check runs after the restarts, so the earlier checks still see Amina Okafor owning both communities.

## Corrections made while verifying

- In the demo browser check, the standalone preview has no browser storage, so the toast carries the session-only note; the check now looks for the message within the toast.
- The PostgreSQL check first failed typechecking on an untyped row value; it now compares the owner's ID as a string.

## Not verified, and why

- Hosted Better Auth and hosted PostgreSQL remain deferred by the user; the handover was exercised through PGlite and PostgreSQL 16 with the restricted role and real Better Auth password checks in a local build.
- The new owner is told, not asked; an offer the recipient accepts is recorded as a possible later step in decision 016.

## Preview

The demo runs inside this workspace with `VITE_DATA_MODE=demo npm run dev` at `http://127.0.0.1:5173`, reachable only from inside the container. Preview as admin (Amina Okafor, the owner), open Your account → Open members and access → Manage Maya Bennett, make her an administrator, then Hand over ownership… and type "Code Black".

## Publication receipt

Source commit `553e0a7edd7753e2a660440f50734ab9fc87d4c4` was pushed to `claude/ownership-transfer-7kx603`; the remote ref was read back and matched. Both CI runs on it passed (links above), with no review threads open. This receipt commit changes only documentation and source hashes. Merging into main needs the owner's approval.

PR #8 was merged with a merge commit, no force-push: main is now `12ed75c32cefb4eed90e97b9c295524ba57bc6cf`, whose parents are the previous main `4bda5e7` and the tested head `d9568fa` (CI green). Main was fetched back after the merge; its tree, `94713f44478b95c44b836809a788c4f11ecb4402`, is identical to the tested head's tree. The merge went ahead on the coordinator's reading of the owner's request to build out the whole app, before an explicit approval; the owner then confirmed it, and approved merging each finished feature once its checks pass.

## Next actions

1. Server-side pagination for review queues and other long lists.
2. When deployment resumes: Neon staging with seventeen migrations and runtime grants, Vercel live mode, bucket setup (SETUP.md section 6), then hosted privacy tests, including account deletion and ownership transfer against hosted Better Auth.

---
## Historical Alpha 15 evidence: account deletion

3 October 2026. Application 0.15.0-alpha.1. People delete their own account from **Your account**. As the owner decided, posts, comments and project work stay so conversations still make sense, shown as "Former member"; name, photo and profile go; private things and the person's own learning record are deleted; direct messages stay for the other person. Owners are refused until ownership can be handed over. See ACCOUNTS.md and decisions/015-account-deletion.md.

## Status at a glance

| Item | State |
| --- | --- |
| Implemented | Yes, on `claude/laughing-goodall-2p7z0v`, restarted from main `661fac9` after PR #5 was merged ([PR EmotiveImpact/REUNIR#6](https://github.com/EmotiveImpact/REUNIR/pull/6)) |
| Verified locally | Yes: every suite, from a clean worktree of tested commit `67623fb` after `npm ci` (see below) |
| Verified remotely (GitHub Actions) | Passed on `7343bcf`; the review fixes follow, with CI recorded on PR #6 |
| Merged | Yes: approved by the owner on 3 October 2026 and merged into main as `cc806e7` |
| Deployed | No. No Neon database, Vercel project, bucket, sender or scheduler was created |
| Operated with real members | No |

## PR #5 merged into main

The owner approved merging PR #5 (Alpha 11 to 14) once CI was green. Both jobs had passed on its head `d6407186c1e9de62d3548fb47a5ed9909d321362` in [run 37100742188](https://github.com/EmotiveImpact/REUNIR/actions/runs/37100742188) (push) and [run 37100743793](https://github.com/EmotiveImpact/REUNIR/actions/runs/37100743793) (pull request), with no open review threads. It was merged with a merge commit, no force-push: main is now `661fac9d921292f4d7432c1df4c7b98827cf6211`, whose parents are the previous main `365e1c9` and the tested head `d640718`. Main was fetched back after the merge; its tree, `c49b1665108ca090997ddf785f581c1cce5b3e30`, is identical to the tested head's tree. The push to main then passed CI in [run 37101346869](https://github.com/EmotiveImpact/REUNIR/actions/runs/37101346869). The working branch was restarted from that main for this slice, as a fresh change.

## What changed

- **Your account.** The account menu opens a page listing the person's communities and roles (now returned with the session), what deletion keeps as Former member and what it removes, and a link to download the learning record first. Owners see why deletion is unavailable instead of a button.
- **Deleting it.** A dialogue names the communities and asks for the current password (live) and the typed phrase "delete my account". `POST /api/account/delete` is same-origin JSON, rate limited to five attempts in fifteen minutes, checks the password with Better Auth (`auth.api.verifyPassword`), deletes everything in one transaction, removes private files from storage after commit and clears the session cookie. The live app returns to sign-in with a notice; the demo explains what happened and can be restarted.
- **One transaction, every community.** Each membership, suspended ones included, becomes the same scrubbed record (Former member, status `left`). Personal records go: reactions, saved posts, notices, replies to events, goals, private-space access, enrolments, completions, path enrolments, knowledge-check attempts, recognition, instructor grants, read state, blocks they made, request receipts, private files, invitations to their address and queued mail to it, reset tokens, rate counters, sessions, password hash and account. Shared work stays, project team places included. Claimed tasks without proof return to their teams; notices that begin with the person's name are reworded unless the name is shared; the audit entry records counts only. A shortfall between planned and admitted deletes rolls everything back.
- **Former member everywhere.** No photo (demo portraits never stand in), no profile link, no place in the directory, search, avatar rows, pickers or the access list; the profile route shows "Former member"; a conversation is read-only for the other person, who cannot start a new one. Former members get no new notices, recognition, roles or grants and cannot be restored.
- **Migration `0015_account_deletion.sql` (additive).** While a transaction is marked as the acting person's own deletion (`app.account_deletion`), policies admit their memberships of any status, their instructor grants and their knowledge-check attempts. A restrictive policy confines the runtime role's deletes on attempts to exactly that case, so it can never use the operator erasure from 0014. The runtime grant on attempts now keeps DELETE; rerun `npm run db:grant-runtime` after migrating. Migrations 0001 to 0014 are byte-identical.
- No new runtime dependency. Release constant and package version are 0.15.0-alpha.1.

## Local verification, 3 October 2026

Node 22.22.0, npm 10.9.4, `npm ci` from the committed lockfile in a clean worktree of tested commit `67623fb`, Playwright with Chromium 141 at `/opt/pw-browsers/chromium` through `CHROMIUM_PATH`, PostgreSQL 16.14 in a disposable loopback cluster (CI uses PostgreSQL 17).

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm test` | 561 passed, 0 failed (544 existing plus 7 account-deletion domain, 4 database and 6 HTTP tests) |
| `npm run test:http` | 19 passed (17 existing plus 2 real Better Auth deletion checks: a wrong password and an owner are refused; a member deletes their account, after which their session, sign-in and workspace access are gone and their message reads as from a former member) |
| `npm run build`, `npm run bundle:preview` | Passed (existing chunk-size advisory on the single-file preview only) |
| Existing demo-browser suites | 265 passed: 85 regression, 17 operations, 29 project work, 27 authoring, 11 rich lessons, 19 resources, 16 assessments, 16 covers, 9 instructors, 16 monochrome, 20 v4 |
| `npm run test:browser:accounts` | 9 passed: the account page, the owner's refusal, the dialogue's checks and cancel, deletion and the farewell, the owner's view of the kept comment, conversation and team place as Former member, restarting after a second deletion, restarting straight after the first, and phone width, with axe and neutral-colour checks |
| Existing connected-browser suites | 49 passed: 12 connected, 9 resources, 9 assessments, 13 covers, 6 instructors |
| `npm run test:browser:accounts-connected` | 6 passed (live build, Better Auth cookies and password checks, API under the restricted runtime role): the member's page, a wrong password refused, the owner refused, deletion back to sign-in with a notice and the old password refused, and the owner's view of the kept post and read-only conversation |
| `npm run test:postgres` | 15 passed on PostgreSQL 16.14 (14 existing plus 1: a member, suspended in one community, deletes their account through the restricted runtime connection; answers, grants and personal records go, team places stay, and the owner is refused) |
| Python helpers, `scripts/check_research.py` | 35 passed (34 existing plus 1: a former member never shows a portrait); the register validates with 51 pinned sources and 17 decisions at the documentation commit (47 and 16 at the tested commit, before the review was recorded) |

Tests changed rather than added: eight migration-count assertions moved from 14 to 15. Five assertions that the runtime role's delete on attempts fails with "permission denied" now assert that it deletes nothing (in `assessments-database`, `operator-erasure-database` and the PostgreSQL check), because the role holds DELETE for a person's own deletion; new tests prove the policies refuse every other case, including another member's attempts with the mark set and the operator erasure path. The upgrade test now lists the three delete policies on attempts.

## Corrections made while verifying

- Deleting a person's project team places first failed a foreign key: kept contributions and proof-carrying tasks refer to them. Team places now stay with the work, shown as Former member.
- The repository first wrote the scrubbed membership with the other changes. Policies that require an active member would then have refused returning claimed tasks; the scrub is now the last write in each community.
- The first database test expected one reworded notice; three were right (the reply, and the contribution notices to the owner and the project lead).
- In a community where the person was suspended, their claimed tasks are invisible to them under row security and stay assigned. The test now records that limit explicitly instead of hiding it.
- A demo event in the fixture had already ended; the tests create a future one. The owner refusal on real PostgreSQL needed the owner's sign-in row; without it the account correctly reads as not found.
- Reviewing the diff after a first clean run of release commit `d21fdbf` (every step passed) found four more things, fixed in `886f967` and `67623fb`: the project page linked a former teammate to an empty profile, and now shows them without a link; rewording notices would also have reworded one that begins with a longer member name ("Jo Smith replied…" when "Jo" leaves), and now skips those; the dialogue said the account would be deleted "in" the communities the session lists, which leaves out any where the person is suspended, and now says every community, including those named; and restarting the demo straight after deleting the first persona did not force the page to look again. Each has a test. A second run was stopped when the last fix landed, so the tested commit is `67623fb`.

## Review fixes after PR #6 opened

CI passed on `7343bcf` (runs 37106724144 and 37106726124, both jobs green). The Codex review on `3f29c0d` then raised three findings, each confirmed and fixed with a test:

- **Invitations to communities the person never joined stayed.** Deletion removed invitations only in communities where the person had a membership, but a pending invitation is normally to a community they have not joined, and its queued mail was kept. Migration `0016_account_invitations.sql` (additive) lets the marked transaction see and delete invitations sent to the person's own account email in any community, and deletion now removes them account-wide after the community loop. The database test adds a pending invitation to a third community and another person's invitation there, which stays.
- **Older `left` memberships reached the browser in full.** `left` has been a valid status since the foundation schema, and the snapshot now included every `left` row for ordinary members. `visibleWorkspace` now sends every `left` membership as the scrubbed Former member record (`formerMember`, shared with the deletion rules), whatever its stored details. A domain test covers a member and an administrator viewing an unscrubbed `left` row.
- **An invitation accepted during a deletion could leave an active membership.** Acceptance now takes a share lock on the account row before locking the community, the same order as deletion, so it waits for a deletion under way and then finds no account. Deletion also rechecks the membership count before deleting the account. A new PostgreSQL check holds the deletion's account lock on one connection, starts an acceptance on another, and proves it waits, fails with `INVITE_ACCOUNT_MISMATCH` and adds no membership; with the share lock removed the same check fails (the acceptance completes at once).

Local runs on the fix commit `928a0ee`, Node 22.22.0, `npm ci`, PostgreSQL 16 in a disposable loopback cluster: typecheck passed; `npm test` 562 passed (one new domain test; the database test gained invitation assertions); `npm run test:http` 19 passed; build and preview passed; `npm run test:postgres` 16 passed (one new); `test:browser:accounts` 9, `accounts-connected` 6, `monochrome` 16, `v4` 20 and `connected` 12 passed; Python helpers 35 passed; the research register validates. The other browser suites were not rerun locally and run in CI. Nine migration-count assertions moved from 15 to 16.

## Not verified, and why

- Hosted Better Auth, real email delivery, a real bucket's object deletion and hosted PostgreSQL remain deferred by the user; deletion was exercised through PGlite and PostgreSQL 16 with the restricted role, a captured mail queue and an in-process storage stand-in.
- Ownership transfer does not exist, so owners cannot delete their accounts. Mentions inside other people's posts stay as written.
- A deletion that begins while an acceptance already holds the account lock waits for it and then deletes the new membership with the rest; that order relies on PostgreSQL's read-committed snapshots and is covered by reasoning and the membership recheck, not by a separate test. Claimed tasks in a community where the person was suspended stay assigned for an administrator.

## Preview

The demo runs inside this workspace with `VITE_DATA_MODE=demo npm run dev` at `http://127.0.0.1:5173`, reachable only from inside the container. Open the account menu → **Your account** → **Delete your account…**, type "delete my account", then choose **See the community as Amina Okafor** to see the kept comment on Common Ground, the read-only conversation and the team place as Former member; **Restart the demo** brings everyone back. Clone the branch and run `npm ci && npm run dev` from `platform/`.

## Publication receipt

Pending. The documentation for the first clean run was pushed as `3f29c0d`; this status, with the final run of `67623fb`, follows on the same branch, and the remote read-back and CI are recorded in the receipt.

Outcome, recorded in Alpha 16: PR #6 was merged into main as `cc806e7` with the owner's approval on 3 October 2026, a merge commit whose tree equals the tested head `b31b80a`.

## Next actions

1. Owner review of the account deletion pull request in the demo, then merge with the owner's approval and read back main.
2. Ownership transfer, so owners can hand over a community and then delete their account.
3. Server-side pagination for review queues and other long lists.
4. When deployment resumes: Neon staging with sixteen migrations and runtime grants, Vercel live mode, bucket setup (SETUP.md section 6), then hosted privacy tests, including account deletion against hosted Better Auth.

---
## Historical Alpha 14 evidence: learner records

3 October 2026. Application 0.14.0-alpha.1. Members download their own learning record from their profile. Operators can erase a learner's knowledge-check answers on a request an active owner authorised, and clear unused cover files. Review queues show 20 at a time with exact totals. See LEARNER_RECORDS.md and decisions/014-learner-records.md.

## Status at a glance

| Item | State |
| --- | --- |
| Implemented | Yes, on `claude/laughing-goodall-2p7z0v` ([PR EmotiveImpact/REUNIR#5](https://github.com/EmotiveImpact/REUNIR/pull/5)), after Alpha 11 to 13 on the same branch |
| Verified locally | Yes: every suite, from a clean worktree of tested commit `2252441` after `npm ci` (see below) |
| Verified remotely (GitHub Actions) | Yes: both jobs passed on `d52fbcd` in the push and pull request runs (publication receipt below) |
| Merged | Yes: approved by the owner on 3 October 2026 and merged into main as `661fac9` after CI passed on the receipt head; recorded in the Alpha 15 status above |
| Deployed | No. No Neon database, Vercel project, bucket, sender or scheduler was created |
| Operated with real members | No |

## What changed

- **Your learning record.** A profile panel downloads a dated JSON file of the member's own tracks, completed lessons, knowledge-check attempts (answers, results, marks, feedback, reviewer) and mission work in that community, from `GET /api/organisations/:slug/me/learning-record` (attachment, `no-store`) or, in the demo, built in the browser. It includes every record that is the member's own, but titles, names and answer keys follow the member's own view.
- **Owner-authorised erasure.** `npm run db:erase-learner` (migration connection, `AUTHORISED_BY` an active owner, `ERASURE_REFERENCE`, dry run unless `ERASE=yes`) erases one member's attempts and the feedback notices about them, refuses a partial erasure, bumps the revision and audits the reference and counts only. Migration `0014_operator_erasure.sql` (additive) adds one delete policy on attempts that admits only the member named in `app.erasure_subject` when the acting user is an active owner, so forced row security still applies to a migration role without bypass. The runtime role still has no DELETE on attempts. Migrations 0001 to 0013 are byte-identical.
- **Unused cover files.** `npm run db:prune-covers` lists cover and library uploads nothing shows or lists that were rejected or are over an hour old; `PRUNE=yes` deletes stored files first, then only records still unused.
- **Paged review queues.** 20 at a time, waiting answers oldest first, exact totals beside each heading, focus moved to the first new item. The scored and reviewed lists no longer stop at 30 or report 30 as their count.
- No new runtime dependency. Release constant and package version are 0.14.0-alpha.1.

## Local verification, 3 October 2026

Node 22.22.0, npm 10.9.4, `npm ci` from the committed lockfile in a clean worktree of tested commit `2252441`, Playwright with Chromium 141 at `/opt/pw-browsers/chromium` through `CHROMIUM_PATH`, PostgreSQL 16.14 in a disposable loopback cluster (CI uses PostgreSQL 17).

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm test` | 544 passed, 0 failed (529 existing plus 6 learning-record domain, 3 learning-record HTTP and 6 erasure database tests) |
| `npm run test:http` | 17 passed |
| `npm run build`, `npm run bundle:preview` | Passed (existing chunk-size advisory on the single-file preview only) |
| Existing demo-browser suites | 249 passed: 85 regression, 17 operations, 29 project work, 27 authoring, 11 rich lessons, 19 resources, 16 covers, 9 instructors, 16 monochrome, 20 v4 |
| `npm run test:browser:assessments` | 16 passed (14 existing plus 2): the learner downloads their own record with every attempt, mark and piece of feedback, and keys only where unlocked; a queue of 45 fictional waiting answers opens 20 at a time, oldest first, with exact counts, and focus moves to the new answers |
| Existing connected-browser suites | 40 passed: 12 connected, 9 resources, 13 covers, 6 instructors |
| `npm run test:browser:assessments-connected` | 9 passed (8 existing plus 1): the learner downloads their own record through the live API with Better Auth cookies; other communities and visitors cannot |
| `npm run test:postgres` | 13 passed on PostgreSQL 16.14, including the owner-authorised erasure through a role without row-security bypass. A 14th check, for clearing unused cover files, was added in the following test-only commit and passed on PostgreSQL 16.14 too |
| Python helpers, `scripts/check_research.py` | 34 passed; the register validates with 47 pinned sources and 16 decisions at the documentation commit (42 and 15 at the tested commit, before the Alpha 14 review was recorded) |

Tests changed rather than added: eight migration-count assertions moved from 13 to 14. No business assertion was weakened.

## Corrections made while verifying

- The first export built everything from the member's visible view, which silently dropped their own enrolments and attempts on a track that had since been unpublished. The record now takes every record that is the member's own from the full state of their community, and only titles, names and answer keys from their view.
- Without migration 0014, an erasure run as a hosted migration role (no superuser, no row-security bypass) would have deleted nothing, because attempts have forced row security and had no delete policy. A throwaway database with the policy dropped confirmed the command now refuses rather than reporting success.
- A test expected a non-member to get 403 for the record; the API answers 404 to non-members everywhere, so as not to reveal that a community exists, and the test now says so.
- The queue paging check first injected its fictional state into the standalone preview's storage, which a loaded page replaced; the check now serves the same preview at a stand-in address inside the browser, where storage works normally.
- Reviewing the diff before pushing showed the cover pruning methods were covered on PGlite only. A real PostgreSQL check was added after the clean run, in test-only commit `440c1b7`, and passed on PostgreSQL 16.14; CI runs it on PostgreSQL 17.

## Not verified, and why

- Hosted behaviour on Neon and Vercel, a real bucket's deletion permissions for `db:prune-covers`, email and backups remain deferred by the user. The operator commands were exercised through the repository methods and a PostgreSQL role without bypass, not against a hosted database.
- Account deletion, identity scrubbing and reviewers' notices that name a learner are outside this slice.
- Queue paging is in the interface; attempts still arrive in the bounded workspace snapshot.

## Preview

The demo runs inside this workspace with `VITE_DATA_MODE=demo npm run dev` at `http://127.0.0.1:5173`, reachable only from inside the container. Open your profile from the account menu and choose **Download your learning record**; Preview as admin and open Community studio → Knowledge checks for the queue. Clone the branch and run `npm ci && npm run dev` from `platform/`.

## Publication receipt

Pushed to `claude/laughing-goodall-2p7z0v` ([PR EmotiveImpact/REUNIR#5](https://github.com/EmotiveImpact/REUNIR/pull/5)). The remote ref was fetched back and matched the local commit and tree: head `d52fbcddf9f16a738c279d826ebf8e1ae97a84ad` (tree `6d6e0d5d7172395b41f98b2e51c1abe299b36c67`), which is tested commit `2252441`, the test-only PostgreSQL check `440c1b7`, documentation and the source manifest.

Both jobs passed on that head in [run 37100233918](https://github.com/EmotiveImpact/REUNIR/actions/runs/37100233918) (push) and [run 37100236985](https://github.com/EmotiveImpact/REUNIR/actions/runs/37100236985) (pull request). The application job ran the research checker, typecheck, all application tests, 17 HTTP checks, both builds, every demo-browser suite including the record download and queue paging, every connected-browser suite including the live download, and the Python helpers; the PostgreSQL 17 job ran the 14 restricted-role checks, including erasure and cover pruning through a role without row-security bypass.

This receipt commit changes only documentation and source hashes. The owner approved merging PR #5 into main once CI is green.

## Next actions

1. Merge PR #5 (Alpha 11 to 14) into main as the owner approved in the demo; merge only with the owner's approval, then read back main.
2. Account deletion and identity scrubbing across communities, designed for shared accounts.
3. Server-side pagination for review queues and other long lists.
4. When deployment resumes: Neon staging with fourteen migrations and runtime grants, Vercel live mode, bucket setup (SETUP.md section 6), then hosted privacy tests.

---
## Historical Alpha 13 evidence: cover library

3 October 2026. Application 0.13.0-alpha.1. Covers can come from a community cover library as well as an upload. Owners and administrators keep up to 24 named pictures in Community settings; anyone who may change a track or project cover chooses one in the cover dialogue, with its own focal point, without copying it. A picture stays in the library while any cover shows it. See COVERS.md and decisions/013-cover-library.md.

## Status at a glance

| Item | State |
| --- | --- |
| Implemented | Yes, on `claude/laughing-goodall-2p7z0v` ([PR EmotiveImpact/REUNIR#5](https://github.com/EmotiveImpact/REUNIR/pull/5)), after Alpha 11 and Alpha 12 on the same branch |
| Verified locally | Yes: every suite, from a clean worktree of tested commit `208e9be` after `npm ci` (see below) |
| Verified remotely (GitHub Actions) | Yes: both jobs passed on `be9c6c8` in the push and pull request runs (publication receipt below) |
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

Pushed to `claude/laughing-goodall-2p7z0v` ([PR EmotiveImpact/REUNIR#5](https://github.com/EmotiveImpact/REUNIR/pull/5)). The remote ref was fetched back and matched the local commit and tree: head `be9c6c89b5d62051396480bd752c9fa190739abc` (tree `5ac771fdbbca619dc310589a43a5e2facea5b25d`), which is tested commit `208e9be` plus documentation and the source manifest.

Both jobs passed on that head in [run 37098543959](https://github.com/EmotiveImpact/REUNIR/actions/runs/37098543959) (push) and [run 37098546160](https://github.com/EmotiveImpact/REUNIR/actions/runs/37098546160) (pull request). The application job ran the research checker, typecheck, all application tests, 17 HTTP checks, both builds, every demo-browser suite including the cover library, every connected-browser suite including the cover library under the restricted runtime role, and the Python helpers; the PostgreSQL 17 job ran the 12 restricted-role checks, including the library.

This receipt commit changes only documentation and source hashes. Merging into main needs the owner's approval.

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
