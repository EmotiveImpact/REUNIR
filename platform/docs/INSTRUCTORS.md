# Track instructors

Version 0.12.0-alpha.1. Built on Alpha 11 cover images (`bffa3b7`, PR #5), retaining UI_DESIGN_DIRECTION.md and the existing draft, publication, revision, lesson file and knowledge-check rules. The upstream review is in `research/notes/17_TRACK_INSTRUCTORS.md`, and the decision in `decisions/012-track-instructors.md`.

## What people can do

Owners and administrators open a track and choose **Instructors** beside Creator studio. The dialogue lists the track's instructors with who added them, adds an active member from a list, and removes one. The new instructor is notified and linked to the track's Creator studio.

An instructor sees **Teaching** in the sidebar. The teaching page lists the tracks they teach, with published lessons, unpublished drafts and answers waiting for feedback, and holds their review queue. For those tracks only, an instructor can:

- create, edit, preview, publish, archive and restore lesson drafts, restore history into a draft and reorder lessons;
- upload, attach, replace and discard lesson files, and open draft and history files;
- author knowledge checks, see their answer keys and every attempt on the track's lessons, and mark written answers with feedback, never their own attempts;
- change the track cover.

### Inviting someone new to teach (Alpha 20)

The same dialogue has **Invite someone new to teach**. An owner or administrator enters the email address of someone who is not yet a member; the person receives the usual personal invitation, which also names the track. Accepting it, with a new account or an existing one using that address, makes them an ordinary member and that track's instructor, recorded in the inviting administrator's name, with an audit entry for the grant. If the sender is no longer an active owner or administrator when the invitation is accepted, the person joins as a member only and an administrator can add them later. Member access lists the invitation with "To teach" and the track. People who are already members are added from the list instead. Migration `0020_instructor_invitations.sql` (additive) adds the invitation's optional track and one insert policy for the grant (decision 020).

### Contributors (Alpha 25)

When adding someone in the same dialogue, choose **Instructor** or **Contributor**; each person on the list has a role menu to change it. A contributor writes the track's lesson drafts and files for its instructors to publish: they open, save, preview and restore drafts, upload and attach lesson files, and see the track's drafts, history and upload records. They cannot publish, archive, reorder, change the cover, see learners' knowledge-check attempts or review them. Their Teaching page lists the track as "Contributor" without the review queue, and their creator studio has no publish, archive or ordering controls. Changing a role replaces the grant in the acting administrator's name. Migration `0023_contributor_roles.sql` (additive) adds the role and makes the published-revision, attempt and invitation policies require an instructor (decision 025).

An instructor or contributor cannot create tracks, choose instructors, change other tracks or open Community studio, member access or community settings. Owners and administrators keep doing everything on every track.

## Rules

- **Explicit grants only.** A `track_instructors` row names one member for one track and records the administrator who granted it. Being shown as a track's author ("with …") grants nothing, and upgrading creates no rows, so nobody gains rights on upgrade.
- **One rule everywhere.** `teaches(workspace, member, trackId)` is true for an active owner or administrator, or an active member with a grant for that track. Drafts, revisions, lesson files, answer keys, attempts, reviews and track covers all use it.
- **Silence about other tracks.** An instructor asking about another track's drafts, files or attempts gets "not available" (404), as if they did not exist. A member who teaches nothing gets the existing "instructor or administrator required" (403).
- **Active membership.** Suspension or removal ends an instructor's access immediately. Reinstatement restores the existing grant; remove the grant to end it for good.
- **Grants are not rewritten.** They are added or deleted. Removing a grant keeps everything the instructor published and every review they gave.

## Row security in depth

Migration `0012_track_instructors.sql` is additive. It creates `track_instructors` with forced RLS: members of the community can read grants; only an active owner or administrator can insert one, in their own name (`granted_by` must be the acting user), or delete one. The runtime role has no UPDATE on the table, and the repository refuses to change such rows in place.

It adds permissive policies next to the existing owner and administrator ones, each requiring a grant for the row's own track and an active membership: drafts (all operations), revisions (read and insert), attempts (read), and attempt review with the same once-only shape as before (unreviewed before; reviewed at version 2 in the reviewer's own name after; never the learner themselves). It recreates the restrictive lesson file read policy with one more allowance: instructors of the file's own track. Migrations 0001 to 0011 are unchanged.

## Demo mode

The fictional demo grants Idris Cole the product track ("From idea to first version"). Choose **Preview as instructor** in the account menu to see the teaching page, Sofia Chen's waiting answer and the studio for that track only. **Preview as admin** opens the Instructors dialogue on any track.

## Running it

Apply migration 0012 with `npm run db:migrate`, then `npm run db:grant-runtime`. Checks: `tests/instructors.test.ts` (domain), `tests/instructors-database.test.ts` (0012 upgrade, forced RLS for drafts, revisions, attempts, files and grants, suspension, grants), `tests/instructors-http.test.ts` (API), `npm run test:browser:instructors` (demo journey), `npm run test:browser:instructors-connected` (live build with Better Auth sessions, the API under the restricted runtime role with forced RLS), and the instructor check in `npm run test:postgres`.
