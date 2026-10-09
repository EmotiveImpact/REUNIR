# Decision 050: security fixes from the October audit

Status: built in Alpha 50. Date: 9 October 2026.

## Problem

A full audit of main at `4d82e9e` found no cross-community or private-data leak, but four weaker spots:

- `InvitationService.accept` checked that the invitation was pending and unexpired, never that its sender still administered the community. An administrator who was demoted or removed kept seven days of working invitations.
- The invitation middleware spent the shared per-route allowance before the per-visitor one, so a handful of addresses could use up acceptance or registration for everyone. Anonymous accept attempts counted against it too.
- Better Auth read the visitor's address from `X-Forwarded-For`, its default, while the invitation limits read `X-Real-IP`. A visitor can add to the first, and off Vercel can set either.
- With `ADMIN_TWO_FACTOR=required`, task files and the cover library were withheld from administrators without two-step sign-in, but lesson file uploads, cover uploads and discarding a lesson file were not.

There was also still no Content-Security-Policy on the app's own page.

## Decision

- An invitation is usable only while its sender is an active owner or administrator. `inspect`, `registrationEmail` and `accept` all check, so a stale link fails before an account is made. This replaces decision 020's rule that such a person still joined, only without the teaching grant. No migration: the check reads `members`.
- The invitation middleware checks the per-visitor limit first, rejects an unsigned accept, then counts the shared limit.
- `TRUSTED_IP_HEADER` (default `x-real-ip`) names the one header both Better Auth and the invitation limits read. A malformed value stops the server at start.
- The three upload routes pass `administration` into the repository. As with commands, the step is tried with the actor as a moderator; if that fails, the answer is `TWO_FACTOR_REQUIRED`. Instructors are never asked.
- `Content-Security-Policy-Report-Only` from `apps/api/src/content-security.ts` on every Node response, and the same text in `vercel.json`, checked equal by a test. Enforcement waits for a clean staging run.
- Message reports list open ones first and invitations pending ones first, still capped at 100.

## Alternatives considered

- **Revoking an administrator's invitations when their role changes.** Needs a hook in every role, status and deletion path; checking at use covers them all.
- **Enforcing the policy now.** Without a deployed build there is no way to see what it would break; report-only costs nothing.
- **A rate limit on `/api/health`.** The limit itself is a database write, and `launch:smoke` relies on the detail, so it stays.

## Consequences

Owners who demote an administrator should resend that person's pending invitations themselves. Behind any proxy other than Vercel, `TRUSTED_IP_HEADER` must be set correctly, or every visitor shares one sign-in limit. Tests: `tests/administration-uploads-database.test.ts`, `tests/content-security.test.ts`, a new invitation case in `tests/pilot.test.ts`, and the header check in `tests/http.test.ts`.
