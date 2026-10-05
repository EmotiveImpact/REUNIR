# Staging launch: what the owner supplies, in order

**Status: prepared, nothing provisioned. The owner chose Vercel Hobby on 5 October 2026.** No account, project, database, domain record, sender, scheduler or deployment has been created for this. Every step below waits for the owner's go-ahead. This page is the short version for the owner; [LAUNCH_RUNBOOK.md](LAUNCH_RUNBOOK.md) keeps every check and its reason, and wins where the two differ. Decision 046 records the shape chosen here.

The goal is a **private, invitation-only staging site** the owner can sign in to and try with a few consented test addresses. It is not a public launch, and no real pilot member is invited until the runbook's section 14 sign-off.

## The shape of the first staging round

| Part | Choice | Why |
| --- | --- | --- |
| Website and API | One new Vercel project, root directory `platform`, address `<name>.vercel.app` | Already configured in `vercel.json`; no domain needed for the site itself |
| Database | One new Neon project, region chosen once for everything | Dedicated to REUNIR, with a restricted runtime role |
| Email | Resend. **First round: its shared test sender `onboarding@resend.dev`** (recommended to the owner on 5 October 2026); later a sending subdomain of a domain the owner buys, such as `mail.<your-domain>` | The test sender needs no domain but delivers only to the Resend account's own address, so the owner can sign up, confirm and reset a password, but invitations to anyone else wait for a real domain. A made-up domain cannot work: Resend sends only from a domain whose DNS the owner can prove |
| Scheduler | **Google Cloud Scheduler** with Vercel Hobby (chosen), or Vercel Cron Jobs on Pro | Queued mail goes out about every minute; Hobby cron jobs run at most once a day. Steps below |
| File uploads | **Off unless the owner approves the scan host** | Uploads need a bucket and a small always-on machine running clamd and the scan worker ([deploy/scan-host](../deploy/scan-host/README.md), decisions 042 and 047). Vercel never talks to the scanner |

Text, posts, conversations, goals, projects, courses with links and embeds, invitations and two-step sign-in all work without a bucket. Uploads, lesson files and covers say they are unavailable.

## Costs, as checked on 5 October 2026

Confirm each on the provider's own pricing page before signing up; these change.

| Service | Plan for staging | Cost | Limits that matter |
| --- | --- | --- | --- |
| Vercel | **Hobby (chosen)** | Free | Personal, non-commercial use only; cron jobs at most once a day, so mail uses Cloud Scheduler |
| Vercel | Pro (not chosen) | $20 a month per team member | Per-minute cron jobs; commercial use allowed |
| Neon | Free | Free | 0.5 GB storage, 6 hour restore window. Move to a paid plan with a longer restore window before real members |
| Resend | Free | Free | 100 emails a day, 3,000 a month, one domain |
| Domain | None for the first round; one bought later | About £10 a year from any registrar | Needed only before inviting anyone other than the owner. Only DNS access is needed, to add Resend's records |
| Google Cloud | Cloud Scheduler, three jobs | Free: three jobs per billing account, then $0.10 a job a month | Needs a billing account with a card, even when nothing is charged |
| Google Cloud (optional) | Scan host: one e2-small machine, plus a bucket | About $22 a month (machine about $16, address and disk about $6); bucket pennies at staging size | Only if uploads are wanted now. e2-micro is too small for the virus scanner |

Total for the first round on the chosen Hobby route: **nothing**, within the free limits above. Adding uploads now would add about $22 a month.

## What only the owner can do

None of these values ever goes into chat, an issue, a commit or a screenshot. The repository's scripts generate the app's own secrets on the owner's computer, and the preflight checks everything without printing a value.

1. **Say go** (given 5 October 2026, on Hobby), with the region confirmed as Frankfurt (Neon and Vercel `eu-central-1`, Google Cloud `europe-west3`). Email starts on Resend's test sender unless the owner buys a domain.
2. **Create the accounts**, each used only for REUNIR: Neon, Vercel (signed in with the GitHub account that owns the repository), Resend and Google Cloud (a new project with a billing account, for the scheduler).
3. **Neon**: create the project and a database named `reunir`. Keep the owner connection string on your own computer only.
4. **Resend**: sign up with the email address you will use on Ferven, create an API key with sending access, and set `EMAIL_FROM=Ferven <onboarding@resend.dev>`. The preflight warns that only your own address will receive mail; that is expected for now. Later, to invite others: add a sending subdomain of a domain you own, publish the DNS records it shows, wait for "verified", switch `EMAIL_FROM` to an address on it and replace the key with one restricted to that domain.
5. **On your own computer**, from `platform/` after `npm ci` (runbook sections 3 and 4, with only the owner connection string set as `MIGRATION_DATABASE_URL`):
   - `npm run db:migrate`, then `npm run pilot:check -- --migrations --json`
   - generate the runtime password as the runbook shows, then `npm run db:runtime-role` and `npm run db:grant-runtime`
   - set your own sign-in details as `BOOTSTRAP_*`, then `npm run db:owner`, then unset them
6. **Fill in the staging values**, again on your computer:

   ```sh
   cp .env.staging.example .env.staging
   npm run launch:secrets -- --env-file .env.staging     # generates the three app secrets; prints no value
   # open .env.staging in an editor and replace each <fill: ...> with the real value
   npm run launch:preflight -- --env-file .env.staging   # must end with "0 failed"
   ```

7. **Vercel**: create the project from the repository with root directory `platform`, paste `.env.staging` into its Environment Variables page, mark the secrets sensitive, deploy. Keep `.env.staging` on your computer until the scheduler jobs below exist, then delete it or move it to an encrypted store.

If you prefer, steps 5 to 7 can run in a Claude session on your own computer, so the values stay on your machine and never pass through this chat.

## The scheduler on Hobby: three Google Cloud Scheduler jobs

Do this after the site answers `npm run launch:smoke` cleanly. Use a Google Cloud project created only for REUNIR (the same one will later hold the bucket and the scan host) in the region chosen for everything, for example `europe-west3` (Frankfurt). Enable the Cloud Scheduler API when the console asks.

From `platform/`, in the same shell, so the secret is read from the ignored file and never typed or pasted:

```sh
HOST=https://<name>.vercel.app
REGION=europe-west3
CRON_SECRET=$(grep '^CRON_SECRET=' .env.staging | cut -d= -f2-)
if [ -z "$CRON_SECRET" ]; then echo "CRON_SECRET not found: restore .env.staging first"; else
for job in "mail|* * * * *" "digests|0 * * * *" "retention|30 3 * * *"; do
  gcloud scheduler jobs create http "reunir-${job%%|*}" --location="$REGION" --schedule="${job#*|}" --time-zone=Etc/UTC \
    --uri="$HOST/api/internal/${job%%|*}" --http-method=GET --attempt-deadline=30s \
    --headers="Authorization=Bearer $CRON_SECRET"
done
fi
unset CRON_SECRET
```

The secret travels only in the request header, never in the address. It is stored in the job settings, so only the owner should have access to this Google Cloud project. Before relying on the jobs, run `retention` once by hand with `?dry=1` from a local `curl` as the runbook shows (section 10), then check that the Pilot console's worker time moves forward within a few minutes. If `CRON_SECRET` is ever changed on Vercel, update all three jobs at the same time with `gcloud scheduler jobs update http ... --update-headers`.

## What Claude does once the site is up

- Runs `npm run launch:smoke -- --origin https://<name>.vercel.app`, which sends only anonymous requests and confirms the live API, the database path, the security headers and that the scheduler routes refuse strangers.
- Confirms the three scheduler jobs are refused without their header and that queued mail drains.
- Works through the signed-in and privacy checks in runbook section 9 with you, using consented test addresses only, and records the results in BUILD_STATUS.md.
- Tries a Content-Security-Policy in report-only mode against the live site.

## Before real pilot members

Everything in runbook sections 11 to 14 still applies: a backup and a restore rehearsal, an uptime monitor, an independent moderator, and your written sign-off. Community review inside Ferven is community review, not external accreditation.
