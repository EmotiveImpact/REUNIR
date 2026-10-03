# Setup and deployment

24 September 2026. These are reproducible setup instructions, not evidence of an existing cloud deployment.

For the ordered, checkable path from nothing to a private staging pilot, see [LAUNCH_RUNBOOK.md](LAUNCH_RUNBOOK.md). None of its steps has been carried out.

## 1. Frontend demo

Use Node 22.12+ and Git. From `REUNIR/platform`, run `npm ci`, then `npm run dev`. The local address is `http://127.0.0.1:5173`. No `.env` is required for demo mode.

The supplied standalone `REUNIR-preview.html` is another way to try the same compiled React app. It uses hash URLs on ordinary file/web origins and an in-memory router only when embedded in an about: document. A private browser that rejects localStorage keeps changes only in memory.

## 2. Local full-stack development

Copy `.env.example` to `.env`. Set `VITE_DATA_MODE=live`, `APP_ORIGIN=http://127.0.0.1:5173`, and `DATABASE_URL` to a development Postgres database. `DATABASE_URL=pglite:.local/reunir` is an explicit, local, persistent embedded-PostgreSQL alternative, not a Neon connection. Never open the same PGlite directory from two processes at once.

Generate an authentication secret locally:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Put the result in `BETTER_AUTH_SECRET`. Do not use a published example secret. Then:

```sh
npm run db:migrate
```

Before starting the server, set `BOOTSTRAP_EMAIL`, `BOOTSTRAP_NAME` and a private `BOOTSTRAP_PASSWORD` of at least 12 characters. Set `COMMUNITY_SLUG=code-black` and `COMMUNITY_NAME=Code Black` or your intended values. Run:

```sh
npm run db:owner
```

This creates a real password-hashed account and an empty community with one owner and one initial space. Save the printed organisation ID, but never publish the password. Clear `BOOTSTRAP_PASSWORD`, then run `npm run dev`. In live mode that command starts the API and Vite together. Sign in with the account you provisioned. Public signup stays disabled.

For another member, stop the development server when using PGlite, set `COMMUNITY_ID` to the saved ID and set new bootstrap account values. Run `npm run db:member`. The command always adds the new account as a member, not an administrator. Use a private channel to give the pilot member their credentials. Alpha 03 adds personal invitations and password recovery. Prefer normal onboarding through the invitation UI; the manual member CLI is retained only for controlled administrative provisioning. See PILOT_OPERATIONS.md to configure the mail provider and worker.

The provisioning commands are one-time operations, not idempotent account updates. Reusing an email or organisation slug fails rather than replacing data. If an account is created but the subsequent community step fails, inspect it administratively and reconcile it; do not blindly rerun or delete existing customer data.

`npm run db:seed` is for disposable research databases only. It requires `ALLOW_FICTIONAL_SEED=yes`, refuses production, and is unnecessary for the browser demo. Seeded fictional membership IDs do not create usable authentication accounts.

## 3. Neon

Create/select a dedicated REUNIR Postgres database and an isolated staging branch. Do not share another product's database accidentally. Configure database and compute regions appropriately for your customer-data requirements.

Keep two distinct credentials:

- `MIGRATION_DATABASE_URL`: direct administrative connection, used only from a trusted workstation or dedicated migration job.
- `DATABASE_URL`: pooled connection for a restricted, non-owner role with no RLS bypass. This is the deployed application's credential.

Run migrations with the administrative connection. To create a dedicated application role, generate another base64url secret locally, set `DB_RUNTIME_PASSWORD` and run `npm run db:runtime-role`. This creates `reunir_app` with explicit table privileges and no administrative privileges. It refuses to modify an existing role. Clear the password variable afterwards and construct the pooled connection URL for that role securely in the Neon/Vercel interfaces.

Do not create the runtime role through a privileged-role shortcut that inherits administrative access. Production startup checks for superuser, BYPASSRLS and tenant-table ownership and refuses an unsafe role. Schema ownership remains with the migration credential. If your provider disallows role creation, arrange the equivalent restricted role with its administrator rather than disabling the check.

Provision the first empty community with the migration connection before deploying. Remove `MIGRATION_DATABASE_URL`, all `BOOTSTRAP_*` values and `DB_RUNTIME_PASSWORD` from deployment environments. Test actual Neon login, cross-tenant reads/writes, rollback, pooled connection reset and restore before inviting real members.

## 4. Vercel

The prepared application root is **`platform`**, not the repository root. Select Node 22, install with `npm ci`, build with `npm run build`, output `dist`. The included `vercel.json` routes `/api/*` to the Node function in `api/index.ts`; the frontend uses hash routing, so no catch-all rewrite should swallow API requests.

For a real connected deployment, set these environment variables in the intended Vercel project:

```
VITE_DATA_MODE=live
APP_ORIGIN=https://your-confirmed-hostname
DATABASE_URL=<restricted pooled Neon connection>
BETTER_AUTH_SECRET=<a generated server secret>
NODE_ENV=production
```

`VITE_DATA_MODE` is a build-time public flag. Database/auth/storage credentials must **never** use a `VITE_` prefix. Each preview environment needs its own correct origin and isolated database context. Do not use the production database for public preview branches.

Deploy, then verify `/api/health`, `/api/session`, sign-in cookies, two-user/two-tenant negative tests, proof review, mobile rendering and upload configuration. This target has not yet been exercised on Vercel; build settings, routing, function bundle size and runtime behaviour still need live verification. Missing secrets return a configuration error, never a demonstration account.

## 5. Self-hosting

Build with `VITE_DATA_MODE=live npm run build`; run `npm start` behind an HTTPS reverse proxy with the correct `APP_ORIGIN`, restricted Postgres URL and auth secret. The same Hono app serves the API and compiled assets. The included Dockerfile is a starting deployment recipe; no Docker image or hosted container was built during this release.

`HOST` defaults to loopback; set `HOST=0.0.0.0` inside the container. Expose the service only behind your intended proxy. Make IP-header trust explicit at the proxy/auth layer before opening public login. The current auth fallback shares a rate bucket when an authentic client IP is unavailable; this is conservative, but not a complete abuse-prevention policy.

## 6. Optional Google Cloud Storage

This adapter targets **Google Cloud Storage**, not Google Drive. Use a private bucket with uniform access and no public object policy. Configure exact application-origin CORS for direct multipart uploads. Grant the service identity only the required bucket/object permissions and signing capability. Prefer application default credentials/workload identity; exported service keys, if used, belong only in the server secret store.

Set `GCS_BUCKET`. The adapter can use ADC or server-only `GCS_CREDENTIALS_JSON`. It issues a five-minute signed POST policy constrained to the exact allowed content type and declared byte size, then verifies metadata on completion. Downloads are owner-only, attachment-disposition, two-minute signed URLs. Acceptable types are JPEG, PNG, WebP and PDF, up to 10 MiB.

HTTP flow:

1. Authenticated POST to `/api/organisations/:slug/uploads` with `{name,contentType,sizeBytes}` returns `{id,url,fields,method:'POST'}`.
2. Submit all returned fields and then the file using `FormData` directly to the storage URL.
3. POST `{}` to `/api/organisations/:slug/uploads/:id/complete`.
4. Authorised GET to `/api/organisations/:slug/uploads/:id/download` returns a short-lived URL.

Cookie-authenticated POSTs require the exact application `Origin` and JSON content type. Never proxy file bytes through the 64 KiB JSON API. Member uploads through this flow are private to their uploader.

**Lesson files (Alpha 09).** Creator Studio uses the same endpoints with `{purpose:'lesson_resource',trackId,name,contentType,sizeBytes}`. Only active owners/admins can start them; PDF, DOCX, PPTX, XLSX, JPEG, PNG and WebP up to 10 MiB are accepted. Completion verifies the file signature and pins the object generation. Learners download through `/api/organisations/:slug/lessons/:lessonId/resources/:resourceId/download`; drafts and revisions have owner/admin-only equivalents. `/api/account/capabilities` reports `resourceUploads`. Apply migration 0009 and rerun `npm run db:grant-runtime` before starting this version. Bucket CORS needs the exact application origin with `POST`; signed downloads are navigations and need no CORS. Do not configure a lifecycle rule that deletes `lesson-resources/` objects, because revision history references them. See LESSON_RESOURCES.md.

**Task files (Alpha 29).** Project teams attach files to tasks through the same endpoints with `{purpose:'task_file',taskId,name,contentType,sizeBytes}`: the same types and 10 MiB limit, the same verification, keys under `task-files/{project}/`. Downloads go through `/api/organisations/:slug/tasks/:taskId/files/:fileId/download`; open workboards poll `/api/organisations/:slug/projects/:projectId/changes` every five seconds. Apply migration 0029 (no grant changes). Do not configure a lifecycle rule that deletes `task-files/` objects. See PROJECT_WORK.md.

**Cover images (Alpha 11).** Track and project covers use the same endpoints with `{purpose:'cover_image',subject:'track'|'project',subjectId,contentType,sizeBytes}`. Owners and administrators can start track covers; a project's owner can also start its cover. JPEG, PNG and WebP up to 3 MiB are accepted, and completion checks the signature and the declared dimensions (16 to 4,096 pixels) on the pinned generation. Readers fetch bytes from `/api/organisations/:slug/covers/:kind/:subjectId/:fileId`, which checks access on every request and caches privately for an hour. `/api/account/capabilities` reports `coverUploads`. Apply migration 0011 and rerun `npm run db:grant-runtime`. The bucket needs no new CORS rule beyond the `POST` rule above; covers are served by the application, never by signed links. Objects under `covers/` that nothing displays are pruned by later cover uploads after an hour. See COVERS.md.

**Track instructors (Alpha 12).** Apply migration 0012 and rerun `npm run db:grant-runtime`, which grants the new `track_instructors` table without UPDATE. No storage or environment change is needed. See INSTRUCTORS.md.

**Cover library (Alpha 13).** Apply migration 0013 and rerun `npm run db:grant-runtime`, which grants the new `cover_library` table without UPDATE. Library pictures use the same upload endpoints with `{purpose:'cover_library',contentType,sizeBytes}` (owners and administrators only), are listed with the `cover.library.add` command and are served from `/api/organisations/:slug/cover-library/:itemId`. Their objects live under `organisations/{organisation}/covers/library/`; no new bucket rule or environment variable is needed. The development seed lists one fictional picture whose object does not exist in a real bucket, as with the seeded lesson worksheet, so connected development shows a plain panel for it. See COVERS.md.

**Learner records (Alpha 14).** Apply migration 0014; no runtime grant changes. Members download their record from `/api/organisations/:slug/me/learning-record`. The operator commands `npm run db:erase-learner` and `npm run db:prune-covers` use the migration connection and need an active owner's user ID in `AUTHORISED_BY`; both are dry runs unless `ERASE=yes` or `PRUNE=yes`. See LEARNER_RECORDS.md.

**Account deletion (Alpha 15).** Apply migration 0015 and rerun `npm run db:grant-runtime`: the runtime role's grant on `quiz_attempts` keeps DELETE, which the new row policies allow only for the acting person's own attempts while they delete their own account. People delete their account from **Your account** through `POST /api/account/delete`, which checks the current password with Better Auth. No storage, email or environment change is needed; private files are removed from the configured bucket after the deletion commits, and queued mail to the address is withdrawn. See ACCOUNTS.md.

Real Google credentials, CORS, IAM, billing, malware scanning, orphaned-object cleanup and member attachments for posts or missions remain staging/public-launch work.

**Knowledge checks (Alpha 10).** No new environment variables or services. Apply migration 0010 with the administrative connection and rerun `npm run db:grant-runtime`, which revokes UPDATE and DELETE on `quiz_attempts` from the runtime role and grants UPDATE only on the review columns. (From Alpha 15 the role keeps DELETE, bounded by row security to a person's own attempts during their own account deletion.) Commands use the existing `/api/organisations/:slug/commands` route. See ASSESSMENTS.md.

## 7. Database maintenance

Migrations do not run automatically on cold starts. All ordered migration files have stored checksums and share an advisory lock. Migrations 0001 and 0002 are unchanged. Alpha 03 adds 0003_pilot_access.sql and 0004_private_messaging.sql; later alphas add 0005 to 0010, each additive. Future changes require a new reviewed migration. There is no destructive reset script or automatic production seed.

The first repository implementation serialises mutation operations within one community. It is deliberately bounded to 5,000 rows per domain collection and 20,000 rows per complete workspace snapshot. At the boundary it fails explicitly. Before a larger rollout, replace broad reads with domain-specific pagination, and add outbox delivery/retry and retention policies. Do not present this alpha as a benchmarked high-scale SaaS.

## Official integration references

- https://vercel.com/docs/frameworks/frontend/vite
- https://hono.dev/docs/getting-started/vercel
- https://better-auth.com/docs/adapters/drizzle
- https://www.postgresql.org/docs/current/ddl-rowsecurity.html
- https://node-postgres.com/features/ssl
- https://docs.cloud.google.com/storage/docs/access-control/signed-urls

These references describe the platforms. Test evidence for this specific build is in `evidence/`.


## 8. Upgrading Alpha 01 to Alpha 02

First rehearse against an isolated staging copy and take a restorable backup. Keep the old application build and database backup together. No customer production database has been upgraded by this delivery.

1. Pause application writes during the first rollout. Run `npm run db:migrate` using the separate administrative migration connection.
2. For an **existing** `reunir_app` role, run `npm run db:grant-runtime` with that migration connection. This grants only the current application tables, including the eight new tables. It does not rotate the password or grant schema/migration ownership. For a new installation, `db:runtime-role` already includes the current tables.
3. Verify `npm run db:check`, then run the application with its restricted runtime connection. Keep administrative credentials off Vercel and the web server.
4. Confirm old posts/projects/members remain, new purpose collections are empty, and an owner can add a purpose. Check two tenants and two roles, private goals, source visibility, evidence reviews and publication on actual Neon pooling.
5. Resume the invitation-only pilot after those checks and a restore rehearsal. There is no automatic destructive downgrade script. Prefer rolling back the application with the additive schema retained; database restoration must follow the backup plan rather than casual table deletion.

The supplied test upgrades a populated local PostgreSQL-compatible 0001 database and confirms data preservation, but it is not a substitute for your production backup or pooled Neon rehearsal.

Old browser demo data is also preserved. It will have empty purpose collections after upgrade. To explore the new **fictional** fixture from a clean slate, open the Interactive demo help and explicitly choose Reset the fictional demo. This clears that preview's local demonstration activity, never live data.

## 9. Verify the delivered release

Run `npm run typecheck`, `npm test`, `npm run build`, `npm run bundle:preview`, then `npm run test:browser`. The browser command runs both the retained community regression journey and the purpose/evidence journey. Set `CHROMIUM_PATH` only when using an existing compatible Chromium install. Evidence paths are `evidence/alpha02/`.


## Upgrade from Alpha 02 to Alpha 03

Pause writes and take/rehearse a restorable backup. Use the administrative direct connection to run `npm run db:migrate`, then `npm run db:grant-runtime`. The additions are invitation/email tables and participant-private messaging tables plus a generated sequence. Migration history checksums reject edits to already-applied migrations. Existing purposes, private goals, projects and evidence are not reset.

Deploy the new runtime only after grants. Set mail/scheduler secrets securely; do not set MIGRATION_DATABASE_URL on the running API. Start with an empty owner-provisioned staging community, not demo data. Verify invitation acceptance, reset/cookie revocation, private inbox access and member suspension before using real member accounts.

Local commands: `npm run test:http` exercises a real Node HTTP server with local PGlite and captured mail. `npm run test:browser:connected` is the staged full-browser check in a normal network-enabled Chromium environment. It could not be completed in the current sandbox because Chromium navigation to the local server was blocked by administrator policy; its failed/block report is retained separately. The 85 demo browser checks do not substitute for that gate.
