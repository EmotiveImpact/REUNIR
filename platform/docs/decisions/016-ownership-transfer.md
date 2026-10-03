# Decision 016: owners hand a community to an administrator

Status: implemented in Alpha 16, verified locally; not deployed. Date: 3 October 2026.

## Problem

Alpha 15 let people delete their own account but refused owners, because a community needs its owner and REUNIR never deletes a community as a side effect. Nobody could change who owns a community, so an owner could never leave. Decision 015 left transfer for its own design because it needs accountability: ownership is the one role that assigns every other role.

## Decision

- The active owner hands the community to one of its **active administrators**, from that administrator's access settings in Members and access. Ownership goes only to someone the owner has already trusted with running the community; to hand it to anyone else, the owner makes them an administrator first, which is its own audited step.
- The owner re-enters their current password (checked by Better Auth) and types the community's name. Five attempts in fifteen minutes are allowed per account. `POST /api/organisations/:slug/ownership` is same-origin JSON and is not a workspace command, so the generic command route can never perform a handover without the password.
- The previous owner becomes an administrator. Only the new owner can change that, like any other role.
- It happens in one transaction under the community lock: the previous owner is demoted, then the new owner promoted. Migration 0017 adds a unique index so a community can never hold two owners; two handovers at once let exactly one through and the other is refused because its sender is no longer the owner.
- The audit entry, `member.owner.transferred`, names the new owner's membership and the previous owner's. The new owner gets a notice saying who handed the community to them.
- An owner still cannot delete their account. **Your account** now points them to the handover; once they own no community, deletion proceeds as in Alpha 15.
- The fictional demo runs the same rules in the browser, without a password.

## Alternatives considered

- **Transfer to any active member.** Simpler for the owner, but it can make someone the owner who was never trusted with administration. HumHub also restricts the choice to the space's administrators.
- **An offer the new owner accepts.** More consent, but it needs a pending state, expiry and a second screen, and leaves owners unable to leave while an offer waits. The new owner is told instead and can hand the community on again. Recorded as a possible later step.
- **Keep the previous owner as an ordinary member.** It silently removes their access to private spaces and administration. Keeping them as an administrator, as HumHub does, leaves the decision to the new owner.
- **Let the role command assign `owner`.** The role command has no password and runs through the generic route; a separate route keeps the re-authentication mandatory.
- **A trigger requiring exactly one owner at commit.** It would also catch zero owners, but deferred triggers need procedural bodies that the migration runner deliberately does not support. The unique index prevents two owners. A community cannot lose its owner because the only path that changes an owner's role is the handover, which always promotes someone: role changes, suspension and account deletion all refuse the owner.
- **Copying donor code.** HumHub is AGPL-3.0-or-later or proprietary; its behaviour informed the design (research note 21); no file was copied.

## Consequences

Owners can hand a community over and then leave REUNIR. The new owner is told rather than asked. A suspended administrator cannot receive ownership until restored, and a suspended owner cannot hand over at all, since suspension already ends their access. Hosted Better Auth remains unverified, as for every connected feature.
