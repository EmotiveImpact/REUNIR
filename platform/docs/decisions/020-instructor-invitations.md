# Decision 020: inviting someone new to teach a track

Status: implemented in Alpha 20, verified locally; not deployed. Date: 3 October 2026.

## Problem

Administrators could only make an existing member an instructor. Bringing in a teacher meant two steps on two pages: invite them, wait for them to join, then find the track and add them.

## Decision

- **One invitation, one track.** An owner or administrator can invite an email address from a track's Instructors dialogue. The invitation is the existing personal, single-use, seven-day invitation with an optional track. Accepting it grants ordinary membership and instructor access for that one track only. Teaching is not a community role.
- **Authority must still be current.** The grant is recorded in the inviting administrator's name and made only if that person is still an active owner or administrator when the invitation is accepted. Otherwise the person joins as a member and an administrator can add them later. A revoked, used or expired invitation grants nothing.
- **Row security in depth.** Migration 0020 adds `invitations.track_id` (tied to a track in the same community) and one insert policy on `track_instructors`. That policy admits a grant only for the accepting person, whose account has the invited address, for the invitation's track and sender, while the invitation is pending and the sender is an active owner or administrator. The existing grant policies are unchanged.
- **Existing members are added from the list.** Inviting a member's address is refused with a pointer to the list, as for ordinary invitations.
- **The demo sends nothing.** The preview records a fictional invitation and says so.

## Not decided here

Contributor roles, per-lesson grants, instructor-created tracks and invitations that grant more than one track.
