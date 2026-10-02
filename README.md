# REUNIR

**Purposeful communities: people, purpose, progress, projects and proof.**

The application includes the approved v4 interface in the actual React application, alongside community discussions, learning, private goals, projects, reviewed contributions, messaging and Creator Studio with rich lessons (Alpha 08), private lesson files (Alpha 09) and knowledge checks with reviewed feedback (Alpha 10). Code Black is the first community; REUNIR is the reusable platform.

The complete source was published in [PR #1](https://github.com/EmotiveImpact/REUNIR/pull/1). Publication commit `5e88b30675832fcedfb0a26491484851d951dd59` is byte-identical to recovered Alpha 07 checkpoint `76b31ab787029126e6462f747f7127a224212899`, with Git tree `5b9d79453d07c75f5d71e0374889d945a3ee1eb8`. The earlier transfer/dependency branches are historical material, not the application.

Read [SESSION_HANDOFF.md](SESSION_HANDOFF.md), [BUILD_STATUS.md](platform/docs/BUILD_STATUS.md) and [ROADMAP.md](platform/docs/ROADMAP.md) for current verification and remaining work. Read [AGENTS.md](AGENTS.md) before making changes. The full product direction is in [PRODUCT_DOCTRINE.md](platform/docs/PRODUCT_DOCTRINE.md).

## Run locally

Use Node 22.12 or later:

```sh
cd platform
npm ci
npm run dev
```

Demo mode needs no credentials and uses fictional browser-local data. Do not enter real private information. Connected mode requires the documented database and authentication configuration; it never substitutes fictional data on failure. Follow [SETUP.md](platform/docs/SETUP.md) and [RELEASE_GATES.md](platform/docs/RELEASE_GATES.md).

## Design and architecture

React/Vite, Hono, Better Auth and PostgreSQL remain the chosen stack. The approved design uses actual shadcn/Radix components, consistent Lucide icons, two-level navigation, one top-right account menu and natural portraits within neutral interface chrome. Preserve [UI_DESIGN_DIRECTION.md](platform/docs/UI_DESIGN_DIRECTION.md).

The nine migrations preserve the community, purpose/progress, messaging, operational, project-work, creator-authoring, rich-lesson and lesson-resource models. Tenant isolation, private goals/messages, draft publication and reviewed evidence remain product invariants.

## Verification and release

From `platform/`, run `npm run check`, `npm run test:http`, `npm run bundle:preview` and the browser suites listed in the handover. GitHub Actions also runs the real PostgreSQL and connected-browser gates. From this root, `python3 scripts/publish_source.py` verifies the source manifest, while `python3 -m unittest discover -s scripts -p 'test_*.py'` checks publication, research and design helpers.

Source publication is distinct from operating a live pilot. Neon/Vercel staging, actual email receipt, hosted privacy checks and backup/restore remain separate release work. Creator Studio supports rich lessons, safe external media and private lesson files with private drafts, explicit publication and immutable revisions. Assessments are the next slice (see [ROADMAP.md](platform/docs/ROADMAP.md)).
