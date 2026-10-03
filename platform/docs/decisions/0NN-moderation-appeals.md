# Decision NNN: appealing a hidden post

Status: implemented on a local branch, verified locally; not deployed. Date: 3 October 2026.

## Problem

A moderator could hide a post, and the author was neither told nor able to ask anyone to look again. Nothing recorded who hid a post or when, so there was no way to keep the person who made a decision from judging their own decision.

## Decision

- **Scope is hidden posts.** `post.moderate` is the only community moderation that hides something a member wrote. Comments cannot be hidden, so there is nothing to appeal there. Task notes are removed by the author, the project lead or an administrator with `task.note.hide`, which clears the note's text; that is project housekeeping, not community moderation, and is not appealable here. **Suspension is out of scope**: it is an access decision with its own recorded reason and restore action (`member.status`), and a suspended member cannot use the community to appeal. A separate process would be needed for it.
- **Who moderated and when.** Migration 0022 adds `posts.moderated_by` and `posts.moderated_at`. `post.moderate` sets them whenever it changes a post's visibility (hiding or restoring). Existing rows keep NULL: who moderated them was never recorded, and nothing is backfilled or guessed. A reversal on appeal leaves them as they were (the moderator who hid the post); the appeal records who restored it and when.
- **The author is told and still sees the post.** Hiding someone else's post sends them a notice ("Your post was hidden") that leads to `/appeals`. Notices leading there count as access notices, which always arrive. The author keeps seeing their own hidden post, marked "hidden only to you", but cannot reply to it, react to it or save it while it is hidden. Other members still do not see it; moderators still do.
- **One appeal per hiding.** A new `moderationAppeals` collection (`moderation_appeals` table) holds `subject` (`post` only for now), `subjectId`, `appellantId`, `reason`, `status` (`pending`, `upheld`, `reversed`, `withdrawn`), `decidedBy`, `decidedAt` and `response`. Only the author, while an active member who can see the post's space, may appeal, and only while the post is hidden. At most one appeal per item is open (a partial unique index enforces it too). Withdrawing allows a fresh appeal. Once an appeal about a hiding is decided, that hiding cannot be appealed again; if the post is restored and later hidden again, the new hiding can be.
- **Escalation, not self-review.** An appeal is decided by an active owner or administrator who is neither the appellant nor the person who hid the post (`posts.moderated_by`). Deciding is owner or administrator authority, so it needs two-step sign-in where the server requires it. Every eligible decider is notified of a new appeal. If nobody is eligible (for example, the only owner hid the post), the appeal waits and both the appellant's and the administrators' screens say so; nobody is notified until there is someone to decide, and a newly appointed administrator sees it in the queue.
- **Decisions.** Reversal restores the post (`hidden=false`) and is audited as `moderation.appeal.reversed` and `post.restored`. Upholding keeps it hidden (`moderation.appeal.upheld`). The decider writes a response, which goes to the appellant as a notice. A post already restored by a moderator while its appeal waited cannot be "kept hidden" by the appeal; reversing simply closes it. Appeals and withdrawals are audited as well. Only the decision fields change after an appeal is made: the runtime role has column-level `UPDATE` on `status`, `decided_by`, `decided_at` and `response` only.
- **Private, never activity.** An appeal is visible to its appellant and to the community's active owners and administrators, and to nobody else, both in the domain and under forced row security (`appeal_read`). Moderators who are not administrators do not see appeals. Insert, withdraw and decide each have their own policy that checks the actor, the post's author and hidden state, and the moderator. Appeals never create posts, comments, reactions or other community activity; the reason never reaches other members. Cross-tenant reads and writes are refused.
- **Account deletion.** Deleting the appellant's account removes their appeals (a policy admits only their own rows inside their own account-deletion transaction). Decisions stay in the audit trail, and a post restored on appeal stays restored.
- **Demo.** The fictional Code Black seed has one post by the demo member that the demo moderator hid, with its notice, so the whole journey (appeal as the member, decide as the owner) works in the browser demo through the domain.

## Deviations from the brief

- The brief suggested recording the moderator on the hide command only. Restoring through `post.moderate` records the restorer too, because the columns mean "who last changed this post's visibility through moderation". A reversal on appeal does not overwrite them, so the database's decide policy can still compare the decider with the moderator in the same transaction that restores the post.
- Withdrawn appeals set `decided_at` (the time they closed) but no `decided_by`.

## Not decided here

Appeals against suspension, task-note removal or private-message report outcomes; notifying the original moderator of the outcome; appeals beyond one level (an owner reviewing an administrator's decision); time limits on appealing.
