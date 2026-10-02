# REUNIR Alpha 05: project workspaces and research-led reuse

24 September 2026. Application 0.5.0. PRD revision 0.6. Local engineering release, not a hosted or launch-ready service.

## Delivered

A project workspace with board/list views, explicit assignment or self-claim, brief and completion criteria, optional target dates and priority, start/release actions, contextual team notes, version-checked changes, authorised task search/deep links and archive/restore. A task reaches Recognised only through the existing contribution review system. Requested changes and resubmission use the same contribution, preserving the existing path/milestone/outcome relationship rather than inventing another review/points engine.

Project overview, purpose-led Home, learning, missions, goals, contributions, outcomes, output archives, profiles, private messaging, member access and the owner console remain. New project work is a route within Projects, not a replacement application or a new compulsory top-level dashboard.

Two normalised tables and migration 0006 are added. Existing migrations 0001–0005 match the Alpha 04 archive byte-for-byte. The populated upgrade test leaves existing projects intact and creates no fictional tasks. Fresh demonstration seeds add four fictional tasks; earlier saved browser data gains empty collections and remains intact.

## Research and actual reuse

Selected source and documents from all six reference projects were re-read, including the official HumHub Tasks module. Exact repository paths, commit/blob pins, scope, decisions and implementation/test links are recorded in research/reuse-register.json. This is targeted source review, not a fresh comprehensive audit of all six codebases or their current HEAD commits.

HumHub task responsibilities/review states and Frappe's submission ownership/grade controls informed the slice. ClassroomIO reinforced the existing shared-validation and service boundary. OpenCircle/LearnHouse informed contextual typed conversation. Roost remains a combined-product reference with direct-import licensing evidence still on hold.

**Zero donor application source files and zero new runtime dependencies were imported in Alpha 05.** We reused the existing REUNIR contribution submit/resubmit/review handlers and React EvidenceReview component, tenant transaction, strict command validation, notification/outbox, membership checks, idempotency receipts and persistence driver. This is not a blanket ban on imports; a future copied file requires a pinned licence/notice/dependency decision. A new checker validates register links and is in supplied CI, which has not run remotely.

## Verification completed

| Check | Result |
| --- | --- |
| Recovered Alpha 04 baseline before changes | 276 application tests passed |
| Full application suite after changes | 328 passed, zero failures/skips/cancellations |
| New project work domain tests | 34 passed, included in 328 |
| New project work database/API/upgrade tests | 18 passed, included in 328 |
| Existing demonstration-browser journeys | 24 community + 34 purpose + 27 messaging/access + 17 operations = 102 passed again |
| New project work demonstration-browser journey | 29 passed |
| Total completed demonstration-browser checks | 131 passed |
| Existing real Node HTTP/socket integration | 17 passed again |
| Publication and research helper unit tests | 21 passed: 13 existing + 8 new |
| Research register structure/local-path check | Passed: 6 source entries and 6 decisions |
| Strict TypeScript | Passed |
| Route-split production build | Passed |
| Self-contained preview build | Passed, expected large-single-chunk advisory |
| First five migration file digests | Unchanged from Alpha 04 |

New domain/database tests cover action and assignment authority, active/project/space membership, private task/notes filtering, proof audiences, cross-tenant composite relations, incorrect-project proof rejection, no self-review, idempotency, one-winner competing claims, stale versions, real calendar dates, criteria/size caps, archive/restore and upgrade behaviour. Restricted-role queries verify the new forced row policies; action-specific rules also remain in the domain. New HTTP route checks in the application suite use a test session resolver; the separately recorded 17-check socket suite uses actual Better Auth HTTP cookies for the retained account/messaging flows. These are different forms of evidence.

New browser checks exercise creation/editing, filters, claiming/releasing, notes/removal, proof submission, changes requested, resubmission, independent recognition, outcome link, archive/restore, authorised deep-link search, community isolation, 390px and 360px layouts. The tested desktop workboard and desktop/mobile task modal states returned no automated WCAG A/AA violations. This is not full accessibility certification.

The route-split build's largest JavaScript chunk remains about 262 kB uncompressed. Entry is about 204 kB and the project-work route about 17 kB; this is build-file size, not measured page speed. Dependency annotation warnings remain. The intentionally single-file preview carries a bundle-size advisory.

## Corrections made during verification

Earlier attempts found old tests trying to insert new task tables into pre-task migration fixtures. The legacy fixture now inserts only schema-appropriate original records; no production policy was relaxed. Migration-count assertions were advanced from five to six. Browser checks were corrected to the existing British-English Close dialogue label and to the real Studio North seed, which uses an independent copy of Common Ground rather than an absent project. The final passing totals above refer only to completed reruns. The release helper caught a wrong-case App.tsx reference in the register; it was fixed and all 21 helper tests passed.

## Privacy and product limits

Task plans and notes are visible to authorised project teammates and permitted community administrators, not every community member. Task proof is deliberately shared with that team while under review, with an explicit UI warning. Unrelated pending proof keeps its former filtering. Recognised work retains project visibility. No task notes, pending proof body, private goals or inbox text enter general search. Application/database roles enforce access; this is not end-to-end encryption from the operator.

Notes are plain text. Author/lead/admin removal clears the body but retains attribution/timestamp. There is no task-note reporting or full forensic revision history. Briefs and assignment lock once proof exists; follow-up work is a new task. Archive preserves linked proof. A task's recognised contribution does not certify the whole project or automatically publish a community output.

No task attachments, drag-and-drop, custom workflows, recurrence, dependencies, multiple-assignee attribution or live WebSocket collaboration. Boards allow 100 active tasks per project, and the pre-existing 5,000-per-collection/20,000-total workspace read caps still apply to accumulated records. Focused pagination remains pre-scale work. No new runtime service or dependency was added.

## External state

No live Neon project, Vercel deployment, cloud bucket, real sender or scheduler was configured. No real email was sent. The remote GitHub branches were read; no application push, PR, merge or remote application CI is claimed. This source is delivered locally with manifests and a recoverable Git bundle. Database tests use PGlite's PostgreSQL engine, not live Neon pooling, standalone PostgreSQL service concurrency or recovery.

The previous hosted/connected-browser policy blocker remains unresolved; it was not treated as a pass or bypassed in this release. The supplied staging-browser and PostgreSQL-service CI jobs still need execution in an appropriate connected environment. No backup/restore or production vulnerability audit is claimed.

## Next work

Operational release gate: publish this exact source into a reviewed branch, run the supplied CI, bind dedicated staging infrastructure, migrate and re-grant runtime tables, verify invitations and hosted sessions, and rehearse restore before a consented pilot.

Next product investigation: creator authoring and reusable knowledge, informed by a targeted review of actual LearnHouse editor/activity code, ClassroomIO course services and Frappe assessment flows. Reuse suitable editor libraries and the existing course/path model; do not replace REUNIR with another LMS. The current research register makes that next review traceable rather than leaving it as a promise.
