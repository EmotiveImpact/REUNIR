# Decision 058: appeals for suspensions and message reports

Status: built in Alpha 58. Date: 9 October 2026.

## Problem

Decision 031 let a member appeal a hidden post, but two other moderation decisions had no second look. A suspended member could not reach the community at all, so they had no way to ask anyone to reconsider. Someone who reported a private message never heard what happened, and had no way to say the report was closed too quickly.

## Decision

### Suspensions

- A membership now records who suspended it and when (`suspended_by`, `suspended_at`). Restoring access clears both. Suspensions made before migration 0049 have neither, so any owner or administrator can decide an appeal about them.
- A suspended member appeals from their account, because the community itself stays closed to them. The account page, the "your account is ready" screen and the "your access has changed" screen list each community where their access is suspended, with their own appeals there. The routes are `GET /api/account/suspensions`, `POST /api/account/suspensions/:slug/appeal` and `POST /api/account/suspensions/:slug/appeals/:id/withdraw`.
- That path reads only the community's memberships, to find who can decide, and the person's own appeals. It writes only the appeal, the notices and an audit entry. What the person sees carries no names, since they no longer see the community's people.
- An active owner or administrator who neither suspended the member nor is them decides, on the Appeals page. Reversing restores access in the same change; upholding keeps it suspended. Either way the member gets the response.
- One decided appeal per suspension. Withdrawing frees the way to appeal again while the suspension stands; a later suspension can be appealed afresh. Restoring access some other way closes an open appeal, so an open appeal always concerns a suspension in force.
- When the only owner or administrator is the one who suspended someone, the appeal waits, and both sides are told why. The owner can still restore access from Members and access at any time.

### Message reports

- When a moderator closes a report, the person who made it is told, without naming the moderator.
- On the Appeals page, every member sees the private messages they reported and where each report stands. Once a report is closed they can ask, once, for another look, with a reason. The report goes back to the moderators' queue marked "Second look", and the moderator who closed it the first time cannot close it again.

### Storage

- Migration 0049 adds the two membership columns, the `suspension_appeals` table with forced row security, and three columns on `message_reports`. Policies admit the appellant and active owners and administrators to read; the appellant to insert, only about the suspension in force, and to withdraw; an independent owner or administrator to decide; any owner or administrator to close an appeal only once the member is active again; and the appellant's own account deletion to remove it.
- A suspended person can now see their own suspended memberships and the communities they are in, through two new read policies, so their account can list them. Nothing else in the community opens to them.
- The runtime role may update only an appeal's decision fields. A message report's reporter, sender, reason and reported words can no longer be updated at all.

## Alternatives considered

- **Appeals inside the community.** A suspended member would need a partial way back in, which is exactly what suspension removes.
- **Letting the person who suspended decide when nobody else can.** That is the same decision again, not a second look. Restoring access stays open to them as an ordinary action.
- **Unlimited second looks at a report.** One is enough to catch a hasty close without letting a report bounce between moderators forever.
