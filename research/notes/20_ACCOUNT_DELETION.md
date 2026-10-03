# Account deletion: keeping shared work as Former member, 3 October 2026

Targeted review for deleting your own account, after the owner decided that posts, comments and project work stay so conversations still make sense, shown as "Former member", while private things and the person's own learning record go, and direct messages stay with the other person. Discourse and HumHub were read from shallow, sparse clones pinned to the commits below; the LearnHouse clone pinned for note 19 was read again. This is a behavioural review of specific files, not a whole-repository audit or a legal opinion. Discourse is GPL-2.0-or-later; HumHub is AGPL-3.0-or-later or proprietary; LearnHouse is AGPL-3.0. No upstream source was copied. Exact blobs are in `reuse-register.json`.

| Project | Commit | Files and ranges read |
| --- | --- | --- |
| Discourse | `67bc74d0d83f8037ec538c1299b8d8cb59211319` | `app/services/user_anonymizer.rb`: complete file, 128 lines; `app/services/user_destroyer.rb`: lines 1–90 of 225 |
| HumHub | `c58fc49f5c99913fe126c4f622822398e194fdb2` | `protected/humhub/modules/user/models/User.php`: `beforeDelete` and `softDelete` (lines 503–563 of 1059); `protected/humhub/modules/admin/models/forms/UserDeleteForm.php`: the options and `performDelete` (lines 30–131 of 150) |
| LearnHouse | `5e28b0723176b34ba8777b9980db352268aa8234` | `apps/web/services/settings/deleteAccount.ts`: complete file, 27 lines; `apps/api/src/services/users/users.py`: `delete_user_by_id` (lines 891–931) |

## What each source taught

**Discourse anonymises and keeps posts.** `UserAnonymizer` runs in one transaction: it renames the account to a fresh `anon` handle, randomises the password, clears name, title, date of birth, avatar and profile (location, website, biography, backgrounds), replaces the email with an address under `anonymized.invalid`, and destroys sign-in tokens, API keys, second factors, security keys and push subscriptions. Posts stay. A follow-up job rewrites the old username where other content refers to it. The audit entry records the action, and only records the previous email and username when a site setting asks for it.

**Discourse deletion removes personal records, and likes.** `UserDestroyer` refuses to delete someone who still has posts unless asked to delete those too. In one transaction it deletes the person's bookmarks, drafts and flags they raised, removes every like and other post action they made, and appends their user ID and username to existing staff log entries before deleting the user.

**HumHub soft delete keeps contributions, drops the person.** An administrator chooses between soft delete (contributions stay) and full delete (contributions, comments and likes are removed), and must decide what happens to spaces the person owns: transfer them to the administrator or delete them. Soft delete deletes the profile and its images, invitations the person sent and invitations addressed to their email, follows, password records, group memberships, sessions, friendships and linked sign-ins, then blanks the email and renames the account `deleted-<id>`.

**LearnHouse deletes the account from settings.** The client sends one authenticated `DELETE` with the access token; there is no password re-entry in that call. On the server, organisations where the person is the only administrator are deleted outright, with all their courses; other memberships are removed, cached sessions invalidated and a goodbye email sent.

## How REUNIR adapts this

- **Keep the work, drop the person, in one transaction.** Like Discourse's anonymiser and HumHub's soft delete, REUNIR keeps posts, comments, project work, lessons, files and covers, and messages for the people who received them, and removes the person: their membership in every community becomes the same scrubbed record (name "Former member", no headline, biography, skills or photo, status `left`), and their sign-in, sessions, password hash, reset tokens and email go. It happens in one database transaction across every community, as Discourse's transaction does for one site.
- **One label, not a pseudonym.** Discourse's `anon` handles keep a person's old posts linkable to each other on screen. REUNIR shows every deleted account as "Former member", with no profile, so kept posts are not gathered back into a portrait of the person.
- **Personal records go, likes included.** As Discourse removes likes and bookmarks, REUNIR deletes reactions, saved posts, notices, replies to events, private goals, private-space access, path enrolments, track enrolments, completed lessons, knowledge-check answers, recognition points, instructor grants, read state, blocks the person made, request receipts and private files, and invitations addressed to their email with any mail still queued for it, as HumHub deletes invitations to the address.
- **Owners are refused rather than taking a community with them.** LearnHouse deletes organisations a sole administrator leaves behind; HumHub asks for ownership to be transferred or the space deleted. REUNIR has no ownership transfer yet and never deletes a community as a side effect, so an owner sees why deletion is unavailable and nothing changes.
- **The person proves it is them.** Unlike LearnHouse's token-only request, REUNIR asks for the current password, checked by Better Auth, and the typed phrase "delete my account", with a rate limit on attempts.
- **Names leave other inboxes too.** In the spirit of Discourse rewriting the old username, notices in other members' inboxes that begin with the person's name are reworded to "A former member", unless another member shares that name or a longer member name begins the notice, when it cannot be attributed with confidence and stays as it was.
- **The audit entry holds counts only**, never the name or email.
- **Row security stays in force.** The runtime role deletes only the acting person's own rows, and only while the transaction is marked as their own account deletion (migration 0015). A restrictive policy keeps the owner-authorised operator erasure from note 19 out of the application's reach.

## Deliberately not adopted

No administrator-run deletion of someone else's account, no option to delete a person's posts with their account, no ownership transfer and no deletion of communities, no goodbye email, no IP or email block lists, and no pseudonymous handles. Mentions of the person inside other people's posts and comments are left as their authors wrote them.
