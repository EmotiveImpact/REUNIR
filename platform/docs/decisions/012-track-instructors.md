# Decision 012: track instructors are explicit grants that teach one track

Status: implemented in Alpha 12, verified locally; not deployed. Date: 3 October 2026.

## Problem

Only owners and administrators could author lessons and mark knowledge checks. Communities want the person who teaches a track to look after it without being trusted with every track, member access and community settings. Tracks already show an author ("with Idris Cole"), but that label was never a permission and is set when content is created.

## Decision

- Add explicit grants: one `track_instructors` row per member per track, created and removed only by active owners and administrators, recording who granted it.
- Never infer rights from the displayed author. Upgrading creates no grants.
- Decide every authoring and review action with one per-track rule: an active owner or administrator, or an active member with a grant for that track. Apply it to drafts, history, lesson files, answer keys, attempts, reviews and the track cover.
- Treat other tracks as invisible to an instructor (404), and keep the existing 403 for members who teach nothing.
- Mirror the rule in row security: new permissive policies for instructors on drafts, revisions and attempts, a recreated restrictive lesson file policy, administrator-only grant writes in the administrator's own name, and no UPDATE on grants.
- Give instructors a teaching page with their tracks and review queue, rather than access to Community studio.

## Alternatives considered

- **Use the displayed author as the instructor.** Simple, but it would silently grant rights on upgrade to whoever content names, including seeded or imported attributions. Rejected: authority must be granted, not inferred.
- **A community-wide "instructor" role.** Frappe Learning has a course creator role alongside per-course instructors. A role alone would let someone edit every track, which is what communities asked to avoid.
- **Contributor roles and pending invitations, as LearnHouse has.** Useful at scale, but adds states and a maintainer tier to protect. Administrators granting directly is enough for the pilot.
- **Instructors managing other instructors.** Rejected for now; it would need the creator protections LearnHouse adds.
- **Opening Community studio to instructors.** It holds moderation and member tools. A separate teaching page keeps those boundaries clear.
- **Copying donor code.** The reference projects are AGPL at their roots. Their behaviour informed the design; no file was copied.

## Consequences

A community can hand a track to the person who teaches it, and the database enforces the same boundary as the interface. Instructors mark answers on their own tracks and never their own attempts. Grants can be audited by who gave them and survive suspension until removed. There is still no invitation step, no per-lesson grant and no instructor-created track; INSTRUCTORS.md and BUILD_STATUS.md record these limits.
