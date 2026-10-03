# Decision 035: per-lesson teaching grants

Status: implemented in Alpha 35, verified locally; not deployed. Date: 3 October 2026.

## Problem

A teaching grant covered a whole track. A guest who should write or mark one lesson had to be given every lesson, every draft and every learner's answers across the track.

## Decision

- **A grant covers the whole track or chosen lessons.** When adding someone in a track's Instructors dialogue, an owner or administrator picks "The whole track, including new lessons" (the default, unchanged) or "Only the lessons I choose" and ticks up to 200 of the track's lessons. Both roles from decision 025 work with either scope.
- **What a lesson grant reaches.** Drafts, history and draft files of those lessons; for an instructor, publishing and archiving their drafts and seeing and reviewing learners' knowledge-check answers on them. Everything else in the track behaves as for someone without a grant: other lessons' drafts are not found (404), and their answers are not shown.
- **What stays with the whole track.** Starting a new lesson, reordering the curriculum and the track cover need a whole-track grant, because they change lessons the person was not given. A new lesson is never added to an existing lesson grant.
- **Lesson files are recorded per track.** Someone with a lesson grant can upload and attach files and sees the track's upload records, as before; files are only released through a lesson, draft or revision the person may open.
- **Changing the scope replaces the grant**, in the acting administrator's name, as changing a role does. The list in the dialogue names the lessons ("Instructor for Choose one real problem").
- **Row security in depth.** Additive migration 0034 adds `track_instructors.lesson_ids` (NULL for the whole track, or a JSON array of 1 to 200 lesson ids) and scopes the draft, history read, published-revision, attempt read and attempt review policies to the listed lessons. An invitation to teach is accepted only for a whole track. 0001 to 0023 are byte-identical, and 0024 to 0033 are left to other releases; no grant change.

## Not decided here

Lesson grants by email invitation (an administrator can narrow a grant once the person has joined), and grants that follow a lesson into another track.
