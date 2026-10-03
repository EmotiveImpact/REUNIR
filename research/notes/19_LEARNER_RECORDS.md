# Learner records: your own export, an owner-authorised erasure, and long review queues, 3 October 2026

Targeted review for three items carried on the roadmap since Alpha 10: a learner's export of their own work, an operator procedure for erasing a learner's answers and unused cover files, and a paginated review queue. The same pinned shallow clones of LearnHouse and Frappe Learning were read through the session's anonymous Git proxy; ClassroomIO's account code was searched and offers workspace deletion only, so it is not cited. This is a behavioural review of specific files, not a whole-repository audit or a legal opinion. Both projects are AGPL-3.0 at their roots, so no upstream source was copied. Exact blobs are in `reuse-register.json`.

| Project | Commit | Files and ranges read |
| --- | --- | --- |
| LearnHouse | `5e28b0723176b34ba8777b9980db352268aa8234` | `apps/api/src/routers/admin.py`: the export and anonymise routes (lines 1455–1500); `apps/api/src/services/admin/admin.py`: `export_user_data` and `anonymize_user` (lines 2359–2470); `apps/web/services/settings/deleteAccount.ts`: complete file, 27 lines; `apps/api/src/services/users/users.py`: `delete_user_by_id` (lines 891–931) |
| Frappe Learning | `071266699d3ed984eeff7f3e3658d259fd946a97` | `frontend/src/pages/QuizSubmissions.vue`: list, filters and load-more (lines 1–30) and the resource's order and page length (lines 120–140) |

## What each source taught

**LearnHouse export.** An administrator's API token can export one user's data as a JSON bundle "for GDPR Article 15 (Right of Access)": profile, memberships, course progress, certificates and groups. Every collection is scoped to the token's organisation, so a token for one organisation cannot read the user's history in another. The person whose data it is does not download it themselves.

**LearnHouse anonymise and delete.** The "right to be forgotten" route scrubs identity (email, name, avatar, biography) and revokes the user's API tokens, but keeps course progress and certificates "so course analytics remain accurate". A comment notes that the user row is shared across organisations, so scrubbing affects all of them, while token clean-up is scoped to one. Self-service account deletion cascades further and deletes any organisation where the user is the only administrator.

**Frappe Learning review lists.** Quiz submissions are listed newest first, 24 at a time, with a "load more" control and filters by quiz, member and course.

## How REUNIR adapts this

- **The member downloads their own record.** Rather than an administrator export, the person whose learning it is downloads it from their profile, as a dated JSON file for one community at a time, as LearnHouse scopes its bundle. It covers tracks joined, lessons completed, knowledge-check answers with marks, feedback and reviewer, and mission work. Every record that is theirs is included even after a track is unpublished, but titles, names and answer keys follow exactly what their own screen would show.
- **Erasure removes answers, authorised by an owner, and keeps an honest trail.** LearnHouse scrubs identity and keeps learning records; REUNIR's first procedure does the opposite job: it erases a member's knowledge-check answers, marks and feedback in one community on a request an active owner authorised, and keeps an audit entry with the request reference and counts only. Identity and account deletion remain separate, because the account is shared across communities. The procedure is a dry run unless confirmed, refuses partial erasure, and still works under forced row security for a hosted migration role without bypass, through one narrowly scoped delete policy the application's own role cannot use.
- **Unused cover files are cleared on demand.** Uploads already prune unused covers lazily; an owner-authorised operator command now lists them and deletes their stored files first, then only the records still unused.
- **Long queues page with exact totals.** Like Frappe's load-more lists, the review queue shows a page at a time (20). Waiting answers stay oldest first, so the longest-waiting learner is marked first; counts beside each heading are always full totals; and focus moves to the first new answer after loading more.

## Deliberately not adopted

No administrator-run exports of someone else's data, no self-service account deletion or identity scrubbing yet, no deletion of a community when its last owner leaves, and no review-queue filters. Each needs its own design for shared accounts and accountability.
