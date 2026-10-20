# Ferven

**Purposeful communities: people, purpose, progress, projects and proof.**

Ferven is where people come together to become something, build something or achieve something. A community holds discussions, learning tracks with rich lessons, files, video and knowledge checks, private goals, projects with shared task boards, reviewed contributions and outcomes, events and private messaging. Code Black is the first community; Ferven is the reusable platform. The repository keeps the working name REUNIR.

- **Try the demo:** https://ferven.vercel.app runs on fictional data kept in your browser. Do not type real private information into it.
- **Status:** built and tested, not yet launched. No hosted database, email sender or file storage has been switched on, and no real member has used it. [BUILD_STATUS.md](platform/docs/BUILD_STATUS.md) lists what is verified and what is not.
- **Before changing anything:** read [AGENTS.md](AGENTS.md) and [SESSION_HANDOFF.md](SESSION_HANDOFF.md). The product direction is in [PRODUCT_DOCTRINE.md](platform/docs/PRODUCT_DOCTRINE.md) and the approved interface in [UI_DESIGN_DIRECTION.md](platform/docs/UI_DESIGN_DIRECTION.md).

## Run locally

Use Node 22.12 or later:

```sh
cd platform
npm ci
VITE_DATA_MODE=demo npm run dev   # http://127.0.0.1:5173
```

Demo mode needs no credentials. Connected mode needs the database and sign-in configuration in [SETUP.md](platform/docs/SETUP.md); it never falls back to fictional data. The steps for a private staging site are in [STAGING_LAUNCH.md](platform/docs/STAGING_LAUNCH.md).

## How it is built

React and Vite for the web app, Hono for the API, Better Auth for accounts and PostgreSQL for data, all in `platform/`. Every community's data is separated by row-level security under a restricted database role. The interface is black, white and neutral grey, using shadcn/Radix components and Lucide icons.

The 38 migration files in `platform/packages/db/migrations` are additive: each release adds tables or columns and never changes an earlier file. Each feature has its own document in `platform/docs/` and a decision record in `platform/docs/decisions/`.

## Checks

From `platform/`: `npm run check` (typecheck, tests and build), `npm run test:http`, `npm run bundle:preview` and the `npm run test:browser:*` suites. GitHub Actions also runs the real PostgreSQL and connected-browser checks on every pull request. From this folder, `python3 -m unittest discover -s scripts -p 'test_*.py'` checks the design, publication and research helpers, and `python3 scripts/publish_source.py` verifies the source manifest.

## History

The complete source was first published in [PR #1](https://github.com/EmotiveImpact/REUNIR/pull/1) (commit `5e88b30`, identical to the recovered Alpha 07 checkpoint `76b31ab`). Every release since has its own pull request; [CHANGELOG.md](CHANGELOG.md) lists them and `platform/docs/history/` keeps the earlier status notes. The other old branches on GitHub hold transfer and dependency material, not the application.
