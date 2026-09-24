# REUNIR recovery checkpoint

24 September 2026. This branch is a recovery record, NOT the complete application source.

## Source safely recovered

The complete delivered Alpha 05 source was recovered from REUNIR-Alpha-05.bundle at commit `9ca7c715d9a599c3088f8bf9ddd96b492de590a4`. All 191 files recorded in SOURCE_MANIFEST.json matched their SHA-256 hashes. A new local recovery commit is `ccd2b67480ea89dc43009f27605c45144cbefdcd`.

A full-history bundle of that checkpoint was created and verified, and saved to the owner's ChatGPT Library at:

`/REUNIR/Recovery/REUNIR-Recovery-ccd2b674.bundle`

The conversation also contains the original REUNIR-Alpha-05.zip and REUNIR-Alpha-05.bundle. Do not discard either.

## Interrupted Alpha 06

The mounted remnants contain a browser failure screenshot, not the authoring application source. GitHub branch `build/reunir-alpha-06` at `f542c763bae6aa5ccda02d6a50d0d13b5c7fa1a0` contains only a dependency workflow and README. No Alpha 06 implementation or claimed Alpha 06 test totals have been verified in this recovery.

## Publication is NOT complete

Direct shell Git requests currently fail DNS resolution for github.com; api.github.com and raw.githubusercontent.com also fail DNS resolution. No standard GH_TOKEN/GITHUB_TOKEN is configured in the execution container. The GitHub connector can read and write individual text files, but the complete source archive has not been transferred by this checkpoint.

This document does not claim that the application, local Git commit, migrations or runtime were pushed. Main and existing branches are unchanged.

## Normal Git environment recovery

1. Obtain the verified bundle from the owner’s Library or this conversation.
2. `git clone REUNIR-Recovery-ccd2b674.bundle REUNIR-recovered`
3. `cd REUNIR-recovered`
4. Inspect the current remote branches before importing anything.
5. Use `python3 scripts/publish_source.py --prepare` to verify the manifest and stage a non-destructive source import, then use its documented `--push` option after review. It creates an integration branch and must not force-push or merge main.
6. Run application, HTTP, browser and real PostgreSQL CI. A checksum match is not a test pass, and a Git push is not a deployment.

The recovery note itself is an additional local file outside the original Alpha 05 manifest. The original 191-file source manifest remains intact.

## Product boundaries

Preserve React/Vite, Hono, Better Auth and PostgreSQL; People + Purpose + Progress + Projects + Proof; tenant isolation; private goals/messages; reviewed contribution evidence; additive migrations. No architecture rewrite or fabricated pilot readiness.

Next bounded product slice: creator authoring with private lesson drafts, preview, deliberate publication and revision history, preserving existing completion evidence. Save coherent commits and recovery artefacts before long test/build runs.
