# Alpha 15 account deletion

3 October 2026. Application 0.15.0-alpha.1. People delete their own account from **Your account**. As the owner decided, posts, comments and project work stay so conversations still make sense, shown as "Former member"; name, photo and profile go; private things and the person's own learning record are deleted; direct messages stay for the other person. Owners are refused until ownership can be handed over. See ACCOUNTS.md and decisions/015-account-deletion.md.

## Status at a glance

| Item | State |
| --- | --- |
| Implemented | Yes, on `claude/laughing-goodall-2p7z0v`, restarted from main `661fac9` after PR #5 was merged ([PR EmotiveImpact/REUNIR#6](https://github.com/EmotiveImpact/REUNIR/pull/6)) |
| Verified locally | Yes: every suite, from a clean worktree of tested commit `67623fb` after `npm ci` (see below) |
| Verified remotely (GitHub Actions) | Passed on `7343bcf`; the review fixes follow, with CI recorded on PR #6 |
| Merged | No. Merging into main needs the owner's approval |
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
