# Decision 023: virus scanning of uploads

Status: implemented in Alpha 23, verified locally with a stand-in scanner and a stand-in clamd; not deployed. Date: 3 October 2026.

## Problem

Lesson files, cover pictures, library pictures and member attachments were checked for declared type, size and file signature, then served to other members. A signature check confirms a container format, not that a file is harmless. SECURITY.md, LESSON_RESOURCES.md and ROADMAP.md all listed malware scanning as missing before a public launch.

## Decision

- **ClamAV's clamd, spoken to directly.** `apps/api/src/scanner.ts` sends the bytes with clamd's `INSTREAM` command over TCP, in length-prefixed chunks, and reads `stream: OK` or `stream: <signature> FOUND`. It uses only `node:net`; no dependency was added and nothing is written to disk. clamd is a free, self-hosted service; no paid scanning API is involved.
- **Scanned at completion, before anything can use the file.** Browsers still upload directly to private storage. When the browser asks the server to complete an upload, the server reads the whole stored object once, pinned to the generation it has just measured, scans those bytes, and only then lets the domain mark the upload ready. That generation is the one recorded and served afterwards, so what was scanned is exactly what members receive. The same read supplies the signature and dimension checks.
- **Every upload path.** Lesson files, track and project covers, cover library pictures and member attachments are all scanned.
- **Flagged files are refused and deleted.** The upload becomes `rejected`, its stored object is deleted, and the person sees 422 `FILE_FLAGGED`: "This file was flagged by the virus scanner and has been deleted. Nothing was changed." The log records the request ID and the signature name, never the file name or contents. A rejected member attachment can no longer be completed again, so a second upload under the same five-minute policy cannot slip past the scanner.
- **No verdict means no file, and nothing lost.** When clamd cannot be reached, times out (30 seconds), reports an error or answers in a way the client does not recognise, completion returns 503 `SCAN_UNAVAILABLE` and the upload stays `pending` with its stored object kept, so completing again succeeds once scanning is back. An unclear answer is never treated as clean.
- **A server setting, required in production.** `CLAMAV_HOST` (and `CLAMAV_PORT`, default 3310) turn scanning on. `UPLOAD_SCANNING` is `required` or `optional`; unset means `required` when `NODE_ENV=production` and `optional` elsewhere. When required and a bucket is configured, the server will not start without `CLAMAV_HOST`, and the pilot checklist shows `upload-scanning` as blocked. Any other value, or a port that is not a TCP port, also stops the server. Without a bucket there is nothing to scan and the check passes.
- **Ready to switch on, checked before launch.** `npm run scan:check` pings the configured clamd, scans a harmless sample and the standard EICAR test file, and reports whether both verdicts are right. It stores nothing. `/api/account/capabilities` reports `uploadScanning`.

## Defaults chosen where the brief was silent

- 422 for a flagged file, distinct from `FILE_MISMATCH`, so the interface can say what happened.
- One whole-object read per completion. Uploads are capped at 10 MB, so the bytes are held in memory briefly rather than streamed from storage to clamd.
- clamd's own `StreamMaxLength` must be at least 10 MB (its default is 25 MB). If it is lower, clamd reports an error and uploads wait with `SCAN_UNAVAILABLE` rather than pass unscanned.
- Files that were already ready before scanning was turned on are not rescanned.

## Not decided here

Rescanning stored files when signatures update, quarantine instead of deletion, scanning text and links, deep Office-file inspection, and which host runs clamd at launch. clamd should sit on a private network next to the API, never on the public internet.
