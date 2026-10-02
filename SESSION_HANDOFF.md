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

Next: finish the verified integration, then connected Code Black pilot gates, followed by Creator Studio 2 and private resources. Keep release status current and inspect current main/PRs before starting concurrent work. Do not reconstruct or redesign the application from this summary when the real source is on GitHub.
