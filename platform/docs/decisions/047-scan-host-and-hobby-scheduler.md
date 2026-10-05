# Decision 047: a packaged scan host, and Google Cloud Scheduler for staging on Vercel Hobby

Status: prepared in Alpha 47, verified locally as far as this environment allows; nothing provisioned. Date: 5 October 2026.

## Problem

Two choices from decision 046 needed concrete settings. Decision 042 moved virus scanning into a worker beside clamd, so uploads no longer need Vercel to reach the scanner, but nothing described where that worker and clamd would run, how they stay off the internet, or what they cost. And on 5 October 2026 the owner chose Vercel Hobby, whose cron jobs run at most once a day, so the per-minute mail queue needs another scheduler.

## Decision

- **`platform/deploy/scan-host/`** holds a Compose project with two containers: the official `clamav/clamav:1.4` image (clamd and freshclam) and the repository's own image running `scripts/scan-worker.ts`. No port is published; only the worker reaches clamd, by name, on the project's private network. clamd's `StreamMaxLength` defaults to 25 MB and its concurrent signature reload is off, so a 2 GB machine is enough, at the cost of scans pausing briefly during the daily reload. The worker reads only `DATABASE_URL`, `GCS_BUCKET` and `GCS_CREDENTIALS_JSON` from `scan.env`, which git and the Docker build context both ignore.
- **Recommended host: one Google Compute Engine e2-small** (2 GB, about $16 a month in London on demand, plus about $6 for its address and disk), in the REUNIR Google Cloud project, with no inbound rule except the administrator's SSH through Identity-Aware Proxy. e2-micro is too small for clamd's signatures; e2-medium suits concurrent reloads and larger video.
- **Staging scheduler: three Google Cloud Scheduler HTTP jobs** (mail every minute, digests hourly, retention daily at 03:30 UTC), each sending `Authorization: Bearer <CRON_SECRET>` in a header. The commands in STAGING_LAUNCH.md read the secret from the ignored `.env.staging` so it is never typed or pasted. Three jobs fit Cloud Scheduler's free allowance per billing account. `vercel.json` gains no `crons` entry.
- **Email without a domain for the first round.** The owner asked for a made-up domain, which Resend cannot send from. Staging starts on Resend's shared test sender `onboarding@resend.dev`, which delivers only to the Resend account's own address: enough for the owner's sign-up, confirmation and password reset, not for invitations. The preflight warns whenever `EMAIL_FROM` uses `resend.dev`. A bought domain replaces it before anyone else is invited.
- A test guards the package: no published or exposed port, the worker's command and clamd address, the three expected values in the template, and both ignore rules.

## Alternatives considered

- **Cloud Run with clamd as a sidecar.** Managed and patched, but an always-on instance with the memory clamd needs costs several times the e2-small. Possible later if the operator would rather not patch a machine.
- **Vercel's own daily cron for retention, Cloud Scheduler for the rest.** Two schedulers to watch for one queue; one scheduler is simpler to rotate and to disable during a rollback.
- **A free third-party web cron service.** Rejected in decision 046: it would hold the secret in an account outside the owner's control.

## Consequences

Uploads can join staging once the owner approves the extra cost and creates the bucket and machine. The machine needs occasional operating-system updates and a `git pull` with a rebuild after releases that change scanning. The scheduler secret sits in Cloud Scheduler's job settings, readable by anyone with access to that Google Cloud project, so access stays with the owner. In this environment the Compose file was validated with `docker compose config`, but the worker image build could not finish (npm inside the build could not reach the registry through the sandbox proxy) and clamd could not download signatures, so neither container has been run end to end. Prices were read from public pages on 5 October 2026.
