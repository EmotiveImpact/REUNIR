# START HERE: REUNIR Alpha 06 and monochrome continuation


## Latest continuation: read before the older observations below

27 September 2026. The full Alpha 06 baseline `a09cd7db8f71462328b68a3c49b52dae4299dd97` was restored and its 203 source-manifest entries verified. The current local branch is `build/alpha06-monochrome-2026-09-27`; use `git rev-parse HEAD` and the package's RELEASE_METADATA.json for its final commit.

This patch preserves the application and applies the user's black-and-white direction. Read `platform/docs/UI_DESIGN_DIRECTION.md`: the old PRD still specified coloured accents, and that contradiction is now corrected. The complete earlier long-form design brief was not retrieved verbatim; do not invent reference sites, shaders, new fonts or a locked logo.

The live GitHub branch inspection still showed the preparatory/recovery branches at their old commits. A direct full-source push failed with `Could not resolve host: github.com`. The GitHub tools exposed in this continuation support reads, not publication. No new remote branch, file, merge or deployment was created. The next builder must first establish an authenticated write-capable environment; do not spend another feature wave issuing status-only records and calling them source.

Read `platform/docs/BUILD_STATUS.md` for current and historical test boundaries. Use the included full-history bundle to restore the source if local files are absent. A new conversation does not inherit a guaranteed working directory. The roadmap, research register and doctrine remain in the source.

## What the user wants

Continue the existing application without a rewrite. Save/commit before more long work. Publish every coherent source wave to GitHub and accurately report local commits, remote publication, tests and deployment separately. Preserve enough context to move into another conversation without losing decisions.

REUNIR remains the working name. Do not restart naming, research or a ground-up application. Doctrine: **People + Purpose + Progress + Projects + Proof**. People join to become, build or achieve something. The community remains essential, but a consumption feed does not define the whole product.

## Recover the correct source

The latest accompanying Git bundle and source archive contain the complete application. In this delivery the active source directory was `/mnt/data/reunir-build`; a fresh session must inspect its actual mounted files instead of assuming this path survives. The owner's personal Library has `/REUNIR/Recovery/` recovery bundles and handover files. Retrieve the latest named recovery bundle through Files when not mounted. Do not replace it with the older Alpha 05 archive merely because that one is immediately visible.

Original full Alpha 05 source: `9ca7c715d9a599c3088f8bf9ddd96b492de590a4` (191 manifest files checked).
Local preservation commit: `ccd2b67480ea89dc43009f27605c45144cbefdcd`.
First new authoring commit: `078f345f2d90c79eacca92a7aa1a8f56cbdb5c5a`.
Current local branch: `build/creator-authoring-recovery`. Read `git rev-parse HEAD` and the delivered RELEASE_METADATA.json for its final head rather than treating this document's earlier checkpoints as the latest commit.

## GitHub: read this before claiming publication

Repository: `EmotiveImpact/REUNIR`.
Observed main: `551d7a2da3914080956372beced5f01debc898a8`, README only.
Observed `build/reunir-alpha-06`: `f542c763bae6aa5ccda02d6a50d0d13b5c7fa1a0`, dependency workflow and README only.
Remote recovery branch: `recovery/2026-09-24-source-checkpoint`; initial recovery-note commit `0033d22dcb061831bc5bff28f2e29d8de4e8f0cc`.

Those branches do not establish publication of the complete application. The full-source direct push failed because this container could not resolve github.com. The connected GitHub actions could read and write individual text resources; a recovery note was saved through them. Do not report that note as the full source, a merge or a deployed version. The internal cause of earlier “Thinking failed” turns was not available.

The owner's Library contains the complete preserved code. This is stronger than an interrupted conversation but is not a substitute for GitHub source publication. Publishing the full tree is the FIRST delivery task for the next network-capable coding session, before further feature expansion.

## Safe publication from a normal Git environment

For a new local copy, `git clone REUNIR-Alpha-06-Recovery.bundle REUNIR-recovered`. Enter that directory, then run `python3 scripts/publish_source.py` to verify source hashes. `python3 scripts/publish_source.py --prepare` clones current remote main into a fresh staging directory, creates an integration branch and stops on conflicting existing work. `--push` additionally commits, pushes and verifies the remote ref. It never force-pushes or merges main.

Review current remote work first. The helper imports source onto the real remote ancestry rather than assuming the recovered local history shares an ancestor with main. Its import commit can have a different ID while preserving every manifest file. Any conflict must be reconciled, not overwritten. Run actual CI and open a reviewable PR once the source is truly present. No automatic main merge is authorised.

## Implemented before this recovery

Alpha 01: community, learning, missions, projects, events, notifications, search and moderation.
Alpha 02: Purpose, Paths, Milestones, private member goals, contributions, reviewed outcomes, community outputs and proof-oriented profiles.
Alpha 03: invitations, password recovery, encrypted mail queue, participant-private one-to-one messaging, blocking/reporting and member administration.
Alpha 04: owner pilot console, production guards, runtime privilege checks, fenced email retries, route splitting and source recovery tooling.
Alpha 05: project workboards, assignments/claiming, completion criteria, team conversation, existing contribution review, archive/restore and research-to-build register.

The archive is the actual implementation, not just these descriptions.

## New creator slice

Application `0.6.0-alpha.1`. Owner/admin Creator studio at `/learn/:id/studio`.
Private drafts, manual save, live/publication separation, plain-text preview, explicit saved-version publication, immutable content snapshots, captured-existing attribution, restore-as-draft, archive/restore and version-checked curriculum order.

New files: `platform/packages/domain/src/authoring.ts`, migration `0007_creator_authoring.sql`, `platform/apps/web/src/pages/authoring.tsx`, two authoring test files, `platform/scripts/authoring-browser-check.ts` and `platform/docs/CREATOR_AUTHORING.md`. Existing contracts/repository/permissions, seed normalisation, route configuration and runtime grants are extended, not replaced.

Drafts/history are invisible to members and general search. Runtime row policies enforce active owner/admin and same-tenant access. Revision writes are append-only at the restricted runtime role. Restoration edits a draft, not the live lesson. Existing completion IDs and points stay intact; they are not retrospectively revision-specific credentials. The old owner/admin lesson.create command remains compatible. No Tiptap/rich editor or new runtime package was imported. The interrupted previous Alpha 06 source was not recovered; this is newly built work on Alpha 05.

## Verification

369 application tests; 158 completed fictional demo-browser checks (131 retained + 27 creator); 17 real Node HTTP checks using local PGlite/captured email; 21 helper tests; TypeScript and both builds passed. See BUILD_STATUS.md for failures corrected and limits. No live Neon, remote application CI, hosted-browser/session acceptance, real sender, restore or deployment proof. Do not inflate these counts into production certification.

Normal commands from platform/: `npm ci`, `npm run typecheck`, `npm test`, `npm run test:http`, `npm run build`, `npm run bundle:preview`, `npm run test:browser`, `npm run test:browser:operations`, `npm run test:browser:work`, `npm run test:browser:authoring`. Linux Chromium may be selected with CHROMIUM_PATH. `npm run test:postgres` needs its documented disposable real PostgreSQL service.

The interrupted runtime could not access the npm registry, so the prior verified uploaded dependency artifact was restored. No node_modules, environment secrets, local database or font binaries belong in the release. A dependency symlink may have existed locally; do not commit it.

## What to do next

1. Publish the FULL source and verify the remote ref and manifest, then run application/PostgreSQL CI. Do not repeat the prior workflow-only publication mistake.
2. Complete the intended Neon staging binding, migrations and least-privileged grants. Keep administrative credentials off the running application.
3. Configure Vercel live mode, sender/worker and invitation-only pilot; verify real email receipt, hosted sessions, two-tenant privacy and backup/restore. Leave unrelated projects alone.
4. Improve creator UX with a deliberately selected licensed editor and private media; preserve existing plain-text content and draft/publish/evidence semantics.
5. Then address pagination, privileged MFA, retention/export and richer learning. Do not drift into AI, payments or another architecture while the release gate remains open.

Always keep a local commit, a verified recovery artefact, exact remote status and updated handover before a long build or conversation change.
