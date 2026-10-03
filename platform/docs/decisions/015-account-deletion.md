# Decision 015: people delete their own account; shared work stays as Former member

Status: implemented in Alpha 15, verified locally; not deployed. Date: 3 October 2026.

## Problem

A REUNIR account is one sign-in shared by every community a person belongs to. Until now nobody could delete one: Alpha 14 let members download their learning record and let operators erase a learner's answers, but identity, profile, sessions and email stayed. Deleting everything a person ever wrote would also tear holes in other people's conversations, projects and lessons.

## Decision

The owner decided (3 October 2026): posts, comments and project work stay so conversations still make sense, but the person's name, photo and profile are removed and shown as "Former member". Private things (goals, notes, their own learning record) are deleted. Direct messages stay for the other person, from a former member.

- Any signed-in person deletes their own account from **Your account**, after re-entering their current password (checked by Better Auth) and typing "delete my account". Attempts are rate limited.
- It happens in one database transaction across every community they belong to, whatever the membership's status. Each membership becomes the same scrubbed record: name "Former member", no headline, biography, skills or photo, role member, status `left`. Posts, comments, projects, project updates, task notes, contributions, outcomes, mission work, lessons, drafts, files, covers, reports they filed and messages they sent stay, attributed to that record. Their project team places stay too, because kept contributions and proof refer to them.
- Their personal records go: reactions, saved posts, notices, replies to events, private goals, private-space access, path and track enrolments, completed lessons, knowledge-check answers, recognition points, instructor grants, read state, blocks they made, request receipts, private files (stored objects removed after commit), invitations addressed to their email with any mail still queued for them, reset tokens, rate counters, sessions, the stored password hash and the account itself.
- Owners are refused, with the communities named. Ownership cannot be handed over yet, and REUNIR never deletes a community as a side effect.
- Tasks they had claimed without submitted proof go back to their teams. Notices in other members' inboxes that begin with their name are reworded to "A former member", unless another member shares the name or a longer member name begins the notice. The audit entry, `member.account.deleted`, holds counts only.
- A former member never receives new notices, recognition points, roles, instructor grants or messages, and cannot be restored: rejoining needs a new invitation and creates a new account.
- Migration 0015 adds policies that admit only the acting person's own rows while the transaction is marked as their own account deletion: all their memberships, their instructor grants and their knowledge-check attempts. The runtime role keeps the delete privilege on attempts for that one purpose, and a restrictive policy keeps the operator erasure from 0014 out of its reach.

## Alternatives considered

- **Delete everything the person wrote.** HumHub offers it to administrators and Discourse requires it before a hard delete. It breaks threads and projects that others still rely on; the owner chose to keep shared work.
- **Pseudonymous handles, as Discourse's `anon` names.** They keep a person's old posts linkable on screen. One shared label, "Former member", without a profile, avoids gathering kept posts back into a portrait.
- **Delete or transfer communities the person owns, as LearnHouse and HumHub do.** Deleting a community destroys other people's work; transfer needs its own design for accountability. Owners are refused until ownership transfer exists.
- **Rely on Better Auth's own `deleteUser`.** It would delete the sign-in in a separate transaction from the community records, so a failure could leave a half-deleted person. REUNIR deletes everything in one transaction.
- **Keep the runtime role without delete rights on attempts and erase answers later through an operator.** That would leave the learning record in place after the person asked for it to go. A delete privilege bounded by row security to the person's own deletion keeps the guarantee that matters: the application can never erase anyone else's answers.
- **Copying donor code.** Discourse is GPL-2.0-or-later, HumHub AGPL-3.0-or-later or proprietary, LearnHouse AGPL-3.0. Their behaviour informed the design; no file was copied.

## Consequences

People can leave REUNIR entirely, and their communities keep the conversations and work they shared. Limits recorded in ACCOUNTS.md and BUILD_STATUS.md: owners cannot leave until ownership transfer exists; mentions of the person inside other people's posts and comments stay as written; in a community where they were suspended, tasks they had claimed stay assigned for an administrator to reassign; pending invitations other communities sent to their address are those communities' records and expire after seven days; real email delivery and hosted Better Auth are still unverified.
