# Decision 024: confirming email addresses, and changing your own

Status: implemented in Alpha 24, verified locally; not deployed. Date: 3 October 2026.

## Problem

Every account signs in with an email address, and password resets and invitations go to it, but nothing proved the address belonged to the person. `auth_user.email_verified` existed from Alpha 01 and was never set. Nobody could move an account to a new address either: a person who changed jobs or providers had no way to keep their sign-in. ROADMAP.md and SECURITY.md listed both as missing.

## Decision

- **Better Auth's own flows, nothing new.** Confirmation links and address changes use the email-verification and change-email features inside the pinned `better-auth` 1.7.5. Links are queued through the existing encrypted outbox (`MailQueue`) and sent by the mail worker, like resets and invitations. No new dependency and no migration: `auth_user.email_verified` and `auth_verification` already exist.
- **One link, 24 hours.** A confirmation link works once, for 24 hours, and goes only to the address it confirms. Opening it marks the address confirmed. It never signs anyone in, except as below for a change.
- **Invitations confirm the address.** An invitation is mailed to one address and only its link can be used, so accepting one (new account or existing) marks the account's address confirmed in the same transaction.
- **Confirmation is a server setting.** `EMAIL_VERIFICATION` is `required` or `optional`; unset means `required` when `NODE_ENV=production` and `optional` elsewhere. When required, signing in with an unconfirmed address creates no session: Better Auth answers `EMAIL_NOT_VERIFIED` and queues a fresh link, and the sign-in page says to check the inbox. It applies only where mail can actually be sent: a server with no sender asks for no confirmation, and the pilot checklist stays blocked until email is configured. An unreadable value stops the server at start-up.
- **Changing your address needs your password and the new inbox.** `POST /api/account/email` takes `{ newEmail, password }`. It checks the password with Better Auth, allows five attempts in fifteen minutes per account, then asks Better Auth to send a confirmation link to the new address. The address changes, and is marked confirmed, only when that link is opened. Until then the current address still signs in. Better Auth's own `/api/auth/change-email` is closed (404), so the password cannot be skipped.
- **The current address is told.** The same request queues a notice to the current address naming the new one only in part (`a***@example.org`), with no link, and advising a password change if it was not them.
- **No one learns who has an account.** If the new address already belongs to another account, the answer is the same and nothing is sent to that address.
- **The browser is told what the server offers.** `/api/account/capabilities` reports `emailVerification`, `emailConfirmation` and `emailChange`; `/api/session` adds the person's own `email` and `emailVerified`. Your account gains an **Email address** panel: the address, Confirmed or Not confirmed, **Send a confirmation link**, and **Change email address…**. Opening a link returns to Your account, which thanks the person once the address is confirmed.
- **The demo has no addresses.** Its panel explains the feature and never shows an address or a link.

## Defaults chosen where the brief was silent

- `required` in production, matching `ADMIN_TWO_FACTOR`: a pilot should not run with addresses nobody has confirmed.
- No confirmation of the change from the old address first. The password is the proof that the person asking owns the account, and the old address is told at once. A stolen session alone cannot move an account.
- Opening the change link while signed out signs the person in, as Better Auth does, because only the new address received it. That sign-in skips two-step sign-in; the person had to pass it, and give their password, to ask for the change.
- Changing or resetting the password cancels every change link asked for before it. The links are Better Auth's signed tokens, which cannot be revoked one by one, so the server refuses any change link issued before the password last changed and returns to Your account with "That link no longer works". The notice to the old address tells its owner to change the password, and that is now enough. (Found in review on PR #18.)
- The password typed into the change form, or the deletion and ownership forms, is checked against the stored hash directly. Better Auth's own password route also demands a session started within the last day, which made days two to seven of a valid session fail; typing the password is itself the fresh proof. (Found in review on PR #18.)
- Invitations already sent to the old address are not moved. The panel says so.
- Better Auth's per-path limit for sending a confirmation link is three a minute per client address.

## Not decided here

Changing an address without a working mail sender (an operator task, not offered), notifying every community the person belongs to, and a confirmation step at the old address.
