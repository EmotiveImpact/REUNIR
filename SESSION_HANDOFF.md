# Ferven: session handover

Read this first, then AGENTS.md, platform/docs/BUILD_STATUS.md, platform/docs/PRD.md, platform/docs/PRODUCT_DOCTRINE.md and platform/docs/UI_DESIGN_DIRECTION.md before changing anything. Every earlier handover, slice by slice, is kept word for word in platform/docs/history/SESSION_HANDOFF_ALPHA_07_TO_65.md (and older files beside it).

## What this is

Ferven is a platform for purposeful communities: people come together to become something, build something or achieve something. Its framework is People + Purpose + Progress + Projects + Proof, and Code Black is the first community. The repository, package and internal settings keep the working name REUNIR; everything a person sees says Ferven.

The application lives in `platform/`: React and Vite for the web app, Hono for the API, Better Auth for accounts and PostgreSQL with row-level security for data. Keep that architecture.

## Where things stand

- **Source:** `main` on GitHub is the complete application. The latest releases are listed at the top of platform/docs/BUILD_STATUS.md with their pull requests and merge commits. Version 0.39.0-alpha.1.
- **Demo:** https://ferven.vercel.app redeploys from `main` on every merge. It runs on fictional data kept in the visitor's browser, so nothing typed there reaches a server.
- **Not launched:** no real staging site, database, email sender, scheduler, bucket or scan host has been created. Nothing has been used by real members.
- **Numbering:** the next free numbers are Alpha 67, decision 061 and migration 0052. Migrations are additive and earlier files never change.
- **How changes land:** one pull request per change, merged with a normal merge commit once GitHub Actions is green (approved by the owner on 3 October 2026). Never force-push. Restart the working branch from `main` after each merge.

## Run it

Use Node 22.12 or later.

```sh
cd platform
npm ci
VITE_DATA_MODE=demo npm run dev   # fictional demo at http://127.0.0.1:5173
```

## Checks

From `platform/`: `npm run typecheck`, `npm test`, `npm run test:http`, `npm run build`, `npm run bundle:preview`, every `npm run test:browser:*` script (set `CHROMIUM_PATH` when Playwright's own Chromium is not installed), and `npm run test:postgres` against a fresh, disposable loopback database named `reunir_ci`. From the repository root: `python3 -m unittest discover -s scripts -p "test_*.py"` and `python3 scripts/check_research.py`. GitHub Actions runs all of these on every pull request.

Habits that keep the checks green:

- After changing any font size, rerun `python3 scripts/phone_type.py` to regenerate `phone-type.css`.
- After a release, regenerate the source manifest with `python3 scripts/publish_source.py --write-manifest "<release name>"`.
- Interface colours stay black, white and neutral grey (UI_DESIGN_DIRECTION.md); the monochrome browser check and `scripts/test_design_contract.py` enforce it.

## Waiting on the owner

These need the owner's own accounts or spending, so they are prepared but not done. platform/docs/STAGING_LAUNCH.md lists every step and cost; credentials never go into chat or the repository.

1. **Staging site:** create Neon, Vercel, Resend and Google Cloud accounts, then follow STAGING_LAUNCH.md. The first round costs nothing within free limits.
2. **Uploads:** approve the scan host (about $22 a month) so files, covers and lesson video can be switched on.
3. **A domain** (about £10 a year) before inviting anyone other than the owner by email.

## What comes next

In order, once the owner is ready:

1. **Launch staging** and run the hosted checks the code cannot prove alone: real sign-up and email, two-person and two-community privacy, backups and a restore rehearsal (LAUNCH_RUNBOOK.md).
2. **Enforce the Content-Security-Policy** after a clean staging run; it is report-only until then.
3. **A small, consented Code Black pilot**, then let what members actually do decide the next features.

Product work that can continue without the owner, smallest first:

- Removing the last 5,000-row limits: posts are paged in SQL, but other collections still load into memory and refuse past 5,000 rows a table.
- Appeals against removal from a community (suspension and report appeals exist).
- Smaller picture copies for existing covers, and descriptions for library pictures.
- Parked until pilots ask: question banks and timers, distinct-visitor counts, public portfolios and credits across communities.

ROADMAP.md keeps the full record of what each release delivered and its limits.
