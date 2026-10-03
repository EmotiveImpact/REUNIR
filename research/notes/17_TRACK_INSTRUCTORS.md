# Track instructors: who may author and review one track, 3 October 2026

Targeted review for letting a track's instructor author lessons and mark knowledge checks without community-wide administrator rights. The same pinned shallow clones of Frappe Learning, LearnHouse and ClassroomIO were read through the session's anonymous Git proxy. This is a behavioural review of specific files, not a whole-repository audit or a legal opinion. All three projects are AGPL-3.0 at their roots (ClassroomIO's root package metadata says MIT; the conflict is unresolved), so no upstream source was copied. Exact blobs are in `reuse-register.json`.

| Project | Commit | Files and ranges read |
| --- | --- | --- |
| Frappe Learning | `071266699d3ed984eeff7f3e3658d259fd946a97` | `lms/lms/doctype/course_instructor/course_instructor.json` (complete file, 32 lines); `lms/lms/utils.py`: `get_instructors` (lines 315–329), `is_instructor` and `has_course_instructor_role` (405–418), `can_modify_course` and `can_modify_batch` (3539–3560) of 3670 |
| LearnHouse | `5e28b0723176b34ba8777b9980db352268aa8234` | `apps/api/src/db/resource_authors.py` (complete file, 31 lines); `apps/api/src/services/courses/contributors.py`: applying and updating contributors (lines 15–147) and the end of bulk removal (385–427) read in full; lines 148–384 searched for status and permission rules (427 lines) |
| ClassroomIO | `72791608774f6fb65fbc33ddbb1d52d8a2a11045` | `apps/api/src/middlewares/course-team-member.ts` (complete file, 63 lines) |

## What each source taught

**Frappe Learning.** Instructors are an explicit child table on each course, one row per person. Whether someone may modify a course is decided per course: a site-wide moderator role, or a row naming them as that course's instructor. A role that allows creating courses is separate from being an instructor of a particular one.

**LearnHouse.** Every person attached to a course has an explicit authorship record with a role (creator, contributor, maintainer, reporter) and a status (active, pending, inactive). Only the creator, maintainers or administrators may add, update or remove contributors; the creator can never be removed or demoted; new contributors start pending.

**ClassroomIO.** Course routes pass through a middleware that allows the course team (administrators or tutors of that course's group) or an organisation administrator, checked for the course named in the request.

## How REUNIR adapts this

- **Explicit grants, never inferred.** A `track_instructors` row names one member for one track. Being shown as a track's author ("with Idris Cole") grants nothing, so upgrading adds no rights to anyone.
- **Granted by administrators only, in their own name.** Active owners and administrators add and remove instructors; the database requires `granted_by` to be the acting administrator. Instructors cannot appoint others, so there is no maintainer tier to protect.
- **Per-track checks everywhere.** The same rule (`teaches`) decides lesson drafts, history, lesson files, knowledge-check keys and attempts, reviews and the track cover. An instructor of one track learns nothing about another track's drafts or attempts.
- **Active membership is part of the rule.** Suspension or removal ends an instructor's access at once in the domain and in every row policy; reinstatement restores the existing grant.
- **Row security in depth.** New permissive policies admit instructors to their own track's drafts, revisions and attempts, a recreated restrictive policy admits them to their track's lesson files, and attempt review keeps the existing once-only shape, never for one's own attempt. The runtime role can add and delete grants but never rewrite one.
- **A teaching page instead of Community studio.** Instructors who are not administrators see their tracks and their review queue on a separate page; Community studio stays for owners, administrators and moderators.

## Deliberately not adopted

No pending invitations or acceptance step, no contributor roles beyond instructor, no self-service applications, no instructor-created tracks, no instructor management of other instructors and no per-lesson grants. Each can be reconsidered with real community needs.
