# Decision 009: lesson files extend the upload intent and the draft, not a second file system

Status: implemented in Alpha 09, verified locally; not deployed. Date: 2 October 2026.

## Problem

Creators need worksheets, slides and templates beside a lesson. Those files must stay private until publication, follow the same revision history as the lesson text, and be downloadable only by people who can currently open the lesson. REUNIR already had an owner-private upload-intent API and a Google Cloud Storage adapter, but no way to attach a file to anything or release it to anyone else.

## Decision

- Keep one upload system. Lesson files are `upload_intents` rows with `purpose = 'lesson_resource'`, scoped to a track and created only by an active owner or admin. The workspace reads only those rows; member-private uploads stay outside it.
- Store the ordered resource list as bounded JSON on lessons, drafts and revisions, alongside the rich lesson body. The existing `lessonContent` whitelist carries it through save, preview, publication, capture and restore, so files follow every existing workflow without a parallel lifecycle.
- Bind entries to upload IDs. The server copies type and size from the verified upload. Clients never send storage keys.
- Verify on completion: metadata size and type, then the file signature from the first kilobyte read at a pinned generation. Record the generation and use it for every later read, because form-POST policies cannot forbid overwrites.
- One domain gate, `resolveResourceDownload`, mirrors the existing visibility rules for lessons, drafts and revisions. A restrictive RLS policy repeats the boundary in PostgreSQL.
- History is immutable, so a file that has ever been published is retained. Only unreferenced uploads can be discarded.
- The browser demo runs the same domain functions and keeps bytes in the browser.

## Alternatives considered

- **Normalised resource tables per draft, lesson and revision.** Gives database foreign keys from entries to files, but triples the copy logic for publication, capture and restore. The JSON list follows the precedent set by `rich_body` in migration 0008; integrity is enforced in the domain and tested at every layer.
- **Separate commands for each file operation.** Each would bump the draft version and make an open editor stale while the author is typing. Keeping files in the draft buffer means one save, one version check and one stale-edit rule.
- **Streaming files through the API, as LearnHouse does.** Unsuitable for serverless functions and the 64 KB request cap. Signed direct uploads and two-minute signed downloads keep bytes off the application.
- **Authorising by organisation membership or client-supplied keys, as ClassroomIO's presign routes do.** Too broad: it ignores draft privacy, private spaces and unpublished tracks.
- **Copying donor code.** All three reference projects are AGPL at their roots. Their behaviour informed the design; no file was copied.

## Consequences

Creators get ordered, named, described, replaceable and removable files with the same private draft and explicit publication they already know. Learners download files only while they can open the lesson. Malware scanning, real bucket verification, orphaned-object sweeping and an operator procedure for removing published personal data remain open, and are listed in LESSON_RESOURCES.md, SECURITY.md and BUILD_STATUS.md rather than implied.
