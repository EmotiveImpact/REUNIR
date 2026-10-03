# Accounts: deleting your own account, with shared work kept as Former member

Version 0.15.0-alpha.1. Built on Alpha 14 (learner records), merged to main with Alpha 11 to 14 in `661fac9`, retaining UI_DESIGN_DIRECTION.md and the learner record, cover and instructor rules. The upstream review is in `research/notes/20_ACCOUNT_DELETION.md`, and the decision in `decisions/015-account-deletion.md`.

## Your account

**Your account** in the account menu (top right) lists the communities you belong to and your role in each. One sign-in serves all of them, so deleting the account applies to every one at once. The page says plainly what stays and what goes, and suggests downloading your learning record from your profile first.

Owners see why deletion is unavailable: "You own Code Black. A community needs its owner, so this account cannot be deleted while you own one. Hand each one to an administrator first, from that person's access settings." A link opens Members and access. Once they have handed over every community they own, the delete button appears.

## Deleting it

**Delete your account…** opens a dialogue that names your communities and asks for:

- your current password, checked by Better Auth (live mode only; the fictional demo has no passwords), and
- the phrase **delete my account**, typed in full.

Five attempts in fifteen minutes are allowed per account; a wrong password is refused with "That password is not right." On success the live app returns to the sign-in page with a notice, the session cookie is cleared, and the old password no longer works. In the demo, a farewell page explains what a connected community keeps and removes, and offers to view the community as its owner or to restart the demo.

## What stays, shown as Former member

- Posts and comments, so conversations still make sense.
- Projects, project updates, task notes, contributions, outcomes, mission work and the proof submitted with tasks, with the project team place they refer to.
- Lessons, drafts, revisions, files and covers added for a community.
- Messages sent, for the people who received them. They read as from Former member, the conversation becomes read-only for them, and nobody can start a new one with a former member.
- Reports the person filed, for moderators.

Everywhere these appear the person reads as **Former member**: no photo (a demo portrait never stands in), no profile link, and no place in the member directory, search, avatar rows, pickers or the access list. Opening `/members/<id>` shows "Former member" with no activity listed.

## What goes

- Name, headline, biography, skills and photo, in every community.
- Reactions, saved posts, notices, replies to events, private goals, private-space access and path enrolments.
- The learning record: track enrolments, completed lessons, knowledge-check answers with marks and feedback, and recognition points.
- Instructor grants, read state in conversations, blocks the person made and request receipts.
- Private files, including their stored objects, which are removed after the transaction commits.
- Invitations addressed to the person's email, with any invitation or password-reset mail still queued for them.
- Sessions, the stored password hash, reset tokens, rate counters and the account with its email address.

Tasks the person had claimed without submitting proof go back to their teams. Notices in other members' inboxes that begin with their name, such as "Alex Morgan replied to your post.", become "A former member replied to your post.", unless another member shares the name or the notice begins with a longer member name (such as "Jo Smith" when "Jo" leaves), when the notice cannot be attributed with confidence and stays as it was. The audit entry, `member.account.deleted`, records counts only.

A former member gets no new notices, recognition points, roles or instructor grants, and cannot be restored. To come back, they accept a new invitation and create a new account.

## How it works

`POST /api/account/delete` (same-origin JSON, signed-in only) checks the rate limit, the phrase and the password, then calls `WorkspaceRepository.deleteAccount`, which runs one transaction under the restricted runtime role with forced row security:

1. It marks the transaction as the person's own deletion (`app.account_deletion`), locks their account row, lists their memberships of any status, and refuses owners, naming the communities.
2. In each community, locked in a fixed order, it reads the community's state and plans the change with the same domain rules the demo uses (`eraseFromCommunity`). While the membership is still current it returns claimed tasks and rewords notices; it then deletes the person's own records, refusing the whole deletion if row security admitted fewer rows than planned; it deletes read state, blocks, request receipts and private files; it writes the audit entry; and finally it scrubs the membership, because later policies would no longer see an active member.
3. It checks that the person holds exactly the memberships it planned (accepting an invitation takes the same account lock first, so none can be added meanwhile), then deletes every invitation to their address in any community, joined or not, with its queued mail, and rate counters, reset tokens, queued reset mail to the address (opened from the sealed outbox to compare recipients), and the account, whose sessions and password hash go with it.

Migration 0015 is additive: one policy lets a person see all their own memberships while the mark is present, one lets them delete their own instructor grants, one lets them delete their own knowledge-check attempts, and a restrictive policy confines the runtime role's deletes on attempts to exactly that, so the owner-authorised operator erasure from 0014 stays with the migration role. Migration 0016 is additive too: while the mark is present, two policies let the person see and delete invitations sent to their own account email, whichever community sent them. Migrations 0001 to 0015 are byte-identical.

Every `left` membership reaches the browser as Former member, whatever its stored details, so a membership that left before account deletion existed exposes nothing about the person either.

## Handing a community over (Alpha 16)

Version 0.16.0-alpha.1. In **Members and access**, the owner opens an administrator's access settings and chooses **Hand over ownership…**. The dialogue explains what changes and asks for:

- the owner's current password, checked by Better Auth (live mode only), and
- the community's name, typed in full (case and outer spaces do not matter).

On success the administrator becomes the owner, the previous owner becomes an administrator, the new owner gets a notice, and the audit records `member.owner.transferred` with both memberships. Ownership goes only to an active administrator; for anyone else the access settings say to make them an administrator first. Only the owner can hand over, five attempts in fifteen minutes are allowed, and a community can never hold two owners (migration 0017's unique index). The decision is in `decisions/016-ownership-transfer.md` and the upstream review in `research/notes/21_OWNERSHIP_TRANSFER.md`.

`POST /api/organisations/:slug/ownership` takes `{ memberId, password, confirmation }`, checks the rate limit and the password, then calls `WorkspaceRepository.transferOwnership`, which runs under the community lock with the restricted runtime role: it applies the domain rules (`transferOwnership` in `packages/domain/src/ownership.ts`, shared with the demo), demotes the previous owner and then promotes the new one. It is not a workspace command.

## Known limits

- Owners cannot delete their account while they own a community; they hand it to an administrator first (Alpha 16). The new owner is told, not asked.
- Mentions of the person inside other people's posts and comments stay as their authors wrote them.
- In a community where the person was suspended, suspension had already closed that project's work to them, so tasks they had claimed stay assigned until an administrator reassigns them.
- Hosted Better Auth, real email delivery and real Google Cloud Storage removal are unverified, as for every connected feature.

## Running it

Apply migrations 0015 and 0016 with `npm run db:migrate`, then re-run `npm run db:grant-runtime`: the runtime role's grant on knowledge-check attempts now keeps the delete privilege that the new policies bound. Checks: `tests/account-deletion.test.ts` (domain), `tests/account-deletion-database.test.ts` (runtime role and row security), `tests/account-deletion-http.test.ts` (the route), two real Better Auth checks in `npm run test:http`, `npm run test:browser:accounts` (demo), `npm run test:browser:accounts-connected` (live build, Better Auth, restricted role) and the two account deletion checks in `npm run test:postgres` (deletion itself, and an invitation accepted while a deletion is under way).

For ownership transfer, apply migration 0017 with `npm run db:migrate` (no new grants are needed). Checks: `tests/ownership.test.ts` (domain), `tests/ownership-database.test.ts` (runtime role, the unique index, tenancy and inactive roles), `tests/ownership-http.test.ts` (the route), the handover in `npm run test:browser:accounts` and `npm run test:browser:accounts-connected`, and the concurrent handover check in `npm run test:postgres`.
