# Decision 036: instructors start their own tracks

Status: implemented in Alpha 36, verified locally; not deployed. Date: 3 October 2026.

## Problem

Only owners and administrators could create a learning track. Someone already trusted to teach a whole track had to ask an administrator to create the next one and then grant it to them.

## Decision

- **Who may start a track.** An active member who is an instructor (decision 025) of at least one whole track (decision 035). Contributors and lesson-only grants do not qualify; others get 403 `TRACK_STARTER_REQUIRED`. Owners and administrators create tracks as before.
- **It starts unpublished.** The new track records its starter as author and gives them a whole-track instructor grant in their own name, so they can write, publish lessons into it and add a cover. Until an administrator publishes it, only its own teachers and the community's owners and administrators see it; members see nothing of it.
- **An administrator publishes it.** Administrators are told when a track is started. **Publish track** (command `track.publish`, owner or administrator only, idempotent) makes it visible to members, records `track.published` in the audit and tells the starter.
- **Two-step sign-in.** An administrator's command now relies on administrator authority when running it as a moderator would be refused or would turn out differently. An administrator who also teaches therefore still needs two-step sign-in, where it is required, to create a published track, because as a moderator they would only start an unpublished one. Instructors who are not administrators never needed it and still do not.
- **Row security in depth.** Additive migration 0035 adds one INSERT policy on `track_instructors`, `instructor_own_track`. It admits only the starter's own whole-track instructor grant, granted by themselves, on an unpublished track they authored that has no grant yet, while they hold an active whole-track instructor grant elsewhere. Earlier migrations are byte-identical; no grant change.

## Not decided here

Instructors archiving or deleting tracks they started, publishing without an administrator, and starting tracks from a template.
