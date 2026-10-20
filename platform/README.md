# Ferven platform

The application: a React/Vite web app (`apps/web`), a Hono API (`apps/api`), shared contracts, domain rules and database code (`packages/`), migrations (`packages/db/migrations`), tests (`tests/`) and check scripts (`scripts/`). Version 0.39.0-alpha.1. Start with the repository root README and SESSION_HANDOFF.md; CHANGELOG.md lists every release, `docs/` holds a document per feature and `docs/decisions/` the reasoning behind each.

```sh
npm ci
VITE_DATA_MODE=demo npm run dev   # fictional demo, no credentials
npm run typecheck && npm test
npm run test:http
npm run build && npm run bundle:preview
npm run test:browser:v4           # one of the browser suites; set CHROMIUM_PATH if Playwright's Chromium is not installed
```

`npm run test:postgres` needs a fresh, disposable loopback database named `reunir_ci` and refuses anything else. Connected mode, migrations, the runtime database role and the owner account are covered in docs/SETUP.md; a private staging site in docs/STAGING_LAUNCH.md and docs/LAUNCH_RUNBOOK.md.

Earlier notes from this file (Alpha 05) are kept in docs/history/PLATFORM_README_ALPHA_05.md.
