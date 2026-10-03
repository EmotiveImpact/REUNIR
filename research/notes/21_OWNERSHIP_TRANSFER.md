# Ownership transfer: handing a community to an administrator, 3 October 2026

Targeted review for letting a community's owner hand it to someone else, so that an owner can then delete their account (Alpha 15 refuses owners). HumHub was read again from a partial clone pinned to the commit used for note 20. This is a behavioural review of specific files, not a whole-repository audit or a legal opinion. HumHub is AGPL-3.0-or-later or proprietary; no upstream source was copied. Exact blobs are in `reuse-register.json`.

| Project | Commit | Files and ranges read |
| --- | --- | --- |
| HumHub | `c58fc49f5c99913fe126c4f622822398e194fdb2` | `protected/humhub/modules/space/modules/manage/models/ChangeOwnerForm.php`: complete file, 71 lines; `protected/humhub/modules/space/modules/manage/controllers/MemberController.php`: access rules (lines 30–50) and `actionChangeOwner` (lines 193–213) of 228; `protected/humhub/modules/space/behaviors/SpaceModelMembership.php`: `setSpaceOwner` and `getSpaceOwner` (lines 120–160 of 604); `protected/humhub/modules/user/views/account/delete_spaceowner.php`: complete file, 30 lines |

## What the source taught

**Only the owner hands a space on.** `MemberController` lets space administrators manage members, but its access rules open `change-owner` to the owner group alone.

**The new owner comes from the administrators.** `ChangeOwnerForm` offers, and validates against, only members of the space's administrator group. Nobody else can be chosen.

**The previous owner stays an administrator.** `setSpaceOwner` makes the chosen person an administrator and records them as the space's creator, which is what HumHub reads as the owner. The previous owner's administrator membership is left as it was.

**Account deletion waits for it.** `delete_spaceowner.php` lists the spaces a person owns and tells them to transfer ownership or delete those spaces before deleting their account.

## How REUNIR adapts this

- **Owner only, administrators only.** As in HumHub, only the active owner can hand a community over, and only to an active administrator. An owner who wants to hand it to someone else makes them an administrator first, which is itself a deliberate, audited step.
- **The owner proves it is them.** HumHub's form is one selection. REUNIR asks for the current password, checked by Better Auth, and the community's name typed in full, with five attempts in fifteen minutes, as account deletion does. The handover is not a workspace command, so it cannot be sent without the password.
- **The previous owner stays as an administrator.** As in HumHub. Only the new owner can change that, like any other role.
- **Exactly one owner.** HumHub derives the owner from one column. REUNIR keeps the role on the membership, so migration 0017 adds a unique index allowing one owner per community, and the handover demotes before it promotes, under the community lock.
- **Accountable and visible.** The audit entry names the new owner and the previous owner's memberships; the new owner gets a notice.
- **Deletion follows.** Owners still cannot delete their account, as HumHub's view says; the account page now points them to the handover, and once they own no community their deletion goes ahead.
- **Not adopted.** HumHub also lets an owner delete a space. REUNIR still never deletes a community as a side effect of anything.
