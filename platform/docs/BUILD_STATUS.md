# Alpha 08 rich lessons: implementation checkpoint

2 October 2026. Built from merged main `6238d7b` on `feat/creator-rich-lessons`.

Implemented: Tiptap rich editor using existing shadcn controls; bounded JSON validation; escaped React rendering; opt-in public image/video loading; server-derived text; private preview, explicit publish and rich/plain revision restoration. Additive migration 0008; earlier migration bytes unchanged. Details: RICH_LESSONS.md.

Local verification: 383 application/database/API/rendering tests passed; TypeScript, production build and standalone preview passed. The tsx CLI IPC listener is blocked, so tests used the equivalent Node loader command. Chromium download failed with a truncated archive; browser/HTTP/actual PostgreSQL gates are pending remote CI for this source.

Publication: PR #2, remote source fetched and tree-verified. CI on bdcaa89 passed PostgreSQL, application, HTTP, builds and existing community/project/authoring browser suites. The new rich browser test caught adjacent media replacement; the follow-up fix inserts after the selection and adds an explicit retention assertion. Full CI rerun pending. Merge: pending. Deployment: explicitly deferred by user; no Neon/Vercel/email/scheduler provisioned.

---
## Historical Alpha 07 evidence

# REUNIR Alpha 07: approved v4 integrated into the application

2 October 2026. Application 0.7.0-alpha.1, PRD 0.8. Local engineering release. The user-approved design is implemented in the existing React application, not just the reference HTML.

## Delivered

The app now has the v4 two-level community/navigation shell; no search or community switcher in the second sidebar; one top-right account portrait/menu; no duplicate bottom account controls; natural demo portrait images with safe neutral fallbacks; Lucide icons, neutral surfaces, restrained borders and white/outline controls. Home preserves the editorial heading and photographic hero, but its progress, goals, projects, activity and outputs come from the existing authorised workspace. Past fixture events are not presented as upcoming.

Three actual shadcn registry-source adaptations are included: Button, Avatar and Dropdown Menu, with full MIT attribution, pinned Radix primitives, class-variance-authority and Tailwind utilities through Vite. Unused upstream subcomponents are not imported. Existing native-dialog forms remain; there is no claim that every control in the legacy application has been converted to shadcn.

The previous community, learning, mission proof, purposes/paths/private goals, project workboards/contribution review, outcomes/outputs, messaging, access management and Creator Studio routes remain. The seven SQL migrations are byte-identical to the Alpha 06 baseline. The shared release label changes, but API/domain authorisation and data semantics are unchanged. No new backend service is introduced.

## Publication follow-up: 2 October 2026

The full application was published in [PR #1](https://github.com/EmotiveImpact/REUNIR/pull/1), branch `integration/alpha07-source-2026-10-02`, at `5e88b30675832fcedfb0a26491484851d951dd59`. Its complete Git tree `5b9d79453d07c75f5d71e0374889d945a3ee1eb8` exactly matches recovered checkpoint `76b31ab787029126e6462f747f7127a224212899`. All 240 tracked files are present, including nine binary image assets. A Git fetch followed by a tree diff and 239-file manifest verification passed. No newer application or open PR was found among the earlier remote branches.

Fresh local verification: 369 application tests, 32 Python helper checks, TypeScript and production build passed. The tests used `node --import tsx --test --test-concurrency=1 tests/*.test.ts` because this workspace disallows the optional tsx CLI IPC socket. The test files and assertions were unchanged. HTTP/browser/PostgreSQL checks run in GitHub Actions because local sockets are denied and the Playwright browser download failed.

The first full remote run [36964413876](https://github.com/EmotiveImpact/REUNIR/actions/runs/36964413876) passed all 369 application tests, 17 HTTP checks, both builds, all 193 demo-browser checks and the six real PostgreSQL checks. Connected browser verification passed four checks before an exact accessible-name lookup failed on the new-password field. Its helper text was being included in the field's name. The follow-up gives the field an explicit label and links the password guidance as its accessible description, retaining both the visible design and the exact-name test. Both signup and reset now also assert the description. No authentication rules or migrations were changed.

The complete [follow-up CI run 36964804738](https://github.com/EmotiveImpact/REUNIR/actions/runs/36964804738) passed on `75b3f2ba23261dda10032eb621220a3e0b670262`: 369 application tests, 17 HTTP checks, 193 demo-browser checks, all 12 connected-browser checks, 32 Python helper checks, six real PostgreSQL checks, TypeScript and both builds. Both required jobs succeeded. The connected journey now verifies real HTTP sign-in, invitation account creation, message persistence, password recovery/reset and used-invitation rejection, with captured email and a disposable local database. This does not establish external email delivery or hosted Neon/Vercel behaviour.

The documentation receipt following that tested commit changes no application, test, dependency or migration files. Current merge status and final checks are linked from [PR #1](https://github.com/EmotiveImpact/REUNIR/pull/1). The initial failed run is retained as evidence rather than counted as a complete pass.

No deployment, real sender or scheduler has been configured in this publication work. Connected pilot gates remain separate from the repository integration.

## Completed verification in the saved Alpha 07 release

| Check | Result |
| --- | --- |
| Full domain/database/API suite | 369 passed, 0 failed/skipped/cancelled |
| Existing community browser journey | 24 passed |
| Existing purpose/progress browser journey | 34 passed |
| Existing messages/access browser journey | 27 passed |
| Existing pilot-operations browser journey | 17 passed |
| Existing project-work browser journey | 29 passed |
| Existing creator-authoring browser journey | 27 passed |
| Existing monochrome browser journey | 15 passed |
| New v4 integration browser journey | 20 passed |
| Total completed fictional demo-browser checks | 193 |
| Actual local Node HTTP integration | 17 passed |
| Publication/research/design helper checks | 32 passed |
| Strict TypeScript, deployment build, standalone preview | Passed |
| Research register | 9 pinned sources, 9 linked decisions |

The new browser checks cover mounted shadcn primitives, two-level navigation, one account menu, photo loading, genuine evidenced progress, creation/search/profile actions, authorised management, mobile switching, keyboard menu/drawer focus and Escape, empty future calendar, no overflow at 360/390/640/768/999/1000/1200px and no uncaught JavaScript exceptions. Automated accessibility scans passed on the tested Home, account-menu and mobile drawer states, as well as retained feature states. This is not an accessibility certification.

## Corrections made while verifying

Historical browser selectors were updated to the intentionally moved account/search controls; functional authorisation and data-mutation assertions were retained. The original Events fixture dates are now in the past, so the historical event journey fixes Date to 24 September 2026. A separate current-design check confirms that the real Home shows an honest empty calendar once fixtures are past. The application itself does not freeze time.

Avatar accessibility semantics were corrected by labelling the image role instead of an anonymous span. The account menu uses Radix's supported non-modal mode: its actions are a menu, not a dialog that hides the rest of the page. The initial menu scan found focusable content in an aria-hidden app shell; the final menu/drawer scans pass without suppressing that rule.

One parallel operational browser run reported a browser target crash at its mobile accessibility scan. Its partial checks are not counted. The complete operational suite was rerun alone and passed all 17; the interrupted log is retained separately.

## Verification boundaries and historical blockers in the saved release

The demo-browser tests run the actual compiled React against fictional local state. HTTP tests run the real Node/Hono/Better Auth path with local PGlite and captured mail. They are not Neon pooling/concurrency, production email receipt, public hosting or backup/restore proof.

The connected-browser test was attempted and was blocked at navigation to the loopback HTTP server with ERR_BLOCKED_BY_ADMINISTRATOR, before its first check. The policy was not disabled or bypassed. That attempt is recorded separately, not included in 193 or 17. A disposable real-PostgreSQL CI job exists, but it has not run in this pass.

At the saved-release checkpoint, only dependency-resolution workflows had run remotely and source publication was blocked by DNS. The publication follow-up above supersedes that source-delivery blocker and records current remote verification; the older test evidence remains provenance for the recovered build.

No live Neon database, Vercel deployment, Google bucket, production sender or scheduler was changed. The package is a source/preview release, not a hosted pilot.

## Distribution and remaining work

Read RELEASE_METADATA.json alongside the source ZIP/bundle for the final commit, exact manifest count and recovery verification. The updated roadmap, entire product doctrine, design direction, research register and handover are included. Dependencies, private environment files, databases and font binaries are excluded.

The split deployment build remains under the default large-chunk threshold (largest JS chunk approximately 347 kB before gzip). The intentionally single-file offline preview retains a size advisory, and existing dependency annotation warnings remain. Neither build is a performance benchmark or dependency security audit.

After PR #1 is merged, the next gate is to operate the intended invitation-only Code Black staging pilot with verified accounts, email, privacy and restore. Next product work: richer lesson authoring/private resources, scalable paginated reads, notification preferences and account/trust operations. Commercial billing and the longer-term contribution/mentorship/AI vision remain in ROADMAP.md, not falsely marked complete.
