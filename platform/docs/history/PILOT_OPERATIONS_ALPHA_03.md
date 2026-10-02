# Pilot operations · Alpha 03

## Secrets and queue delivery

Set server-side `RESEND_API_KEY`, `EMAIL_FROM` and a stable random `EMAIL_ENCRYPTION_KEY` with at least 32 characters. Verify the intended sender/domain with the provider. These values are not VITE_* variables and do not belong in GitHub, source archives or chat. When the email encryption key is absent, the auth secret is used; changing that fallback while jobs are queued makes those jobs unreadable. Use a separate stable key and a planned rotation/re-enqueue procedure.

`npm run mail:drain` loads `.env`, connects with the normal runtime role, processes at most 20 eligible jobs and exits. Schedule it approximately once per minute with the deployment's approved worker/scheduler. Alternatively an authenticated `GET /api/internal/mail` invocation drains at most two jobs for a bounded serverless request. It requires `Authorization: Bearer <CRON_SECRET>`. Do not include this secret in a URL. No recurring cloud scheduler is provisioned by this release.

On Vercel, configure a supported scheduling arrangement for the chosen plan and set CRON_SECRET in server environment settings. Confirm the real route, bearer forwarding, duration and cadence on staging. The checked-in vercel.json does not silently create a paid cron dependency. A single invocation does not continuously deliver messages.

The Resend transport has an eight-second request timeout. The outbox uses an exclusive row lease and stable provider idempotency key. A failure records only DELIVERY_FAILED, waits two minutes, and eventually marks failed after five attempts. Do not interpret sent as received/read: it means provider accepted the send request. Bounce/webhook handling and delivery analytics remain future work.

Use an administrative database connection to inspect aggregate queue state: `SELECT status,count(*) FROM email_outbox GROUP BY status;`. Do not select/decrypt payloads just to check queue health. Failed invitations can be replaced through the invitation form; users can request a new reset link. Retention/cleanup and alerting must be configured before a wider rollout. Never reset all jobs or replay expired mail blindly.

## Invitation flow

Provision only the first owner using the existing private CLI. Thereafter use Member access, invite a specific address, check queue status, open the invitation from a separate browser, and test registration/acceptance. Invite links last seven days and are one-use. A new pending invitation for the same address replaces the previous one. Revoking cannot recall a message already handed to a provider, but the old token will no longer redeem.

New users choose their own password. Do not distribute generated passwords for normal onboarding. Existing users must sign in to the invited email. Forwarding the personal token to another person is not supported; treat it as a bearer credential.

## Proxy, rate limits and logs

Exact application Origin and JSON content type are required for mutations. Invitation endpoints have shared and per-peer DB rate limits. The per-peer key uses x-real-ip; only deploy behind a trusted reverse proxy that overwrites client-supplied IP headers. Better Auth also needs a verified trusted-IP configuration for the final hosting topology. Its local fallback is a shared path bucket; this is conservative but can throttle multiple legitimate pilot users. Verify forwarded-header handling rather than disabling rate limits.

Keep API request logs free of invitation/reset tokens, email payloads, passwords and private message text. Referrer-Policy is no-referrer. Configure the hosting edge not to retain sensitive reset-link URLs in broadly accessible logs. Pseudonymous IDs are not permission to publish private activity.

## Go-live acceptance

Use a dedicated staging Neon project/branch and backup first. Apply all migrations with the direct migration credential, then grant the allowlisted tables/sequence to reunir_app. The runtime must not own tables, bypass RLS or inherit stronger roles. Check sign-in and recovery in real hosted browsers, including mobile. Verify two users/two tenants, sender spoof rejection, revoked invites, both directions of blocking, suspended membership and participant-only conversations.

Check provider delivery, spam placement, sender ownership and failed-job handling with consented test addresses. Rehearse restore. Define who receives abuse reports and how they are escalated. A sole owner cannot independently review their own reported messages; appoint a trusted independent moderator before the pilot.

The browser demo is local fiction, not encrypted storage. Do not put real member information into the downloadable preview.
