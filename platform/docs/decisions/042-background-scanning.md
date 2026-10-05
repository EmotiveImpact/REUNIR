# Decision 042: virus scanning moves out of the upload request

Status: implemented in Alpha 42, verified locally with a stand-in scanner, a stand-in clamd and a disposable PostgreSQL; not deployed. Date: 5 October 2026. Builds on decision 023, which it changes only where it says so.

## Problem

Since Alpha 23 the server scanned each upload while the person waited: completion read the whole stored object into memory and sent it to clamd before answering. That fails on the planned host in two ways.

- **Time.** Vercel stops a function after 30 seconds (`vercel.json`). A lesson video can be 500 MB, and clamd needs time in proportion to size, so large files could never finish.
- **Reach.** A Vercel function cannot reach a private network without a paid add-on, and clamd must never be exposed to the public internet. The API could not safely talk to clamd at all. The staging launch thread found the same and launched staging with uploads off until this was done.

Holding a whole video in memory was a third problem, already noted as a follow-up in decision 037.

## Decision

- **A scan worker beside clamd.** `npm run scan:worker` (`scripts/scan-worker.ts`) is a small long-running process for the same always-on container host as clamd, on the same private network. It uses the restricted runtime database role, the bucket and `CLAMAV_HOST`, needs no sign-in secret, and serves nothing. `--once` runs a single pass for a scheduler. The API never connects to clamd any more; on the API, `CLAMAV_HOST` only says that uploads must wait for the worker.
- **The request does the quick checks; the worker does the scan.** Completion still measures the stored size, type and generation and reads the first bytes for the signature and picture checks, so a mismatched file is refused at once. A file that passes is recorded in a new `upload_scans` table (migration 0040) with the exact generation measured, and completion answers 202 `{ "status": "scanning" }`. The upload stays `pending`: nothing can use it.
- **A verdict counts only for the bytes that will be served.** The worker claims waiting scans with a lease, streams exactly that generation from storage to clamd in chunks (never holding the whole file), and records `clean` or `flagged`. Completion uses a verdict only when its generation (and a cover's small copy's) still matches what is stored; if the file was replaced, it is scanned again. Ready uploads record that generation and are served pinned to it, so what was scanned is what members receive. Member attachments now record and are served at their scanned generation too.
- **The upload completes whether or not the person waits.** After recording a verdict, the worker completes the upload for the person who made it, through the same code their browser would call, so their authority is checked as it stands then. A clean file becomes ready; a flagged file is rejected and deleted exactly as before. A suspended or removed uploader's file is not made ready. The browser keeps asking while the file is checked, less often each time, for up to two minutes plus a second per megabyte; lesson and task files that take longer appear once ready, and a cover asks the person to try again.
- **Flagged files say so.** Asking about a flagged upload again answers 422 `FILE_FLAGGED` every time, not a generic rejection.
- **No verdict still means no file.** When clamd is unreachable, times out, errors (including a stream over its `StreamMaxLength`) or answers unclearly, the scan goes back to wait: one minute, doubling, at most fifteen. The stored object is kept and the upload stays unserved. A scan with no verdict after 24 hours is given up; the upload stays pending until its usual expiry, and completing again asks for a new scan.
- **Isolation.** Requests read and write scan rows only inside their own community (`tenant_scope`). Only transactions that set `app.worker` to `scanner` see scan rows and community slugs across communities; they still cannot read upload records, so the worker completes uploads inside each community as its uploader. The scan row is removed with its upload.
- **Observed, not assumed.** The worker records a `scan-worker` heartbeat. The owner's pilot checklist shows "Virus scan worker observed", with a warning when the last pass could not reach clamd or a scan in the community has waited more than 15 minutes.

## Defaults chosen where the brief was silent

- A separate long-running worker rather than a Vercel cron route: a cron route has the same 30-second limit and the same lack of a private network, so it would not scan large files.
- Five scans a pass, polling every three seconds when idle (`SCAN_WORKER_IDLE_MS`). When the scanner fails, the rest of that pass waits for the next one rather than each timing out in turn.
- The worker's lease is twice the scan allowance (30 seconds plus a second a megabyte) plus a minute, so a slow scan is not claimed twice.
- The worker logs upload and community IDs and a flagged file's signature name, never a file name or its contents.

## Not decided here

Rescanning stored files when signatures update, quarantine instead of deletion, scanning files larger than clamd's `StreamMaxLength` (it must be at least the largest upload allowed; until then those files wait unscanned and are never served), several workers in parallel (claims are safe for it, but one is enough for a pilot), and which host runs clamd and the worker at launch.
