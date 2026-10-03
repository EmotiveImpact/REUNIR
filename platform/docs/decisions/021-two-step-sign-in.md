# Decision 021: two-step sign-in for owners and administrators

Status: implemented in Alpha 21, verified locally; not deployed. Date: 3 October 2026.

## Problem

An owner's or administrator's password opened everything they look after: the member list, roles, invitations, settings and ownership itself. A stolen or reused password was enough. ROADMAP.md and SECURITY.md both listed privileged-account MFA as missing.

## Decision

- **Better Auth's own two-factor plugin, nothing new.** The plugin ships inside `better-auth` 1.7.5, already pinned, so no dependency was added. It provides an authenticator app's time-based six-digit codes (RFC 6238, 30 seconds, issuer "REUNIR") and ten one-time backup codes. There are no SMS or email codes and no "trust this device" option in this slice.
- **Anyone may turn it on; owners and administrators are asked.** The **Two-step sign-in** panel on Your account is offered to every account and says more to people who look after a community. Turning it on needs the current password, shows a setup key and an `otpauth://` link, and takes effect only when a code from the app is accepted. The backup codes are then shown once, with copy guidance. Turning it off and making new backup codes each need the password. A QR code can follow; no QR library was added.
- **Stored as the plugin stores it.** Additive migration 0021 adds `auth_user.two_factor_enabled` (default false) and `auth_two_factor` (one row per account, removed with the account). The plugin encrypts the secret and the backup codes with the server's session secret before writing them. The table is granted explicitly to the runtime role, like the other `auth_*` tables, which have no row security because only Better Auth reads them. Nothing in it reaches a workspace, the session payload or a log.
- **Sign-in asks for the second step.** When Better Auth answers a password sign-in with `twoFactorRedirect`, no session exists yet; the sign-in page, and the sign-in on an invitation page, ask for the app's code or a backup code before continuing. Better Auth limits each challenge to five attempts, locks the account for 15 minutes after ten failed codes in a row and allows three two-step requests per address per path in ten seconds.
- **Enforcement is a server setting.** `ADMIN_TWO_FACTOR` is `required` or `optional`; unset means `required` when `NODE_ENV=production` and `optional` elsewhere. Any other value stops the server at start-up and blocks the pilot checklist.
- **One rule, judged where authority is used.** When required, an owner or administrator without two-step sign-in keeps reads and everything a member or moderator can do, but owner and administrator authority is refused with 403 `TWO_FACTOR_REQUIRED`. For workspace commands the API asks the repository to withhold administration: after the domain accepts the command, it is tried again on a copy with the actor as a moderator; if that fails, the command relied on the role and nothing is written. The domain function (`reliesOnAdministration`) knows nothing about sign-in and is not used by the demo. Routes that exist only for owners and administrators (creating and revoking invitations, ownership transfer, the pilot console, the cover library's uploads and removals) check the role directly. Members and moderators are never asked.
- **The server says what it requires.** `/api/account/capabilities` reports `adminTwoFactor` and `twoStepSignIn`; `/api/session` reports `twoFactorEnabled`. The web app shows owners and administrators a monochrome notice linking to Your account only when the server requires it and they have not turned it on.
- **The demo has no accounts.** Its panel explains the feature for connected communities and never shows a setup key or codes.

## Defaults chosen where the brief was silent

- Ten backup codes of ten characters (`xxxxx-xxxxx`), stored encrypted (the plugin's default storage).
- A moderator is the comparison role: an administrator doing what a moderator could do (hiding a post, resolving a report) is not blocked.
- Lesson files and track or project covers are teaching or project-owner rights, so their uploads are not gated; publishing a lesson and other administrator commands are.
- Reads stay open, including the audit list and invitations list, so a blocked administrator can still see their community and the notice.
- Codes are accepted from the step before and after the current one (the library's window). A code may be replayed within that window; the library keeps no record of used codes.

## Not decided here

Passkeys, recovery without a backup code (an operator procedure), trusted devices, a QR code, enforcement for moderators or instructors, and email verification and change.
