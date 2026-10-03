# Project work: workboards, task files and live updates

Project workboards arrived in Alpha 05 (decisions/005-project-workspaces.md). Alpha A3 (placeholder number) adds files on tasks and live updates (decisions/031-task-files-and-live-project-work.md). UI_DESIGN_DIRECTION.md remains authoritative.

## What people see and do

A project's workspace (**Open project workspace** on a project page) shows its tasks on a board (Ready to start, In progress, In review, Recognised) or as a list, with filters for all work, my work, work open to claim and the archive. The project lead and community owners and administrators plan tasks: a title, a brief, completion criteria, an optional assignee, target date and priority. A teammate claims open work, starts it and submits proof, which goes to the existing contribution review; a task is done only when that proof is recognised. Notes keep decisions and questions with the task.

**Files.** An open task has a **Files** section. Anyone who can work on the project attaches a PDF, Word, PowerPoint, Excel, JPEG, PNG or WebP file of up to 10 MB with **Attach a file**, up to 12 per task. Each file shows its type, size, who attached it and when, and a **Download** button. The person who attached it, the project lead, and community owners and administrators can **Remove** it, which deletes it for everyone. Archived tasks keep their files and take no new ones. A card on the board shows how many files a task has. Files are supporting material for the team; they are never proof, which is still submitted and reviewed separately.

**Live updates.** While a workboard or a task is open, it keeps itself current: a teammate's new task, claim, note, file or edit appears within a few seconds without pressing Refresh, and a quiet line beside the heading reads "Updated just now". It reads "Live updates on" until something arrives, "Reconnecting…" when the server cannot be reached, and pauses while the tab is hidden.

**Editing at the same time.** If someone else saves a task while you are editing it, the editor says so ("Idris Cole changed this task while you were editing at 14:02"), keeps what you typed, and asks you to **Load the latest version** (your edits are dropped) or **Keep my edits** (your next save replaces theirs, on purpose). Saving is disabled until you choose. A claim, start, release, archive or proof that loses a race is refused with "Someone else changed this task" and the task reloads.

## Access rules

| Who | See tasks and files | Attach a file | Remove a file | Download |
| --- | --- | --- | --- | --- |
| Active project team member, project lead | Yes | Yes, on tasks that are not archived | Their own; the lead removes any | Yes |
| Active owner or administrator | Yes | Yes | Any | Yes |
| Active member not on the team, moderator | No | No | No | No |
| Member without access to the project's private space | No | No | No | No |
| Suspended, removed or former member | No | No | No | No |
| Another community, anonymous visitor | No | No | No | No |

Access is decided at the moment of asking, so suspension, leaving the team or losing a private space ends it at once. When `ADMIN_TWO_FACTOR` is required, owners and administrators without two-step sign-in cannot attach to a team they are not on, or remove a file only their role lets them remove.

One domain gate decides each kind of request: `canWorkOnProject` for seeing and attaching, `resolveTaskFileDownload` for downloads and `projectWorkVersion` for the change check. PostgreSQL repeats the boundary with four restrictive policies on `upload_intents` (migration 0031) that lean on the team policy for `project_tasks` from 0006.

## Lifecycle (live mode)

1. `POST /api/organisations/:slug/uploads` with `{purpose:'task_file', taskId, name, contentType, sizeBytes}`. The domain checks the person, the task and the limits and records a pending intent; only then is a five-minute signed POST policy minted for the exact key `organisations/{organisation}/task-files/{project}/{uuid}.{ext}`, type and size.
2. The browser posts the file straight to the private bucket, without application cookies.
3. `POST .../uploads/:id/complete` runs the same verification as lesson files: stored size and type, then the file signature read at the measured generation. A mismatch is refused and its object deleted.
4. `GET .../tasks/:taskId/files/:fileId/download` returns a two-minute signed link pinned to the verified generation, with attachment disposition.
5. `POST .../commands` with `{type:'task.file.remove', taskId, fileId}` removes the record; the stored object is deleted once the change has committed.
6. `GET .../projects/:projectId/changes` returns `{version}` with an `ETag`; with a matching `If-None-Match` it answers an empty 304.

`GET /api/account/capabilities` reports `resourceUploads`; without private storage the Files section says so and **Attach a file** is unavailable, while existing files can still be listed.

## Retention

- Removing a file deletes its record at once and its stored object straight after; if storage refuses, the object is private and unreferenced, never served, and is a candidate for the operator sweep that remains a follow-up.
- Uploads that never became files (refused, or unfinished after an hour) are pruned when the same person starts another, and by `npm run db:prune-covers` (LEARNER_RECORDS.md), which now lists them beside unused covers.
- Deleting an account keeps the files the person attached to shared tasks, shown as from a Former member, and removes their unfinished uploads. The project lead or an administrator can remove a kept file.

## Demo mode

The fictional demo runs the same rules in the browser and keeps file bytes in this browser only (IndexedDB, or memory for the session). Two tabs of the demo stand in for two people: a change saved in one appears in the other through the same change check. Do not upload real or private documents to the demo.

## Running it

Apply migration 0031 with `npm run db:migrate`. No grant changes: task files live in `upload_intents`, already granted explicitly. Private storage needs the bucket configuration from SETUP.md section 6, as lesson files do; do not add a lifecycle rule that deletes objects under `task-files/`.

Checks: `tests/task-files.test.ts` (domain), `tests/task-files-database.test.ts` (0031 upgrade, restricted runtime role, forced RLS for team, non-team, suspended and other-community readers, constraints, account deletion, operator prune), `tests/task-files-http.test.ts` (upload intent, verification, download access, removal, change check with 304, concurrent edit conflict, two-step enforcement), the task-file step in `npm run test:postgres`, and `npm run test:browser:task-files` (two demo tabs: attach, verify, download, remove, live update, both conflict paths, axe on desktop and at 390 px).

## Limits and not yet done

- No virus scanning yet (Alpha 23 adds it to the shared upload path; decision 031 names where its verdict gates download). Signature checks confirm the container, not that a file is harmless. Files are always downloads, never previews.
- No files on individual notes, no versions of a file, no renaming.
- No presence ("who else is looking"), by choice; see decision 031.
- Live updates cover project workboards only, by polling every five seconds; there is no server push.
- Real Google Cloud Storage signing, CORS and deletion are unverified against a real bucket.
