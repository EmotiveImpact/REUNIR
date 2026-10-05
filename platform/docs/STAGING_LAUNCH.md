# Staging launch: what the owner supplies, in order

**Status: prepared, nothing provisioned.** No account, project, database, domain record, sender, scheduler or deployment has been created for this. Every step below waits for the owner's go-ahead. This page is the short version for the owner; [LAUNCH_RUNBOOK.md](LAUNCH_RUNBOOK.md) keeps every check and its reason, and wins where the two differ. Decision 046 records the shape chosen here.

The goal is a **private, invitation-only staging site** the owner can sign in to and try with a few consented test addresses. It is not a public launch, and no real pilot member is invited until the runbook's section 14 sign-off.

## The shape of the first staging round

| Part | Choice | Why |
| --- | --- | --- |
| Website and API | One new Vercel project, root directory `platform`, address `<name>.vercel.app` | Already configured in `vercel.json`; no domain needed for the site itself |
| Database | One new Neon project, region chosen once for everything | Dedicated to REUNIR, with a restricted runtime role |
| Email | Resend, on a sending subdomain of a domain the owner controls, such as `mail.<your-domain>` | Invitations, password recovery and email confirmation need it; a dedicated subdomain keeps other projects' reputation separate |
| Scheduler | Vercel Cron Jobs on a Pro plan (recommended), or a free Hobby plan plus Google Cloud Scheduler | Queued mail goes out about every minute; Hobby cron jobs run at most once a day |
| File uploads | **Off for the first round** (no bucket) | Vercel functions cannot reach a private virus scanner, and a scanner must never be open to the internet. Uploads return once background scanning lands (the "Background virus scanning" work) |

Text, posts, conversations, goals, projects, courses with links and embeds, invitations and two-step sign-in all work without a bucket. Uploads, lesson files and covers say they are unavailable.

## Costs, as checked on 5 October 2026

Confirm each on the provider's own pricing page before signing up; these change.

| Service | Plan for staging | Cost | Limits that matter |
| --- | --- | --- | --- |
| Vercel | Pro (recommended) | $20 a month per team member | Per-minute cron jobs; commercial use allowed |
| Vercel | Hobby (alternative) | Free | Personal, non-commercial use only; cron jobs at most once a day, so mail needs another scheduler |
| Neon | Free | Free | 0.5 GB storage, 6 hour restore window. Move to a paid plan with a longer restore window before real members |
| Resend | Free | Free | 100 emails a day, 3,000 a month, one domain |
| Domain | One the owner already holds | Usually nothing extra | Only DNS access is needed, to add Resend's records |
| Google Cloud | Not needed for the first round | Free | Only for the Hobby scheduler alternative, and later for the bucket |

Recommended total for the first round: **$20 a month** (Vercel Pro), or nothing on the Hobby alternative.

## What only the owner can do

None of these values ever goes into chat, an issue, a commit or a screenshot. The repository's scripts generate the app's own secrets on the owner's computer, and the preflight checks everything without printing a value.

1. **Say go**, and choose Pro or Hobby, the region (for example Frankfurt, `eu-central-1`, for members in the UK and Europe) and the sending domain.
2. **Create the accounts**, each used only for REUNIR: Neon, Vercel (signed in with the GitHub account that owns the repository) and Resend.
3. **Neon**: create the project and a database named `reunir`. Keep the owner connection string on your own computer only.
4. **Resend**: add the sending subdomain, publish the DNS records it shows at your domain's DNS provider, wait for "verified", then create a sending-only API key for that domain.
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

7. **Vercel**: create the project from the repository with root directory `platform`, paste `.env.staging` into its Environment Variables page, mark the secrets sensitive, deploy, then delete the local file or move it to an encrypted store.

If you prefer, steps 5 to 7 can run in a Claude session on your own computer, so the values stay on your machine and never pass through this chat.

## What Claude does once the site is up

- Runs `npm run launch:smoke -- --origin https://<name>.vercel.app`, which sends only anonymous requests and confirms the live API, the database path, the security headers and that the scheduler routes refuse strangers.
- Opens a reviewed pull request adding the cron jobs to `vercel.json` (Pro), or writes the exact Cloud Scheduler settings (Hobby).
- Works through the signed-in and privacy checks in runbook section 9 with you, using consented test addresses only, and records the results in BUILD_STATUS.md.
- Tries a Content-Security-Policy in report-only mode against the live site.

## Before real pilot members

Everything in runbook sections 11 to 14 still applies: a backup and a restore rehearsal, an uptime monitor, an independent moderator, and your written sign-off. Community review inside Ferven is community review, not external accreditation.
