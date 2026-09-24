# REUNIR recovery and creator-authoring checkpoint

24 September 2026. **This branch is a recovery record, NOT the complete application source.** No main merge or application deployment is claimed.

## Latest complete source

The complete application has been saved in local Git and a verified full-history bundle:

- Local source branch: `build/creator-authoring-recovery`
- Final local source commit: `a09cd7db8f71462328b68a3c49b52dae4299dd97`
- First authoring implementation: `078f345f2d90c79eacca92a7aa1a8f56cbdb5c5a`
- Preserved Alpha 05 recovery checkpoint: `ccd2b67480ea89dc43009f27605c45144cbefdcd`
- Original recovered Alpha 05: `9ca7c715d9a599c3088f8bf9ddd96b492de590a4`
- Current source manifest: 203 verified files

**Latest complete bundle in the owner's ChatGPT Library:**

`/REUNIR/Recovery/REUNIR-Alpha-06-Recovery.bundle`

Size: 541,265 bytes.
SHA-256: `ec090c8c60db5767d7acd26355da69e78425eb1515be8d850e6433b090a4a12a`.

The bundle was cloned into a separate directory, its final commit was checked, and all 203 source manifest hashes verified. It contains the entire source/history, not just this note.

**Next-session handover in the same Library folder:**

`/REUNIR/Recovery/REUNIR-Alpha-06-SESSION-HANDOFF.md`

Read the bundle's `SESSION_HANDOFF.md`, `AGENTS.md`, `platform/docs/BUILD_STATUS.md` and `platform/docs/CREATOR_AUTHORING.md` before continuing. Library access belongs to the owner; these are not public download URLs.

## What survived and what did not

The complete delivered Alpha 05 source was recovered and its original 191 hashes verified. The earlier interrupted Alpha 06 attempt left a browser failure screenshot but no recoverable application source in the mounted files or retrieved Library results. GitHub branch `build/reunir-alpha-06` at `f542c763bae6aa5ccda02d6a50d0d13b5c7fa1a0` held only a dependency workflow and README.

The current creator-authoring implementation is NEW work on the verified Alpha 05 baseline. Earlier unverified Alpha 06 test totals have not been reused. The internal reason for ChatGPT's “Thinking failed” messages was not available.

## Newly implemented and tested

Owner/admin private lesson drafts; manual saving separate from live lessons; plaintext learner preview; explicit saved-version publishing; captured-existing and published revision history; restore-as-draft; draft archive/restore; version-checked complete curriculum reordering.

Migration 0007 adds normalised draft/history tables and deferrable curriculum uniqueness. Earlier migrations 0001–0006 are unchanged. Existing completion IDs/points are preserved, but they are not retrospectively revision-specific credentials. Runtime revision rows reject UPDATE and DELETE. No Tiptap/rich editor, donor application source or new runtime package was imported.

Completed verification:

- 369 application tests passed, including 41 new authoring checks.
- 158 fictional demo-browser checks passed: 131 retained plus 27 creator checks.
- 17 actual local Node HTTP checks passed, using PGlite and captured mail.
- 21 publication/research helper tests passed.
- TypeScript, split production build and standalone preview passed.
- Automated creator desktop/mobile accessibility scans returned no violations in the tested states; not certification.

Read BUILD_STATUS.md for failed attempts corrected and test boundaries. No live Neon, real PostgreSQL-service CI, hosted-browser/session acceptance, real email receipt, restore or production security verification is claimed.

## Full GitHub publication is STILL incomplete

A direct Git push of the source was attempted and failed DNS resolution for github.com. The connected GitHub tool can read/write text resources; this record was saved through it. **The full source tree and local source commit above have NOT been uploaded to this repository.** This note's remote commit is not the local application commit.

Do not start another long feature wave from the README-only remote main. Obtain the complete bundle, inspect current remote work and publish the actual source first. Do not replace unrelated concurrent work or force-push.

## Network-capable Git environment

```sh
git clone REUNIR-Alpha-06-Recovery.bundle REUNIR-recovered
cd REUNIR-recovered
python3 scripts/publish_source.py
python3 scripts/publish_source.py --prepare
```

The helper verifies hashes and prepares a fresh integration branch from the current remote main. It stops on conflicting existing files. After reviewing the source, its documented `--push` option commits, pushes and verifies the exact remote ref. It never force-pushes or merges main. The import commit may differ from the local checkpoint because it preserves the actual remote ancestry while importing the same verified source.

Then run application and PostgreSQL CI, review the branch, and separately complete the intended Neon/Vercel invitation-only pilot gates. A checksum match is not a test pass, a Git push is not a deployment, and a deployment is not verified recoverability.

## Preserved product direction

Keep React/Vite, Hono, Better Auth and PostgreSQL; People + Purpose + Progress + Projects + Proof; tenant isolation; private goals/messages; reviewed contribution evidence and additive migrations. REUNIR remains the working name. Do not restart the architecture or naming exercise during recovery.
