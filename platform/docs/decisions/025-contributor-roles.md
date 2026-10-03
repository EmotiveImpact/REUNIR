# Decision 025: contributor roles for teaching

Status: implemented in Alpha 25, verified locally; not deployed. Date: 3 October 2026.

## Problem

A track grant was all or nothing. Someone who should help write lessons could only be made a full instructor, able to publish to learners, reorder the curriculum, change the cover and see and mark every learner's knowledge-check answers.

## Decision

- **Two teaching roles on the same grant.** An owner or administrator adds a member to a track as an **instructor** (unchanged: authors, publishes, orders, sets the cover, sees attempts and reviews) or a **contributor**. Instructor is the default, so the command, the API and every existing grant keep their meaning.
- **What a contributor does.** Opens, writes, saves and previews the track's private drafts, restores history into a draft, uploads and attaches the track's lesson files and opens draft and history files. The creator studio and the Teaching page open for them.
- **What stays with instructors.** Publishing, archiving or restoring a draft from the archive, reordering lessons, the track cover, learners' knowledge-check attempts, answer keys on published lessons and the review queue. A contributor asking for those gets 403 `INSTRUCTOR_REQUIRED` (or the existing reviewer and cover refusals), because the track itself is visible to them.
- **Grants are still never rewritten.** Changing someone's role deletes the old grant and inserts a new one in the acting administrator's name, in one change. The runtime role still has no UPDATE on `track_instructors`.
- **Row security in depth.** Additive migration 0022 adds `track_instructors.role` (`instructor` or `contributor`, NOT NULL, default `instructor`) and replaces four 0012/0020 policies with role-aware versions: published revisions need an instructor (a contributor may record the `captured` baseline that opening the first draft of an existing lesson writes); attempt reads and reviews need an instructor; an invitation to teach is accepted only as an instructor. Draft and lesson file policies are unchanged, because contributors may use them. 0001 to 0021 are byte-identical.
- **Invitations by email still make instructors.** Inviting someone new as a contributor is left for a later slice; an administrator can change the role once they have joined.

## Not decided here

Per-lesson grants, instructor-created tracks, asking an instructor to publish (contributors' unpublished drafts already show on the instructors' Teaching page), and contributor invitations.
