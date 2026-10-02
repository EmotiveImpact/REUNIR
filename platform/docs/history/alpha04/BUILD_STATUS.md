# REUNIR Alpha 04 · Pilot operations and release hardening

24 September 2026. Application 0.4.0. PRD revision 0.5. Local engineering release, not a hosted pilot or launch certification.

## Delivered

An owner-only Pilot console now separates observed configuration, blockers, warnings and unverified human release gates. It includes tenant-scoped invitation queue totals, last observed worker success, independent moderation cover and purposeful-community counts. It never returns private goals, messages, email bodies, recipients, credentials or connection strings. A non-owner administrator is not sufficient to access the endpoint.

The offline preview explicitly identifies itself as a demonstration. Unconnected delivery counters are unknown, not imaginary zeroes. Export produces a redacted JSON report. Refreshing does not create infrastructure or certify readiness. Home and all existing purpose, learning, work, social and member-access routes remain.

Runtime guards now reject unsafe origins, production embedded databases, secret-like VITE variables, fictional seeding, privileged provisioning credentials on the deployed runtime, configured weak worker authentication and reused email/session secrets when production email is configured. The database safety check rejects superusers, row-policy bypass, database/public-object ownership, public-schema creation and role memberships that permit SET ROLE. An owner console is not a replacement for the startup guard.

Mail claims have a unique lease token. A late worker cannot overwrite a revoked job or a newer claim. Five crashed/uncertain attempts quarantine a job rather than retrying indefinitely. Provider idempotency remains keyed to the stable job ID. A successful poll does not prove inbox receipt, and terminal failures stay visible after subsequent empty successful polls. The worker checks its execution budget between jobs, with the existing eight-second transport timeout. It is not a hard end-to-end request deadline.

Migration 0005 adds a lease token and service-observation table. Migrations 0001–0004 are byte-identical to Alpha 03. A populated Alpha 03 upgrade test preserves existing content and queued ciphertext. Missing schema produces a blocker with unknown counters. An administrative read-only CLI checks migration digests without applying changes.

The deployed Vite build now splits routes and shared runtime chunks. Largest emitted JavaScript chunk: approximately 262 kB uncompressed; entry chunk approximately 194 kB. The prior Alpha 03 largest bundle was approximately 598 kB. This is a file-size observation, not a measured load-time improvement. The deliberately single-file offline preview still has a size advisory; the split deployment build does not. Existing dependency annotation warnings remain.

## Verification completed in this pass

| Check | Result |
| --- | --- |
| Original automated baseline, before changes | 230 passed |
| Full application suite after changes | 276 passed, zero failures/skips/cancellations |
| New configuration, operations, migration and worker checks | 46 passed within the full suite |
| Existing browser journeys | 24 community + 34 purpose + 27 messaging/access = 85 passed |
| New operational browser journey | 17 passed |
| Total completed demo-browser checks | 102 |
| Node HTTP integration using actual sockets and Better Auth cookies | 17 passed, captured email |
| Publication-helper unit tests | 13 passed, recorded separately |
| Strict TypeScript | Passed |
| Split deployment build and standalone preview | Passed |
| New accessibility checks | No violations on tested console desktop/mobile states |
| Source-copy integrity and Git bundle recovery | See RELEASE_METADATA.json supplied alongside the release |

The initial combined application test invocation timed out after completing its first 206 checks. It is not counted. The full command was rerun to completion and reported 276/276. Early browser assertions about fixture counts were corrected to the actual seed; the final 17-check operational run completed. These corrections did not bypass application access controls.

## Unfinished external gates

The real connected-browser script was attempted again. Chromium refused navigation to the local HTTP server with `ERR_BLOCKED_BY_ADMINISTRATOR`, before the first browser check. That result is recorded separately and is not a pass. The split live build compiled, and the separate HTTP socket tests passed, but neither substitutes for the blocked connected-browser journey.

A second CI job has been supplied for a disposable loopback PostgreSQL service named `reunir_ci`. It exercises real pg connections, role grants and parallel tenant-context isolation. No PostgreSQL server was available here to run that job. It is not a Neon verification or a green GitHub Actions run.

No live Neon project, Vercel deployment, Google bucket, real sender or scheduler was connected. Neon rejected the project-bound tool invocation with a missing-project-id validation error. The Vercel project-read wrapper also returned an input-name validation error. No other application's database or deployment was changed. No email was sent to a real person.

The remote repository was inspected and still held only the previously described preparatory branches. This pass does not claim a full application push, PR, merge or remote CI success. The release is preserved in a local Git bundle, source manifest and reviewed-import helper. Publishing the complete application remains a gate, not something this console marks complete.

## Preserved limits

No group chat, messaging attachments, privileged MFA, general account export/deletion, billing, sophisticated reputation graph or AI orchestration. General workspace reads remain bounded rather than fully paginated. Domain reviews are community reviews, not external accreditation. Privacy is application/database-role enforcement, not end-to-end encryption from the database operator. Complete audit, retention, reporting escalation and restore procedures remain required before wider use.

## Next gate

Recover/publish the versioned source through a normal Git environment without overwriting concurrent work. Run the supplied application and PostgreSQL CI. Bind a dedicated Neon staging project, apply migration 0005 and explicit runtime grants, connect a live-mode deployment and verified sender, run hosted-browser/receipt/restore checks, and obtain owner approval for a small consented Code Black pilot. Keep the underlying thesis: People + Purpose + Progress + Projects + Proof.
