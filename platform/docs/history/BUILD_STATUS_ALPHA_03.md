# Build status · REUNIR Alpha 03

24 September 2026. Application version 0.3.0. PRD revision 0.4. This describes the delivered source and verified local behaviour, not a live deployment or public-launch certification.

## Delivered in this wave

The Alpha 02 purpose-led architecture is preserved. Alpha 03 adds personal invitations and invited account creation, existing-account acceptance, library-managed password recovery/session revocation, encrypted durable mail queuing, private one-to-one messaging, unread/read markers and cursor pagination, block/unblock and selected-message reports, focused member administration, role assignment and private-space access.

The existing Home, purpose, paths, milestones, private goals, courses, mission proof, projects, contributions, outcomes, community outputs, profiles, knowledge, search, events and notifications remain. Messaging does not become part of the purpose/reputation feed. Privileged roles are deliberately assigned, not earned automatically from likes.

Seven normalised SQL tables are added in two migrations. Migrations 0001 and 0002 remain byte-identical to the recovered Alpha 02 source. Existing content is not reset or backfilled with fiction. Runtime grants explicitly include the added tables and message sequence.

## Verification

| Check | Verified result |
| --- | --- |
| Strict TypeScript | Passed |
| Full automated suite | 230 passed, zero failures/skips/cancellations |
| Retained automated coverage | All 177 earlier checks remain in the suite |
| New pilot/API/database/security coverage | 53 passing checks |
| Retained community browser journey | 24 passing checks |
| Retained purpose browser journey | 34 passing checks |
| New messaging/access browser journey | 27 passing checks |
| Total completed demo browser checks | 85 |
| Real Node HTTP integration | 12 passing checks |
| Production React build and standalone preview | Passed, with bundle-size advisory |

The full combined browser command exceeded one container execution timeout during its third suite. The first two suites completed and the third was rerun independently to completion. Counts above refer to completed result files, not a partially executed command.

New tests exercise real Better Auth accounts/cookies, invited signup with ordinary role, token expiry/rotation/revocation/email binding, used-token rejection, generic recovery response, password changes/session revocation, origin rejection, encrypted queue integrity/retry behaviour, sender authority, idempotent sends, participant/private RLS, old-message pagination, same-timestamp sequence order, monotonic read markers, blocking both directions, selected-message reports, independent moderation, restricted-role writes, owner protection, suspension and private-space access.

The 12 HTTP checks start the Node server and make actual HTTP requests, not only calls to the Hono request helper. They cover registration, sign-in, invitation acceptance, message send/read, reset redirect structure and revoked sessions. They use local PGlite and captured mail transport, not Neon or a real email service.

Automated accessibility scans found no violations in the tested Home, Paths, Outputs, Profile, Knowledge, Inbox and Member access states. Manual/incomplete checks remain in the evidence. This is not an accessibility certification.

## Explicitly blocked or unverified

The separate connected-browser script could not navigate Chromium to the local server: ERR_BLOCKED_BY_ADMINISTRATOR. No browser policy was disabled or bypassed. The script and blocked-run report are retained for a normal staging environment. The passing demo-browser and HTTP suites are useful but not a substitute for hosted-browser/session acceptance.

No live Neon project was changed. The connected Neon action rejected the request because project_id was not supplied by its current binding/schema. No Vercel deployment, real Google bucket, IAM configuration, production email sender or scheduled mail worker was configured. Email was captured in tests; no invitation or recovery email was actually sent to a real person.

GitHub read access works. The branches inspected still held only preparatory workflows/README. Complete application source remains in this delivered workspace; no full source push, PR, merge or remote application CI success is claimed. CI configuration is supplied, including automated, HTTP and demo-browser checks.

Database verification uses PGlite's PostgreSQL engine. It does not establish Neon pooled-connection behaviour, high-concurrency semantics, regional latency, operating cost, backup or restore. The current community snapshot remains bounded at 5,000 rows per collection and 20,000 total; private messaging is independently paginated. General workspace pagination remains a pre-scale gate.

The main JS bundle is approximately 598 kB minified (177 kB gzip), with CSS approximately 86 kB (19 kB gzip). Vite reports a large-chunk advisory and library annotation warnings. The successful build is not warning-free or a dependency vulnerability audit. Route splitting remains future optimisation.

## Product limits

Messages are one-to-one plain text with polling, not live WebSocket chat, group rooms, message attachments or end-to-end encryption. Moderators cannot browse others' inboxes through the app, but privileged server/database operators can access stored text. Reports intentionally disclose one selected message.

Recovery and invitations are implemented but need sender verification and ongoing queue execution to operate. Delivery, bounce handling, retention and alerts remain operational work. General email verification/change flows and privileged MFA are not implemented.

Member suspension/restoration and role/private-space controls are implemented. Ownership transfer, full account removal/export, appeals and evidence revocation history remain unbuilt. Reviewed outcomes remain community judgement, not independent accreditation.

## Next release gate

Publish the actual source into a reviewed repository branch, run application CI, resolve the intended Neon binding, migrate and grant restricted runtime access on staging, configure Vercel/live mode and an approved email sender/worker, then complete hosted-browser tests and backup/restore. Use a small invitation-only pilot with an independent moderator and approved Code Black content before broadening scope.
