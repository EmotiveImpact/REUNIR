# Source-control handover · Alpha 03

The complete application is delivered in this REUNIR workspace. This release was recovered from the Alpha 02 archive and extended in the local working directory. No application push, pull request, main merge or remote application CI result is claimed.

The last live connector inspection of `EmotiveImpact/REUNIR` found:

- `main` at `551d7a2da3914080956372beced5f01debc898a8`: README only.
- `build/reunir-alpha-1` at `73a67a0ebd1f8aaae6116022f63a3622429e0a90`: preparatory toolchain workflow.
- `build/reunir-alpha-2` at `bfbb8c0df0f0c3fa668291d07736bd33888f1e07`: preparatory toolchain/asset workflows.

These are observations during this pass, not permanent facts about branches. Re-read the repository before publishing because another session or developer may have advanced them. Never force-push over new work or assume an empty default branch is still empty.

## Safe import into the real repository

1. Clone/fetch the current repository and inspect its branches, files and open pull requests.
2. Create a fresh integration branch from the appropriate current base. Copy the delivered `platform/`, `research/`, top-level README and `.github/workflows/ci.yml`, preserving unrelated current work. Do not overwrite existing workflows or application files blindly.
3. Review `git diff`, licence notices and secret exclusions. Install from `platform/package-lock.json`, run typecheck, all tests, build and all three demo browser suites and the HTTP smoke test. Do not commit dependencies, `.env`, local databases or generated credentials.
4. Commit and push the integration branch, run the supplied application CI, and open a reviewable PR. Merge only after reviewing both the migration and the actual runtime changes.

`REUNIR-preview.html`, the combined PRD and test screenshots are delivery conveniences; they need not all live in the main source tree. The archive's release manifest lists the handed-over files and checksums. A source-control upload is not a deployment, and a deployment is not a verified database migration.

The connector provides repository reads and individual text/blob Git writes. The complete workspace has not been uploaded through those calls. Shell Git networking could not resolve GitHub here. Do not mistake existing preparatory workflows for uploaded application source or a green application CI run.
