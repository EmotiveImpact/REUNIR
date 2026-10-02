# Alpha 09 private lesson resources

2 October 2026. Application 0.9.0-alpha.1. Creators attach ordered, named and described files to lesson drafts, replace and remove them, preview them privately and release them by explicit publication. Learners download files only while they can open the lesson. See LESSON_RESOURCES.md and decisions/009-private-lesson-resources.md.

## Status at a glance

| Item | State |
| --- | --- |
| Implemented | Yes, on `claude/stoic-euler-lx2zk7`, built from main `016c16e` |
| Verified locally | Yes, every suite below, in this cloud workspace |
| Verified remotely (GitHub Actions) | Yes: runs 37060579827 (push) and 37060617081 (pull request) passed on `16f3071` |
| Merged | Yes: main `788e5d7` merges PR #3, and its tree is identical to `a6d4adb` (read back 2 October 2026) |
| Follow-up | Custom cover contrast on `claude/laughing-goodall-2p7z0v`, not yet merged; see "Follow-up: custom cover contrast" |
| Deployed | No. No bucket, Neon database, Vercel project, sender or scheduler was created |
| Operated with real members | No |

## What changed

- Migration `0009_lesson_resources.sql` (additive): upload intents gain purpose, track scope, completion time and verified generation; lessons, drafts and revisions gain a nullable `resources` list; a restrictive RLS policy limits lesson files to active authors or published references. Migrations 0001–0008 are byte-identical.
- The existing upload-intent routes accept `purpose: 'lesson_resource'`; completion checks size, type and file signature at a pinned generation; new routes serve signed downloads for lessons, drafts and revisions; `discard` deletes unreferenced uploads. The member-private upload flow is unchanged, apart from returning 409 instead of 500 when completion is called before the object exists.
- Creator Studio gains a file editor (add, name, describe, reorder, replace, remove, re-attach, discard); preview, learner lessons and revision history list files with downloads.
- The fictional demo keeps file bytes in the browser and attaches a generated sample PDF to "Choose one real problem".
- No new runtime dependency. Release constant and package version are 0.9.0-alpha.1 (the API constant had remained at 0.7.0 through Alpha 08).

## Local verification, 2 October 2026

Environment: Node 22.22.0, npm 10.9.4, `npm ci` from the committed lockfile, Playwright Chromium 1194 preinstalled at `/opt/pw-browsers/chromium` (used through `CHROMIUM_PATH`), PostgreSQL 16.14 in a disposable loopback cluster (CI uses PostgreSQL 17). Unlike the earlier workspace, loopback sockets and the tsx CLI work here, so the HTTP, connected-browser and PostgreSQL gates ran locally too.

| Check | Result |
| --- | --- |
| Baseline on main `016c16e` before changes | 383 tests, 17 HTTP, 204 demo-browser, 12 connected-browser, 7 PostgreSQL, 32 helpers, typecheck and both builds: all passed |
| `npm run typecheck` | Passed |
| `npm test` | 425 passed, 0 failed (383 existing plus 22 domain, 7 database and 13 HTTP/adapter tests for resources) |
| `npm run test:http` | 17 passed |
| `npm run build`, `npm run bundle:preview` | Passed (existing chunk-size advisory on the single-file preview only) |
| Existing demo-browser suites | 204 passed: 85 regression, 17 operations, 29 project work, 27 authoring, 11 rich lessons, 15 monochrome, 20 v4 |
| `npm run test:browser:resources` (new) | 19 passed, including real downloaded bytes, axe scans at desktop and 390px, overflow at 360/390px |
| `npm run test:browser:connected` | 12 passed |
| `npm run test:browser:resources-connected` (new) | 9 passed: live build, Better Auth sessions, PGlite, stand-in bucket on a second origin |
| `npm run test:postgres` | 8 passed, including the new restricted-role resource check |
| Python helpers, `scripts/check_research.py` | 32 passed; 18 pinned sources, 11 decisions |

Tests changed rather than added: the old-schema fixture now skips the new collection and column (its documented rule), three migration-count assertions moved from 8 to 9, the 0008 upgrade test also strips the new nullable column, and the HTTP storage double gained the two new adapter methods. No business assertion was weakened.

## Corrections made while verifying

- The database run showed that restricted-role RLS already hides a pending file from members, returning 404 before the role check. The domain now checks the author role first, so members get the same clear 403 in every mode.
- An object overwritten between the metadata read and the pinned signature read surfaced as a 500. It now returns a retryable 409 `UPLOAD_CHANGED` and leaves the intent pending.
- The connected harness navigated to the same hash URL without reloading, so the learner saw a cached workspace. The harness now reloads. Live mode refreshes every 30 seconds in normal use.
- A full-page axe scan of a newly created connected track flagged 6px decorative cover text at 4.25:1. The cover is `aria-hidden` and outside this slice, so the connected scan covers the lesson article, and the cover fix is queued as a separate task. The demo learner page with files passes a full-page scan. Resolved by the follow-up below: the connected scan covers the whole learner page again.

## Follow-up: custom cover contrast

Branch `claude/laughing-goodall-2p7z0v`, built from main `788e5d7`; tested commit `43bdf4a`. It resolves the cover finding above.

Tracks and projects created in the app get the `custom` cover. It has no art rule of its own, so it uses the default translucent shapes, and these cross the text on narrow covers, above all the track detail cover (285px wide above 1080px, 190px at or below, hidden at 760px and below). axe measured the 6px footer at 4.25:1 (`#ececec` on `#6f6f6f`) at every detail width, and the 9px label too at 1080px and below. axe approximates the rotated shape by its bounding box, so the rendered pixels behind the glyphs were also sampled: the footer fell to 3.44:1, the label to 2.77:1 and the large title to 2.77:1, where large text needs 3:1. Seeded tracks use named covers, which is why the demo suites passed.

- `styles.css`, `.art-custom` only: white lettering; the label and footer sit on the cover's own ground (`#5d5d5d`) with a 3px knockout and 2px radius, and the label hugs its text so the knockout stays local. Named covers and layout are unchanged. Neutral colours only, with no gradient and no recolouring of images.
- `resources-connected-check.ts`: the axe scan is no longer limited to `.lesson-content`, and the check is renamed "the connected learner page with files passes automated accessibility checks".
- `monochrome-browser-check.ts`: a new check creates a track through the real form, then runs the neutral colour check and full-page axe scans on its page at 1512px and 1000px.

Unless stated, every check below ran on `43bdf4a` in a clean worktree after its own `npm ci`, with Chromium 1194 through `CHROMIUM_PATH`.

| Check (from `platform/` unless stated) | Result |
| --- | --- |
| `npm ci`, `npm run typecheck`, `npm run bundle:preview`, `npm run build` | Passed |
| `npm test` | 425 passed, 0 failed |
| `npm run test:browser:monochrome` | 16 passed: the 15 existing checks plus the custom cover check |
| `npm run test:browser:v4` | 20 passed |
| `npm run test:browser:resources-connected` | 9 passed; the full-page scan reports no violations |
| Other demo-browser suites | 85 regression, 17 operations, 29 project work, 27 authoring, 11 rich lessons and 19 resources passed; 224 demo-browser checks in all |
| `npm run test:browser:connected` | 12 passed; 21 connected-browser checks in all |
| Negative controls: the same commit's tests with main's `styles.css` swapped in | The connected full-page scan and the new monochrome check both failed on `.cover-foot > span:nth-child(2)` at 4.25:1, as expected |
| Python helpers and `scripts/check_research.py`, from the repository root | 32 passed; 18 pinned sources, 11 decisions |
| `scripts/publish_source.py`, verify only, on this receipt commit | Every manifest hash matches |
| Contrast sweep: a scratch probe, not committed, run on the standalone build | Every cover type at 35 widths from 360px to 1640px on the track list, track detail, project list and project detail, with axe and with pixels sampled behind the glyphs. Custom covers before: 63 failing text samples and 51 axe violation nodes. After: none; worst footer and label 6.58:1, worst title 3.28:1. Named covers measured identically before and after |

Not rerun locally: `npm run test:http` and `npm run test:postgres`, because no server, database or migration file changed; GitHub Actions ran both. GitHub Actions [run 37062824183](https://github.com/EmotiveImpact/REUNIR/actions/runs/37062824183) passed on `43bdf4a`: the application job (typecheck, application tests, HTTP checks, both builds, 224 demo-browser checks including the new monochrome check, 21 connected-browser checks including the full-page learner scan, 32 helper tests, research checker) and the PostgreSQL job.

Outside this fix, and unchanged by it: the seeded `notes` cover (project "Notes from the process") pairs `#eaeaea` with `#8c8c8c` at 2.79:1, so full-page axe scans of the demo `/projects` page and of that project fail on its label, title and footer. No suite scans those pages. Pixel sampling also found named covers whose shapes lower text contrast in places without an axe violation: the `story` label and title, the `business` title, and the `still` title where it crosses the dark bar. These would change seeded artwork, so they are left for a separate decision.

## Not verified, and why

- Real Google Cloud Storage: signing is tested with the real SDK and a throwaway key offline; uploads and downloads use stand-ins. IAM, bucket CORS and real downloads need a configured bucket.
- Hosted behaviour on Neon and Vercel, real email and backups remain deferred by the user.
- No malware scanning or deep Office-file inspection exists.

## Preview

The demo runs inside this workspace with `VITE_DATA_MODE=demo npm run dev` at `http://127.0.0.1:5173`, which is reachable only from inside the container. This environment does not publish a public preview URL. Clone the branch (or main after merge) and run `npm ci && npm run dev` from `platform/`.

## Publication receipt

Pushed to `claude/stoic-euler-lx2zk7` at `16f3071d645f6bae54fd5c42716e562ccd72e186` (tree `7e33b8a84e25092123a89c2857cb14ef86670919`). The remote ref was fetched back and matched the local commit and tree exactly. Pull request: [EmotiveImpact/REUNIR#3](https://github.com/EmotiveImpact/REUNIR/pull/3).

GitHub Actions passed every job on that commit: [run 37060579827](https://github.com/EmotiveImpact/REUNIR/actions/runs/37060579827) (push) and [run 37060617081](https://github.com/EmotiveImpact/REUNIR/actions/runs/37060617081) (pull request), each with the application job (typecheck, all application tests, 17 HTTP checks, both builds, 223 demo-browser checks, 21 connected-browser checks, 32 helper tests, research checker) and the PostgreSQL 17 job (8 checks, including the restricted-role resource check). This receipt commit changes only documentation and source hashes; the merge into main is recorded in the pull request and in the next status update.

## Next actions

1. Done: this slice was merged as main `788e5d7`. Next, merge the custom cover follow-up on `claude/laughing-goodall-2p7z0v` (GitHub Actions passed on `43bdf4a`), then read back main.
2. Decide a treatment for the seeded `notes` cover (2.79:1) and add a demo scan of `/projects` and that project.
3. Build assessments: quizzes, learner attempts, scoring and instructor feedback, on the same draft, publication and revision model.
4. When deployment resumes: configure the private bucket (SETUP.md section 6), verify real signed uploads and downloads, then add scanning and an orphaned-object sweep.

---
## Historical Alpha 08 evidence: rich lesson authoring

2 October 2026. Actual Creator Studio rich editing, safe external media, private preview/publication and compatible rich/plain revisions. See RICH_LESSONS.md.

## Verified delivery

Published source commit: `24eeebfdc14aefed457bdd513f378b65d6fd9be8` on `feat/creator-rich-lessons`, PR #2. The remote tree was fetched and compared with the local source. GitHub [run 36969054997](https://github.com/EmotiveImpact/REUNIR/actions/runs/36969054997) passed both application and PostgreSQL jobs.

383 application/database/API/rendering tests; 204 demo-browser checks (including 11 new rich lesson checks); 12 connected-browser checks; 17 HTTP checks; 32 helper checks; TypeScript and both builds passed. PostgreSQL CI exercised restricted-role rich publication/restoration and tenant isolation. Desktop/mobile screenshots were reviewed. The adjacent-media insertion issue and the browser-context harness issue are fixed.

PR #2 was merged into main as `016c16e51212f9a71aff3f9b18b311d209194d9d`. This receipt changed documentation and source hashes only. Merge history: [PR #2](https://github.com/EmotiveImpact/REUNIR/pull/2); clone main after merge, or the feature branch before merge. No cloud database, Vercel deployment, mail sender or scheduler has been provisioned. The user will deploy and run hosted tests later. Apply migration 0008 before running this version against PostgreSQL. Next product slice: private resources with lesson/space access inheritance, then assessments.

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
