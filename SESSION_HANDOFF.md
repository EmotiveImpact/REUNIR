# Current continuation: Alpha 09 private lesson resources

Read AGENTS.md, platform/docs/BUILD_STATUS.md, LESSON_RESOURCES.md, ROADMAP.md and research/notes/14_LESSON_RESOURCES.md first. UI_DESIGN_DIRECTION.md remains authoritative. Continue the existing React/Vite + Hono + Better Auth + PostgreSQL application; do not rebuild completed features.

## Where the source is

- Base: main `016c16e51212f9a71aff3f9b18b311d209194d9d` (Alpha 08 rich lessons merged through PR #2). No newer remote work existed when this session started. The 12 other remote branches are either already merged (`feat/creator-rich-lessons`, `integration/alpha07-source-2026-10-02`) or historical transport and dependency material; none was merged or changed.
- This slice: branch `claude/stoic-euler-lx2zk7`, [PR EmotiveImpact/REUNIR#3](https://github.com/EmotiveImpact/REUNIR/pull/3). Tested commit `16f3071d645f6bae54fd5c42716e562ccd72e186` passed GitHub Actions runs 37060579827 and 37060617081 (application and PostgreSQL 17). The receipt commit after it changes documentation and hashes only. Main `788e5d7` merges PR #3, and its tree is identical to the PR head `a6d4adb` (read back 2 October 2026).
- Follow-up: branch `claude/laughing-goodall-2p7z0v`, built from main `788e5d7`, fixes the contrast of text on custom covers, returns the connected resources scan to the whole learner page and adds a custom cover check to the monochrome suite. Tested commit `43bdf4a`; not yet merged. See "Follow-up: custom cover contrast" in BUILD_STATUS.md.

## What is done

Private lesson resources are implemented and verified locally (see BUILD_STATUS.md for exact counts): ordered, named, described, replaceable and removable files that follow draft, preview, publication, capture and restore; verified uploads through the existing upload-intent API and Google Cloud Storage adapter; one download rule mirroring lesson, space, role and tenant access; restrictive RLS in depth; demo mode with browser-local bytes. Migration 0009 is additive, and 0001–0008 are unchanged.

## Run it

```sh
cd platform
npm ci
VITE_DATA_MODE=demo npm run dev   # fictional demo at http://127.0.0.1:5173
```

As admin (account menu, Preview as admin), open Paths & learning, From idea to first version, Creator studio, Choose one real problem, then Lesson files. As member, open the same lesson and download the sample worksheet. For PostgreSQL: apply migration 0009 with `npm run db:migrate`, then `npm run db:grant-runtime`.

Checks from `platform/`: `npm run typecheck`, `npm test`, `npm run test:http`, `npm run build`, `npm run bundle:preview`, every `npm run test:browser:*` script including `resources` and `resources-connected`, and `npm run test:postgres` against a disposable loopback database named `reunir_ci`. From the repository root: `python3 -m unittest discover -s scripts -p "test_*.py"` and `python3 scripts/check_research.py`. Set `CHROMIUM_PATH` when Playwright's own browser is not installed.

## Product invariants for the next slice

People + Purpose + Progress + Projects + Proof. Keep drafts private and publication explicit, revision history immutable, tenant isolation and role checks current, private goals and messages private. Downloads and attempts must not become engagement scores, reputation or credentials. Community review is not accreditation.

## Next

1. Assessments: quizzes, learner attempts, scoring and instructor feedback. Research Frappe Learning quizzes, ClassroomIO exercises and LearnHouse assignments at pinned commits first; extend the existing draft/publication/revision model and review conventions; additive migration 0010.
2. Custom cover contrast: done on `claude/laughing-goodall-2p7z0v`, and GitHub Actions run 37062824183 passed on `43bdf4a`. Merge it, then read back main.
3. Seeded `notes` cover: its text is 2.79:1, so full-page scans of the demo `/projects` page and the Notes project fail. It needs a decision on the seeded artwork; see BUILD_STATUS.md.
4. Deployment remains deferred by the user: bucket, Neon, Vercel, sender and scheduler are all unprovisioned.

---
## Historical Alpha 08 handover: Creator Studio 2 rich lessons

Read AGENTS.md, platform/docs/BUILD_STATUS.md, RICH_LESSONS.md and ROADMAP.md. UI_DESIGN_DIRECTION.md remains authoritative. Continue the existing React/Vite + Hono + Better Auth + PostgreSQL app.

## Verified delivery

Published source commit: `24eeebfdc14aefed457bdd513f378b65d6fd9be8` on `feat/creator-rich-lessons`, PR #2. The remote tree was fetched and compared with the local source. GitHub [run 36969054997](https://github.com/EmotiveImpact/REUNIR/actions/runs/36969054997) passed both application and PostgreSQL jobs.

383 application/database/API/rendering tests; 204 demo-browser checks (including 11 new rich lesson checks); 12 connected-browser checks; 17 HTTP checks; 32 helper checks; TypeScript and both builds passed. PostgreSQL CI exercised restricted-role rich publication/restoration and tenant isolation. Desktop/mobile screenshots were reviewed. The adjacent-media insertion issue and the browser-context harness issue are fixed.

This receipt changes documentation and source hashes only. Merge status is tracked in [PR #2](https://github.com/EmotiveImpact/REUNIR/pull/2); clone main after merge, or the feature branch before merge. No cloud database, Vercel deployment, mail sender or scheduler has been provisioned. The user will deploy and run hosted tests later. Apply migration 0008 before running this version against PostgreSQL. Next product slice: private resources with lesson/space access inheritance, then assessments.

---
## Historical Alpha 07 handover

# START HERE: REUNIR Alpha 07, approved v4 integrated

## What the user wants

The approved v4 visual design belongs IN the existing React application, not in another standalone mock. Preserve all existing work, keep pushing coherent source waves, and report what remains. The user explicitly requested merging appropriate completed work. Do not merge incomplete transfer/archive branches or overwrite concurrent work to satisfy the word "everything".

## Exact source to continue

The complete application is now on GitHub in PR #1, branch `integration/alpha07-source-2026-10-02`. Publication commit `5e88b30675832fcedfb0a26491484851d951dd59` has the exact same tree as recovered Alpha 07 `76b31ab787029126e6462f747f7127a224212899`: `5b9d79453d07c75f5d71e0374889d945a3ee1eb8`. It was fetched back through Git and compared with no differences. Use the latest verified remote branch, or main after the PR is merged. Do not repeat the source recovery/import or return to a transport branch. Earlier local history remains in the saved Alpha 07 bundle; the publication snapshot is parented to GitHub's original main.

Restore the accompanying `REUNIR-Alpha-07.bundle` into a fresh worktree, or use a later remotely verified complete source branch. Read `RELEASE_METADATA.json` beside the bundle for the final commit and hashes, then verify SOURCE_MANIFEST.json. Do not assume an old temporary folder or node_modules symlink will exist in a new conversation.

Baseline preserved: `e834a1742e9b7f8c741ff362ba5a2584b3cdabf8` (Alpha 06 monochrome, 206 source-manifest entries), itself built on the complete Alpha 06 creator checkpoint `a09cd7db8f71462328b68a3c49b52dae4299dd97`. The first new integration checkpoint is `bb1dc52`. Current local branch: `integration/v4-application-2026-10-02`. Do not treat an earlier checkpoint in this paragraph as the final release commit.

## Read before editing

AGENTS.md; platform/docs/BUILD_STATUS.md; PRODUCT_DOCTRINE.md; PRD.md; ROADMAP.md; ARCHITECTURE.md; UI_DESIGN_DIRECTION.md; CREATOR_AUTHORING.md; RELEASE_GATES.md; research/reuse-register.json and the relevant research-to-build note. Earlier handover/status are under platform/docs/history, for provenance only.

## Approved design

Far-left workspace rail; navigation-only second sidebar with NO search or community switcher; one top-right account portrait/menu; natural photo avatars, not coloured initials; no duplicate account blocks in sidebars. Neutral chrome, fine borders, clean white/outline buttons, proper Lucide icons, Inter-first UI and a restrained editorial Home heading. Keep the approved mountain and quieter hierarchy. Do not revive coloured tiles, side stripes, glitter, generic dashboards or another visual exploration.

Actual shadcn Button/Avatar/Menu source is now incorporated and attributed, with Radix primitives and Tailwind utilities. Not every legacy form/dialog has been converted. Shared styling carries into the existing routes, which still invoke the original domain/data model. Demo portraits are only for explicit fictional fixture IDs; no invented face is assigned to a connected user.

## Product invariants

People + Purpose + Progress + Projects + Proof. Preserve Become/Build/Achieve, private goals/messages, tenant isolation, current role checks, existing lesson completion evidence, immutable draft/publication history, task proof and separate community-review outcomes. No force-feeding progress metadata into arbitrary posts. All seven migration files remain byte-identical. No AI, funding or credential expansion during this UI slice.

## GitHub and deployment

Before publication, all 11 remote branches and open PRs were checked. Main was the README-only `551d7a2da3914080956372beced5f01debc898a8`; the other branches contained dependency/transport material and no newer application. Those branches were preserved. PR #1 now contains the normal complete source tree.

The current workspace can fetch GitHub but has no direct Git write credential. The authenticated GitHub connection published all 240 tracked files, including nine binary assets; every binary blob and the final complete tree were hash-verified. A subsequent Git fetch, exact-tree diff and all 239 manifest entries passed. Local verification reran 369 application tests, 32 helper checks, TypeScript and the production build. This workspace denies sockets and could not download Playwright Chromium, so HTTP/browser/PostgreSQL verification runs in GitHub Actions. Consult BUILD_STATUS.md for the recorded CI result. Never infer deployment from a source push or bypass a failed release gate.

No live Neon/Vercel/email/bucket/scheduler or production database was changed. Complete the existing staging/receipt/hosted-session/privacy/restore gates separately.

## Verification and continuation

Read BUILD_STATUS.md and the current release evidence for completed results and limitations. Browser demos exercise actual bundled React against fictional local state, not a live API. Node HTTP checks use local PGlite and captured email. Tests updated the intentionally moved control selectors, not their business assertions. The historical Events journey fixes Date to its September fixture period; a new v4 test verifies an honest empty future calendar.

Run from platform: npm ci; npm run typecheck; npm test; npm run test:http; npm run build; npm run bundle:preview; npm run test:browser; npm run test:browser:operations; npm run test:browser:work; npm run test:browser:authoring; npm run test:browser:monochrome; npm run test:browser:v4. The real PostgreSQL and connected-browser scripts require their documented disposable environments. Run the Python provenance/design/publication checks from the repository root.

Full application and PostgreSQL CI passed on `75b3f2ba23261dda10032eb621220a3e0b670262` in [run 36964804738](https://github.com/EmotiveImpact/REUNIR/actions/runs/36964804738), including all 12 connected-browser journeys. The receipt commit only updates documentation and manifest hashes. Check PR #1 for merge status; once merged, continue from main with connected Code Black pilot gates, followed by Creator Studio 2 and private resources. Keep release status current and inspect current main/PRs before starting concurrent work. Do not reconstruct or redesign the application from this summary when the real source is on GitHub.
