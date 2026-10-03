# Moderation and appeals

How community-post moderation works, and how a member asks for a second look. See decisions/032-moderation-appeals.md for the reasoning.

## Hiding a post

- Moderators, administrators and the owner can hide or restore a post from its options menu, or from a private report in Community studio, Moderation. Reports about the post are resolved either way, and the action is audited (`post.hidden`, `post.restored`).
- The post records who last hid or restored it and when (`moderatedBy`, `moderatedAt`; `posts.moderated_by`, `posts.moderated_at` from migration 0031). Posts moderated before 0031 have no record and show none.
- Hiding someone else's post sends them a notice, "Your post was hidden", which opens **Appeals** (`/appeals`). Like notices about a person's own access, it always arrives, whatever their notification settings.
- A hidden post is visible to moderators, administrators, the owner and its own author. The author sees "A moderator hid this post. It is hidden only to you" and cannot reply to it, react to it or save it while it is hidden.

## Appealing

- Only the author can appeal, only while the post is hidden, and only while they are an active member who can still see the post's space. Choose **Appeal** on the hidden post, or on **Appeals**, and say why (up to 2,000 characters).
- One appeal per post can be open at a time. The author can **Withdraw appeal** while it waits, and appeal again later. Once an appeal about a hiding has been decided, that hiding cannot be appealed again; if the post is restored and hidden again later, the new hiding can be.
- An appeal is private to the person who made it and to the community's owners and administrators. Moderators who are not administrators, and other members, never see it. Nothing about it appears in the feed, on profiles or in any activity list.

## Deciding

- An active owner or administrator who is neither the person appealing nor the person who hid the post decides. Each of them is notified when an appeal arrives. Deciding is owner or administrator authority, so it needs two-step sign-in where the server requires it (`ADMIN_TWO_FACTOR`).
- **Restore the post** (reversed) makes it visible to members again. **Keep hidden** (upheld) leaves it visible only to its author. The decider writes a response (up to 2,000 characters), which the member receives as a notice and reads on Appeals. Decisions are audited (`moderation.appeal.reversed` with `post.restored`, or `moderation.appeal.upheld`); so are appeals and withdrawals.
- If nobody can decide, for example because the only owner is the person who hid the post, the appeal waits. Appeals says so to the member and to administrators, who see "You hid this post, so another owner or administrator decides." When another administrator is appointed, the appeal is in their queue.
- An appeal challenges one hiding: the one recorded on the post when the appeal was made (`hidden_by`, `hidden_at`). If a moderator restores the post or hides it again while the appeal waits, the appeal no longer applies and nobody can decide it, in the application or under row security. The author can withdraw it, and appealing the current hiding closes it automatically.
- Owners and administrators reach the queue from Community studio, Moderation, **Open appeals**, or from the notice.

## Data and security

- `moderation_appeals` (migration 0031) holds the appeal. Forced row security: the appellant and the community's active owners and administrators read; only the active author inserts, in their own name, for their own hidden post, and only as an open appeal; only the appellant withdraws; only an active owner or administrator who is not the appellant and not the post's moderator decides, in their own name, and only while the hiding the appeal names (`hidden_by`, `hidden_at`, which must match the post when it is inserted) is still the post's latest moderation. A partial unique index allows one open appeal per item. The runtime role may change only `status`, `decided_by`, `decided_at` and `response` (column grant); `reason` and the rest never change.
- Deleting the appellant's account removes their appeals inside the account-deletion transaction. Decisions stay in the audit trail.
- The browser demo runs the same rules through the domain, on fictional data: Alex Morgan's post "Selling my old camera kit" was hidden by the moderator Maya Bennett, so preview as the member to appeal and as admin (the owner, Amina Okafor) to decide.

## Known limits

- Suspension of community access cannot be appealed here. A suspended member cannot use the community, and suspension already has its own recorded reason and restore action.
- Comments cannot be hidden, so there is nothing to appeal. Task-note removal and private-message report outcomes are not appealable.
- One level of escalation only: an administrator's decision is final within the application. The moderator who hid the post is not notified of the outcome (it is in the audit trail).
- There is no time limit on appealing and no reminder to deciders.
