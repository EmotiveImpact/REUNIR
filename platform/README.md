# REUNIR platform

Current release: 0.12.0-alpha.1, track instructors. Start with the repository root README, SESSION_HANDOFF.md and docs/BUILD_STATUS.md; docs/INSTRUCTORS.md describes the newest feature and docs/COVERS.md the one before it. The Alpha 05 notes below are kept as history.

```sh
npm ci
npm run dev                      # fictional demo, no credentials (VITE_DATA_MODE=demo)
npm run typecheck && npm test
npm run test:browser:assessments # set CHROMIUM_PATH if Playwright's browser is not installed
```

# REUNIR platform · Alpha 05

New in this release: project workspaces at /projects/:id/work. Assignment, criteria, notes and reviewed task proof extend the existing domain. See docs/BUILD_STATUS.md and docs/decisions/005-project-workspaces.md for exact behaviour and limits. No new runtime dependency.

```sh
npm ci
npm run typecheck
npm test
npm run build
npm run bundle:preview
npm run test:browser:work
python3 ../scripts/check_research.py
```

The browser command needs an installed Playwright Chromium or CHROMIUM_PATH. The self-contained preview uses fictional browser-local data. Live mode still requires separately configured PostgreSQL/Neon, authentication origin and operations.

# REUNIR · Alpha 05

**People + Purpose + Progress + Projects + Proof.**

The existing purposeful community application now has an owner-only Pilot console, safer email claims, stronger runtime guards and a verified release handover. This is a local engineering alpha, not a deployed service.

## Start the application

```sh
cd REUNIR/platform
npm ci
npm run dev
```

Node 22.12 or later. Open the local Vite address printed in the terminal. Default demo mode uses fictional browser-local data. For the zero-install evaluation, open ../REUNIR-preview.html. Never enter confidential information into the demo. Connected API failures never substitute demonstration data.

## Explore this wave

Use **Preview as admin → Pilot console**. Filter observed/blocked/unverified checks, review the delivery-watch panel and export a redacted report. The demonstration does not report a live database or successful email service. Returning to member mode removes operations navigation. Only an actual community owner has connected access, not arbitrary administrators.

The existing Home, discussions, paths, lessons, missions, projects, contribution/outcome review, community outputs, private goals, inbox and member-access workflows remain available.

## Verify

```sh
npm run typecheck
npm test                         # 276 application tests
npm run test:http                # 17 real local HTTP checks; captured email
npm run build                    # split deployment build
npm run bundle:preview           # one-file offline demo, always fictional
npx playwright install chromium
npm run test:browser             # 85 retained demo-browser checks
npm run test:browser:operations  # 17 new console checks
python3 -m unittest discover -s ../scripts -p 'test_*.py' -v
```

Use CHROMIUM_PATH for a supported existing browser. The separate connected-browser gate is npm run test:browser:connected; it was blocked here by ERR_BLOCKED_BY_ADMINISTRATOR. A disposable loopback PostgreSQL CI gate is also supplied as npm run test:postgres. That job is not counted as passed locally. PGlite tests and captured email are not a Neon or real-delivery verification.

## Prepare a pilot

Read docs/RELEASE_GATES.md, SETUP.md, PILOT_OPERATIONS.md and SECURITY.md. `npm run pilot:check -- --json` performs redacted config inspection without network calls. Add --database for a read-only runtime-role check; --migrations uses the administrative credential solely in that CLI to compare history. It never applies migrations or deploys.

Migration 0005 and updated explicit grants are required. Keep migration/bootstrap credentials off the production runtime. Set VITE_DATA_MODE=live at build time. Configure a dedicated database, canonical HTTPS origin, separate random secrets, a verified sender and an approved schedule; then test real receipt, hosted cookies, cross-tenant privacy and restore.

No remote source push, main merge, Vercel deployment or Neon connection was completed. Root scripts/publish_source.py verifies source hashes and can prepare a non-destructive Git import; the Git bundle preserves the local release. The import helper stops on conflicting work and never force-pushes.

Known limits remain: no group chat/attachments, privileged MFA, account export/deletion, payment system or AI orchestration; bounded general workspace reads; attachments are an API adapter, not a completed member interface. The split deployed build no longer triggers the chunk-size advisory, while the intentionally single-file offline preview still does. See docs/BUILD_STATUS.md for exact evidence and remaining work.
