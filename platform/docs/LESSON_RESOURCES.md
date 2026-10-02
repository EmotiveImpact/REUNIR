# Creator Studio 3: private lesson resources

Version 0.9.0-alpha.1. Built on merged Alpha 08 rich lessons (`016c16e`), retaining UI_DESIGN_DIRECTION.md, the existing upload-intent API and the Google Cloud Storage adapter. The upstream review is in `research/notes/14_LESSON_RESOURCES.md`.

## What creators and learners can do

Owners and administrators open a lesson in Creator Studio and add files: PDF, Word (.docx), PowerPoint (.pptx), Excel (.xlsx), JPEG, PNG or WebP, up to 10 MB each and 12 per lesson. Each file has a learner-facing name and an optional description. Files can be reordered, replaced with a new upload or removed. Every change is part of the private draft: it shows as an unsaved edit, is saved with **Save draft**, appears in the private preview and reaches learners only after **Publish saved lesson**.

Learners see a "Lesson files" list under the lesson body, with the type, size and a Download button. Revision history shows the files each published or captured version held, and an older revision can be restored into the draft (not the live lesson) with its files.

Uploads that are not part of the draft are listed as "Uploaded files not in this draft", where an author can add one back or discard it. A file referenced by any lesson, draft or revision cannot be discarded: removing a published file reaches learners on the next publication, and history keeps its copy.

## Access rules

| Who | Draft files and preview | History files | Published lesson files |
| --- | --- | --- | --- |
| Active owner/admin | Yes | Yes | Yes |
| Active member, moderator | No | No | Yes, if they can open the lesson's track and space |
| Suspended or removed member | No | No | No |
| Another community, anonymous visitor | No | No | No |

One domain function, `resolveResourceDownload`, decides every download from the current workspace: active membership, the lesson's publication state, the track's publication state and the space's visibility. Private-space tracks require space access. Draft and revision files require a current owner/admin role. Clients send only a lesson, draft or revision ID and a resource ID. They never send storage keys or bucket names.

PostgreSQL enforces the same boundary in depth. A restrictive row policy on `upload_intents` lets a member's transaction read a lesson file only when a published lesson in the same tenant references it. Drafts and revisions keep their existing owner/admin-only policies, and the runtime role still cannot update or delete revision rows, including their file lists.

## Upload and download lifecycle (live mode)

1. `POST /api/organisations/:slug/uploads` with `{purpose:'lesson_resource', trackId, name, contentType, sizeBytes}`. The domain checks the author and track, prunes the community's expired or rejected intents, applies caps (5 pending per person, 500 files per community) and records a pending intent. Only then does the server mint a five-minute signed POST policy bound to the exact key, content type and byte size. The key is `organisations/{organisation}/lesson-resources/{track}/{uuid}.{ext}`.
2. The browser posts the file directly to the bucket with `FormData`, sending no application cookies. Bytes never pass through the 64 KB JSON API.
3. `POST .../uploads/:id/complete`. The server reads the object's metadata, checks size and type, then reads the first 1 KB pinned to that object generation and checks the file signature. A match records the upload as ready with its generation. A mismatch marks it rejected and deletes the object. If the object changes during the check, the request returns 409 and can be retried.
4. The author saves the draft with resource entries. The server copies type and size from the verified upload, never from the client, and refuses pending, rejected, other-track, other-tenant or member-private files.
5. `GET .../lessons|lesson-drafts|lesson-revisions/:id/resources/:resourceId/download` returns a two-minute signed URL pinned to the verified generation, with `attachment` disposition, an RFC 5987 filename and the recorded content type. A later overwrite of the object is never served.
6. `POST .../uploads/:id/discard` deletes an unreferenced upload record and, best effort, its object.

The older owner-private upload API is unchanged for member uploads. Its download route now refuses lesson files, which are released only through the routes above.

## Demonstration mode

The fictional demo runs the same domain functions. File bytes stay in the browser: IndexedDB where available, otherwise memory for the session (private windows and the embedded preview). One generated sample PDF, "Problem interview worksheet", is attached to the Code Black lesson "Choose one real problem", so the learner download works immediately. Do not upload real or private documents to the demo.

## Model and migration

Migration `0009_lesson_resources.sql` is additive. `upload_intents` gains `purpose` (default `member`), `track_id` (foreign key to the track), `completed_at` and `generation`, with checks that lesson files have a track and that ready lesson files have a verified generation. `lessons`, `lesson_drafts` and `lesson_revisions` gain a nullable `resources` JSON array, limited to 12 entries and 16,000 bytes. Nothing is backfilled: existing rows keep NULL, which reads as no files. Migrations 0001–0008 are byte-identical.

Upgrade order: `npm ci`, `npm run db:migrate` with the administrative `MIGRATION_DATABASE_URL`, then `npm run db:grant-runtime`. Existing table grants already cover the new columns; the grant script keeps revision history read and insert only.

## Storage setup when deployment resumes

Use a private bucket with uniform bucket-level access and no public principals. Configure CORS for the exact application origin with method `POST` (uploads). Downloads are top-level navigations to signed URLs and do not need CORS. Grant the service identity object create, read and delete on the bucket, plus the signing permission its credential type requires. Do not apply a lifecycle rule that deletes objects under `lesson-resources/`, because history references them. Set `GCS_BUCKET` and, if not using application default credentials, `GCS_CREDENTIALS_JSON`. When storage is not configured, the studio says so and uploads fail closed with 503.

## Verification

`tests/resources.test.ts` (domain and rendering), `tests/resources-database.test.ts` (upgrade, restricted role, RLS, constraints, immutability), `tests/resources-http.test.ts` (routes with an in-memory bucket, plus the real SDK's offline policy and URL signing), `scripts/resources-browser-check.ts` (demo creator and learner journey), `scripts/resources-connected-check.ts` (live build, real sessions, stand-in bucket on a second origin) and the resource step in `scripts/postgres-check.ts`. See BUILD_STATUS.md for the recorded runs.

## Limits and not yet done

- No malware or content scanning. The signature check confirms the container format, not that a file is harmless. Files are always delivered as downloads.
- No deep inspection of Office files, no previews or thumbnails, no audio, video or SCORM packages.
- Real Google Cloud Storage signing, IAM, CORS and downloads have not been exercised against a real bucket. The adapter is tested with the real SDK's offline signing and with in-memory stand-ins.
- Objects whose best-effort deletion fails, or whose intents expired, can remain in the bucket. They are private and unreferenced. An operator sweep is a follow-up.
- A published file stays in revision history. Removing personal data uploaded by mistake after publication needs an operator procedure that is not yet built.
- Download counts are not recorded, and downloading never counts as lesson completion or evidence.
- 10 MB per file is the existing database limit for upload intents.
