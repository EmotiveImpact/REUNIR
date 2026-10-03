# Launch runbook: from nothing to a private staging pilot

**Status: nothing in this runbook has been done.** No Neon project, Vercel project, Google Cloud bucket, Resend sender, scheduler, monitor or backup exists for REUNIR (product name Ferven) because of this document. Every step below is for the owner to authorise and carry out, or to delegate explicitly. Record evidence as you go (section 14); a step is done only when its check has been observed, not when its setting has been typed.

This runbook orders and consolidates [SETUP.md](SETUP.md), [PILOT_OPERATIONS.md](PILOT_OPERATIONS.md), [RELEASE_GATES.md](RELEASE_GATES.md) and [SECURITY.md](SECURITY.md). Those documents keep the detail and the reasons; where they differ, they win and this file should be corrected.

Ground rules for every step:

- Use resources dedicated to REUNIR. No database, deployment, sender domain or scheduler may be shared with, or affect, another project.
- Generate secrets locally. Never paste a secret into chat, an issue, a commit, a URL or a `VITE_` variable. Placeholders in this file look like `<generate: ...>`; they are instructions, not values.
- Keep administrative credentials (`MIGRATION_DATABASE_URL`, `BOOTSTRAP_PASSWORD`, `DB_RUNTIME_PASSWORD`) in a one-off local shell or an ignored `.env` file, never in Vercel.
- Configuration present, connection reachable, provider accepted, email received and restore demonstrated are separate observations. Do not mark one because another passed.

Commands are run from `platform/` on a trusted workstation with `npm ci` already done, unless a step says otherwise.

## 0. Decide before starting

- [ ] Owner confirms the target is a **private, invitation-only staging pilot**, not a public launch.
- [ ] Choose the region for database, functions and bucket together, according to where member data may be held.
- [ ] Choose the staging hostname (a Vercel `*.vercel.app` name or a subdomain you control). This becomes `APP_ORIGIN`.
- [ ] Choose a mail sending subdomain dedicated to REUNIR, for example `mail.<your-domain>`, so its reputation cannot affect another project.
- [ ] Appoint an independent moderator: a sole owner cannot review reports about their own messages (PILOT_OPERATIONS.md).
- [ ] Name who receives abuse reports, who operates the scheduler and backups, and who signs off go-live (section 14).

## 1. Source and local gates

- [ ] Confirm the exact commit to deploy is the reviewed, complete application (see AGENTS.md: a preparatory branch is not the application).
- [ ] From `platform/`: `npm ci`, `npm run check`, `npm run test:browser`, `npm run test:browser:v4`, `npm run test:browser:monochrome`.
- [ ] From the repository root: `python3 -m unittest discover -s scripts -p "test_*.py"`.
- [ ] Record the commit SHA and test results in section 14.

## 2. Neon: dedicated project, database and two roles

Detail: SETUP.md section 3.

- [ ] Create a **new Neon project** for REUNIR staging (not a branch of another product's project) in the chosen region.
- [ ] Create a database, for example `reunir`. The project's default owner role (often `neondb_owner`) is the **administrative** role. It owns the schema and runs migrations only.
- [ ] Copy the **direct** (non-pooled) connection string for the owner role into a local, ignored file or shell variable as `MIGRATION_DATABASE_URL`. Never add it to Vercel.
- [ ] Turn on or confirm Neon's point-in-time restore window, and note its length (section 11 relies on it).

## 3. Migrations and the restricted runtime role

There are 21 ordered migrations at Alpha 22, `0001_foundation.sql` to `0021_two_factor.sql`, in `packages/db/migrations/`. Later releases add more: the expected count is always the number of `.sql` files in that folder for the commit being deployed. They are additive, checksummed and serialised by an advisory lock. Migrations never run on a cold start.

With only `MIGRATION_DATABASE_URL` set in the local shell (leave `DATABASE_URL` unset so nothing falls back to it):

- [ ] `npm run db:migrate`
- [ ] `npm run pilot:check -- --migrations --json` shows one row per migration file, each `pass` (checksum matches source).
- [ ] Generate the runtime password and create the role:

  ```sh
  # Generate locally, keep it in your password manager for the DATABASE_URL below:
  #   node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
  export DB_RUNTIME_PASSWORD='<generated runtime password>'
  npm run db:runtime-role
  unset DB_RUNTIME_PASSWORD
  ```

  This creates `reunir_app` with `LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS` and explicit table grants. It refuses to touch an existing role. The password must be 32 to 128 base64url characters; `openssl rand -base64` output is rejected because of `+`, `/` and `=`.
- [ ] Runtime grants step: `npm run db:grant-runtime`. On a new install this repeats what `db:runtime-role` granted; it is the step to rerun after **every** later migration.
- [ ] Build the runtime `DATABASE_URL` from Neon's **pooled** host (contains `-pooler`) with user `reunir_app` and the password you just generated:

  ```
  DATABASE_URL=postgresql://reunir_app:<runtime password>@<endpoint>-pooler.<region>.aws.neon.tech/reunir?sslmode=require
  ```

  The app removes `sslmode` and always verifies TLS for non-local hosts.
- [ ] In a fresh shell with only that `DATABASE_URL`: `npm run pilot:check -- --database --json` shows `runtime-role` as `pass`.
- [ ] If the provider will not allow role creation, arrange an equivalent restricted role with its administrator. Never disable the startup check.

## 4. First owner and community

Detail: SETUP.md sections 2 and 3. Uses the migration connection, before deployment.

- [ ] In the local shell set `BOOTSTRAP_EMAIL`, `BOOTSTRAP_NAME`, a private `BOOTSTRAP_PASSWORD` (12+ characters), `COMMUNITY_SLUG` and `COMMUNITY_NAME`.
- [ ] `npm run db:owner`. Save the printed organisation ID privately.
- [ ] Unset `BOOTSTRAP_PASSWORD` and the other `BOOTSTRAP_*` values. Do not seed fictional data (`ALLOW_FICTIONAL_SEED` stays unset).
- [ ] All further members join through the invitation UI, not the member CLI.

## 5. Server environment variables

These are every variable the server code reads (`apps/api/src/bootstrap.ts`, `apps/api/src/config.ts`, `packages/db/src/connection.ts`) plus the one build flag. Set them in the Vercel project for the **staging** environment only. Generate each secret separately; none may equal another.

| Name | Required | Purpose | How to obtain |
| --- | --- | --- | --- |
| `NODE_ENV` | Yes | Turns on the runtime-role, HTTPS and independent-key startup checks. | `production` |
| `VITE_DATA_MODE` | Yes, at build time | The only public build flag. `live` builds the connected frontend. | `live` |
| `APP_ORIGIN` | Yes | Canonical origin for cookies, Origin checks and links in email. | `https://<staging-hostname>` with no path |
| `DATABASE_URL` | Yes | Pooled connection as `reunir_app`. | Section 3 |
| `BETTER_AUTH_SECRET` | Yes | Signs sessions and encrypts two-step sign-in secrets and backup codes. | `<generate: openssl rand -base64 48>` |
| `ADMIN_TWO_FACTOR` | Recommended | `required` (the production default when unset) or `optional`. When required, owners and administrators must turn on two-step sign-in before using their tools. | `required` |
| `EMAIL_VERIFICATION` | Recommended | `required` (the production default when unset) or `optional`. When required and mail can be sent, an unconfirmed address gets a fresh link instead of signing in. | `required` |
| `RESEND_API_KEY` | For mail | Sending-only key for the verified domain. | Section 7 |
| `EMAIL_FROM` | For mail | Sender, for example `Ferven <pilot@mail.<your-domain>>`. | Section 7 |
| `EMAIL_ENCRYPTION_KEY` | When mail is set | Encrypts queued mail. Stable: changing it makes pending mail unreadable. | `<generate: openssl rand -base64 48>` |
| `CRON_SECRET` | When mail is set | Bearer secret for `/api/internal/mail` and `/api/internal/digests`. | `<generate: openssl rand -base64 48>` |
| `GCS_BUCKET` | For uploads | Private bucket name. | Section 6 |
| `GCS_CREDENTIALS_JSON` | For uploads on Vercel | Service-account JSON, as one line. Vercel has no application default credentials. | Section 6 |

Never on the deployed runtime: `MIGRATION_DATABASE_URL`, `BOOTSTRAP_EMAIL`, `BOOTSTRAP_NAME`, `BOOTSTRAP_PASSWORD`, `DB_RUNTIME_PASSWORD`, `ALLOW_FICTIONAL_SEED`. Startup refuses the credential ones in production. `HOST`, `PORT`, `COMMUNITY_*`, `ERASE`, `PRUNE` and `AUTHORISED_BY` are for self-hosting or local operator commands only. `VERCEL` is set by the platform.

No secret may carry a `VITE_` prefix: anything `VITE_` is compiled into the public bundle, and startup refuses secret-like `VITE_` names.

- [ ] Write the intended values into a local ignored file, for example `platform/.env.staging` (ignored by `.env.*`), then run the offline check:

  ```sh
  npm run launch:preflight -- --env-file .env.staging
  ```

  It reads names and shapes only, prints no values and makes no network call. Fix every `fail`; read every `warn`. A clean result is not approval.
- [ ] Enter the values into Vercel, marking secrets as sensitive. Delete the local file afterwards or keep it only in an encrypted store.

## 6. Google Cloud Storage (optional for the pilot)

Detail: SETUP.md section 6. Without a bucket, text and link features still work; uploads, lesson files and covers report unavailable.

- [ ] In a Google Cloud project dedicated to REUNIR, create a bucket in the chosen region with **uniform bucket-level access** and **public access prevention** enforced. This is Google Cloud Storage, not Google Drive.
- [ ] Set CORS to the exact staging origin, `POST` only (signed downloads are navigations and need none):

  ```json
  [{"origin": ["https://<staging-hostname>"], "method": ["POST"], "responseHeader": ["Content-Type"], "maxAgeSeconds": 3600}]
  ```
- [ ] Create a service account used only by REUNIR, granted object create, read and delete on **this bucket only**. With a JSON key it can sign URLs itself; without one it also needs permission to sign as itself.
- [ ] Do not add a lifecycle rule that deletes `lesson-resources/` objects: revision history refers to them.
- [ ] Put the bucket name in `GCS_BUCKET` and, on Vercel, the key JSON in `GCS_CREDENTIALS_JSON` as a sensitive server variable. Never commit or share the key file; delete the local copy once stored.
- [ ] After deploy, `/api/health` reports `"storage":"configured"` and `/api/account/capabilities` reports `resourceUploads: true`. Then test a real upload, download and cover (section 9).

## 7. Mail provider (Resend) and sender verification

Detail: PILOT_OPERATIONS.md, "Secrets and queue delivery".

- [ ] In Resend, add the dedicated sending subdomain and publish the DNS records it gives (SPF and DKIM; add a DMARC policy for the parent domain if none exists).
- [ ] Wait until Resend shows the domain as verified. Record the date.
- [ ] Create an API key with sending access restricted to that domain. Store it as `RESEND_API_KEY`.
- [ ] Set `EMAIL_FROM` to an address on that domain, `EMAIL_ENCRYPTION_KEY` and `CRON_SECRET` (section 5).
- [ ] Remember that "sent" means the provider accepted the request, not that a person received it. Bounce handling is not built.

## 8. Vercel project

Detail: SETUP.md section 4. `vercel.json` already sets framework `vite`, `npm ci`, `npm run build`, output `dist`, the `/api/*` rewrite to `api/index.ts` (30 second limit) and security headers.

- [ ] Create a new Vercel project for REUNIR, linked to the repository, with **Root Directory `platform`**. Node 22.x.
- [ ] Add the section 5 variables to the environment you will deploy (a dedicated staging project, or Preview scoped to the staging database, never the production database).
- [ ] Decide on Deployment Protection. Protecting the staging deployment keeps it private, but it also blocks schedulers and monitors unless they use Vercel's protection bypass for automation. Record the decision.
- [ ] Deploy. If `/api/*` returns `NOT_CONFIGURED` (HTTP 503), read the function log for the configuration error; no demonstration data is served.

## 9. After deploy: health and hosted privacy checks

Health (no secret needed):

- [ ] `GET https://<staging-hostname>/api/health/live` returns `{"status":"ok","version":"..."}` with the expected version.
- [ ] `GET /api/health` returns `"status":"ok"`, `"mode":"live"`, `"database":"postgres"` and the expected `storage` value. This runs `SELECT 1` through the runtime role.
- [ ] `GET /api/internal/mail` and `GET /api/internal/digests` **without** a header return 403.
- [ ] Signed in as the owner, `/api/account/capabilities` shows `invitations`, `passwordRecovery` and `emailDigests` true when mail is configured.
- [ ] The owner turns on two-step sign-in from Your account, stores the backup codes offline, and confirms owner tools work only afterwards when `ADMIN_TWO_FACTOR` is required.
- [ ] The owner Pilot console shows no blocker you did not expect.

Hosted privacy and access tests from RELEASE_GATES.md "Staging sequence" and PILOT_OPERATIONS.md "Go-live acceptance", in real browsers including a phone, with consented test addresses only:

- [ ] Sign-in cookies are secure and scoped to the staging origin; sign-out ends the session.
- [ ] Invitation received at a consented address, accepted from a separate browser; revoked and replaced invitations no longer redeem.
- [ ] Password reset received and works; old sessions are revoked.
- [ ] Two users in two tenants: no cross-tenant reads or writes.
- [ ] Private goals stay private, including from administrators; sharing is an explicit choice.
- [ ] Participant-only conversations; reporting sends only the selected excerpt; blocking works in both directions; sender spoof is rejected.
- [ ] Suspension preserves work and denies new requests.
- [ ] Project work: two simultaneous claims, removed space access, self-review rejected, archive and restore, a reviewed contribution supporting an outcome.
- [ ] Uploads (if configured): real upload, owner-only download, cover display, file refused on wrong type.
- [ ] Account deletion as a test member; an owner cannot delete their account.
- [ ] Rate limiting still applies behind Vercel's proxy; forwarded-IP handling reviewed (PILOT_OPERATIONS.md "Proxy, rate limits and logs"). Never weaken throttling to pass a test.

## 10. Scheduler for mail and digests

Nothing schedules these routes today, and `vercel.json` deliberately has **no `crons` entry**: adding one creates a scheduled (and, at a per-minute cadence, paid-plan) dependency, so it is the owner's decision.

| Route | Cadence | Effect |
| --- | --- | --- |
| `GET /api/internal/mail` | About every minute | Sends at most 2 queued emails per call |
| `GET /api/internal/digests` | About hourly | Queues at most 100 due digests; the mail route sends them |

Both require `Authorization: Bearer <CRON_SECRET>` in a **header**. Never put the secret in a URL or query string, where it would reach logs.

- [ ] Choose one scheduler dedicated to this project and record it:
  - **Vercel Cron Jobs.** Vercel sends `Authorization: Bearer $CRON_SECRET` automatically when `CRON_SECRET` is set in the project. A once-a-minute schedule needs a plan that allows it. If chosen, add this to `vercel.json` in a reviewed commit:

    ```json
    "crons": [
      { "path": "/api/internal/mail", "schedule": "* * * * *" },
      { "path": "/api/internal/digests", "schedule": "0 * * * *" }
    ]
    ```
  - **Another scheduler** (for example Google Cloud Scheduler in the REUNIR project) that can send the header from its own secret store. It must not be shared with another project.
- [ ] Manual check before enabling, from a local shell where `CRON_SECRET` is set (do not paste it into chat):

  ```sh
  curl -sS -H "Authorization: Bearer $CRON_SECRET" https://<staging-hostname>/api/internal/mail
  ```

  Expect JSON with `sent` and `failed` counts, not 403. It also records the worker timestamp.
- [ ] After enabling, the Pilot console worker timestamp advances and a test invitation arrives within a few minutes. A heartbeat does not prove continued scheduling.

## 11. Backups and a restore rehearsal

Detail: SETUP.md sections 3 and 8; RELEASE_GATES.md step 8.

- [ ] Before any member data, confirm Neon point-in-time restore covers the agreed window.
- [ ] Take a logical backup with the migration credential, for example `pg_dump --format=custom` with a client at least as new as the server, into encrypted storage controlled by the owner. Never into the repository.
- [ ] Rehearse: restore into a **separate, empty** Neon branch or project. Then on that copy: `npm run pilot:check -- --migrations --json` (every migration matching), confirm `reunir_app` exists with only its grants (rerun `npm run db:grant-runtime` if the restore did not carry roles), `npm run pilot:check -- --database --json` passes, row counts match, and row-level security still blocks a cross-tenant read.
- [ ] Record the restore time and who performed it. Repeat before any wider pilot.

## 12. Monitoring

- [ ] An uptime monitor, dedicated to this project, on `/api/health/live` (application) and `/api/health` (database path). Alert the named operator.
- [ ] Vercel function logs reviewed for errors after each deploy. Logs must never contain tokens, email payloads, passwords or message text (PILOT_OPERATIONS.md); check that reset-link URLs are not retained in broadly accessible logs.
- [ ] Queue health from the migration connection, aggregate only: `SELECT status, count(*) FROM email_outbox GROUP BY status;`. Never decrypt payloads to check health.
- [ ] Neon usage and Resend sending limits reviewed weekly during the pilot. Set spending caps where the plans allow.

## 13. Rollback

- [ ] Application: promote the previous good deployment in Vercel (instant rollback). The schema is additive, so earlier application builds keep working against it; check BUILD_STATUS.md for any noted exception before relying on this.
- [ ] Scheduler: disable it before rolling back if mail is misbehaving. Do not reset or replay jobs in bulk.
- [ ] Database: no downgrade scripts exist. Restore only by the backup plan in section 11, into a new branch, then repoint `DATABASE_URL`. Never delete tables by hand.
- [ ] Secrets: rotate `BETTER_AUTH_SECRET` (signs everyone out and makes every stored two-step sign-in secret and backup code unreadable, so everyone with two-step sign-in must set it up again), `CRON_SECRET` (update the scheduler at the same time) or the database password if exposed. Rotating `EMAIL_ENCRYPTION_KEY` makes queued mail unreadable; drain or re-enqueue first.
- [ ] To close the pilot entirely: disable the scheduler, then remove the Vercel deployment's environment, keeping the database and backups until retention is decided.

## 14. Evidence log and approval

Keep a dated record (outside the repository if it contains anything personal) of: commit SHA deployed; preflight output; `pilot:check` outputs; health responses; each section 9 test with pass or fail; sender verification date; scheduler choice; restore rehearsal. The lead then records verified facts in BUILD_STATUS.md and SESSION_HANDOFF.md.

Going live to real pilot members needs all of:

- [ ] **Owner** approval in writing, after reading the evidence log. Nothing in the app or this runbook grants it automatically.
- [ ] **Independent moderator** appointed and briefed on reports and escalation.
- [ ] **Operator** confirmation that scheduler, monitoring, backups and restore are in place.
- [ ] Owner sign-off on privacy notice, retention, support contact and approved content (RELEASE_GATES.md "Evidence, not assumptions").

Community review inside REUNIR is community review, not external accreditation; do not describe the pilot otherwise.
