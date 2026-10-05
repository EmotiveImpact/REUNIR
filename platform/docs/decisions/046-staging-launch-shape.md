# Decision 046: the shape of the first staging launch, and tools that keep secrets off chat

Status: prepared in Alpha 46, verified locally; nothing provisioned or deployed. Date: 5 October 2026.

## Problem

The launch kit (PR #17) lists every step, but three things stood between it and a staging site the owner could actually switch on. The runbook asks for clamd "on a private network the API can reach", which Vercel functions cannot do short of an enterprise feature, and clamd has no authentication, so it must never face the internet. The scheduler section offered Vercel Cron Jobs without saying that the free Hobby plan runs them at most once a day, while queued mail needs about one run a minute. And the owner had no single list of what to create, what it costs, and how to produce the secrets without inventing, copying or pasting them anywhere.

## Decision

- **First staging round without a bucket.** Uploads stay off until scanning no longer needs Vercel to reach clamd directly (the background scanning work). The production startup rule that a bucket needs a scanner is unchanged; nothing is made optional to get round it.
- **Vercel Pro recommended for the scheduler**, with Hobby plus a dedicated Google Cloud Scheduler as the free alternative. `vercel.json` gains its `crons` entry only in a reviewed commit after the owner chooses, as the runbook already required.
- **Neon Free, Resend Free** for staging, on resources dedicated to REUNIR. A paid Neon plan with a longer restore window comes before real members.
- **`.env.staging.example`**: the deployed variable set with `<fill: ...>` placeholders and empty secrets, committed through an explicit ignore exception. The preflight now fails any value still holding `<fill:`, naming the variable and never the value.
- **`npm run launch:secrets -- --env-file .env.staging`** fills `BETTER_AUTH_SECRET`, `EMAIL_ENCRYPTION_KEY` and `CRON_SECRET` with independent 64-character base64url values from `crypto.randomBytes`, never replaces a value already set, never prints one, sets the file to owner-only permissions and refuses any file git would track.
- **`npm run launch:smoke -- --origin https://<host>`** sends only unauthenticated GET requests without cookies or redirects and judges: `/api/health/live` answers with the expected version; `/api/health` is live on PostgreSQL (or reports NOT_CONFIGURED clearly); the three internal routes refuse without the scheduler header; the home page is served with HSTS of six months or more, `nosniff`, `DENY`, `no-referrer` and a Permissions-Policy that turns off camera and microphone; and whether a Content-Security-Policy exists yet. Messages never echo a response body. It accepts only a bare https origin, or a local one with `--allow-local`.
- **docs/STAGING_LAUNCH.md** is the owner's page: the shape, the costs as checked on 5 October 2026, the steps only the owner can take in order, and what Claude does once the site is up.

## Alternatives considered

- **Exposing clamd on the internet behind a firewall rule.** Vercel's outbound addresses are not fixed on ordinary plans, so the rule would have to be open; rejected.
- **Staging with `UPLOAD_SCANNING=optional`.** The switch exists for deliberate use, but trying uploads unscanned would test a path that real members must never take. Rejected for staging too.
- **A free third-party web cron service.** It would hold `CRON_SECRET` in yet another account outside the owner's control; rejected in favour of Vercel or Google Cloud, which the project already relies on.
- **Writing secrets with the shell (`openssl rand`).** Works, but leaves the owner to copy values between windows. The script keeps them in one ignored file.

## Consequences

The owner can go from nothing to a staging site with five accounts' worth of clicks, one local terminal session and no secret in chat. The first round cannot test uploads, covers, lesson files or video; those are tried when storage returns. The smoke check proves only what an anonymous visitor can see; signed-in, privacy and mail checks still need a person (runbook section 9). Prices and plan limits were read from public pages on 5 October 2026 and are not verified against an account.
