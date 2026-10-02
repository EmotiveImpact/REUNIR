# Private lesson resources, 2 October 2026

Targeted review for the Creator Studio resource slice. Three pinned shallow clones were read through the session's anonymous Git proxy. This is a behavioural review of specific files, not a whole-repository audit, a runtime comparison or a legal opinion. All three projects are AGPL-3.0 at the reviewed roots, so no upstream source was copied into REUNIR. Exact blobs are recorded in `reuse-register.json`.

| Project | Commit | Files read |
| --- | --- | --- |
| LearnHouse | `5e28b0723176b34ba8777b9980db352268aa8234` | `apps/api/src/services/media/media_serve.py`, `apps/api/src/security/file_validation.py` (lines 1–140), `apps/api/src/services/blocks/utils/upload_files.py` |
| Frappe Learning | `071266699d3ed984eeff7f3e3658d259fd946a97` | `lms/lms/permissions.py` (`can_access_lesson`, `file_has_permission`), `lms/lms/utils.py` (`get_attachable_files`, `attach_file_to_doc`), `lms/lms/doctype/course_lesson/course_lesson.py` (lines 185–345) |
| ClassroomIO | `72791608774f6fb65fbc33ddbb1d52d8a2a11045` | `apps/api/src/middlewares/presign-auth.ts`, `apps/api/src/routes/course/presign.ts`, `packages/ui/src/custom/attachment-list/attachment-list.svelte`, lesson document utilities |

## What each source taught

**LearnHouse.** Downloads decide `Content-Type` from server-controlled state, never the stored client claim. Every response carries an RFC 5987 filename, `X-Content-Type-Options: nosniff` and private no-store caching, and only a short list of types may ever render inline. Uploaded bytes are checked against magic numbers rather than trusting the declared type, and storage keys are randomised. LearnHouse streams bytes through its API after an access check.

**Frappe Learning.** One function, `can_access_lesson`, is the single source of truth for who may read a lesson's files. A private file binds to one parent record. An unattached file may only be attached by the person who uploaded it, and a missing parent fails closed. The parent row is locked before attachment state is checked. Much of Frappe's complexity exists because content can reference files by URL, and any account can create a File row naming someone else's URL.

**ClassroomIO.** Documents live on the lesson record with key, name, size and type, and the editor shows them as an ordered list with view/edit modes, reorder handles and delete. The counter-example matters more: download presigning trusts storage keys sent by the client and authorises only by organisation membership read from the key prefix, with legacy keys that no asset claims allowed through. The code itself notes that a client-reported size is advisory because a presigned PUT does not bind it.

## How REUNIR adapts this

- **Bind by identifier, never by URL or key.** A resource entry names an upload by ID inside a lesson, draft or revision. Clients never send storage keys. The server resolves the key after authorisation. This removes Frappe's URL-forgery class and ClassroomIO's client-supplied key problem.
- **One access rule.** Downloads reuse the existing workspace visibility model: the requester must be an active member who can currently read that published lesson, its track and its space. Drafts and revision history remain owner/admin only. This mirrors Frappe's single gate while keeping REUNIR's tenant transaction and role checks.
- **Track-scoped uploads.** A lesson resource upload belongs to one track and can only be attached within it. Only active owners/admins with access to the track can upload or attach. This replaces Frappe's uploader-only attachment rule with REUNIR's existing co-author model.
- **Direct-to-bucket uploads stay.** REUNIR keeps its signed POST policy, which already binds exact byte size and content type (unlike a presigned PUT). Because bytes never pass through the 64 KB JSON API, completion performs a bounded ranged read of the first 1 KB to verify the file signature, adapting LearnHouse's magic-byte checks.
- **Generation pinning.** Form POST policies cannot carry a generation precondition, so an uploader could overwrite the object while the five-minute policy is valid. Completion records the verified object generation, and both the signature read and every signed download are pinned to it. Overwritten bytes are never served.
- **Safe delivery.** Signed downloads last two minutes and force `attachment` with an RFC 5987 filename and the server-recorded content type. Nothing is rendered inline on the application origin.
- **History is immutable.** Removing or replacing a resource changes the draft. Learners keep the published file until the next publication. Revisions keep their references, so a file that has ever been published cannot be discarded through the application.

## Deliberately not adopted

No streaming proxy (Vercel functions should not stream lesson files), no share tokens, no inline rendering, no video/audio or SCORM packages, no malware scanning and no OOXML deep inspection. These remain explicit limitations in RICH_LESSONS.md and SECURITY.md rather than implied features.
