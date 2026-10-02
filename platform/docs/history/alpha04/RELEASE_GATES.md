# Alpha 04 release gates

The Pilot console is an operational observation surface. It deliberately has no button that fabricates readiness. It is owner-only, not a new member dashboard.

## Read-only local checks

From `platform/`, install the lockfile dependencies. Keep real secrets in local environment settings, never chat or source control.

```sh
npm run pilot:check -- --json
npm run pilot:check -- --database --json
npm run pilot:check -- --migrations --json
```

Without flags, no network connection occurs. `--database` reads the runtime role using DATABASE_URL. `--migrations` reads digest history through a separate administrative MIGRATION_DATABASE_URL. It does not run DDL or grant privileges. The administrative URL is excluded from that CLI's runtime-view report because it was explicitly requested only for the inspection; production startup still forbids it. Do not leave the migration credential on the application server.

Exit 1 means at least one observed blocker. Exit 0 does not mean launch approval: manually verified gates remain unverified. Redaction is intentional. These are not general-purpose diagnostics that print DSNs, sender addresses or provider exceptions.

## Source publication

The release root has SOURCE_MANIFEST.json and scripts/publish_source.py. It verifies all source hashes before doing anything. From the release root:

```sh
python3 scripts/publish_source.py
python3 scripts/publish_source.py --prepare
```

The first command is offline verification. The second clones current main from EmotiveImpact/REUNIR into a new staging directory, creates a new integration branch, checks for differing existing files and stages a non-destructive import. It does not commit, push or merge. A directory can be supplied with --directory; it must be new or empty. Conflicts stop the import. Only the observed initial '# REUNIR' README placeholder may be replaced automatically.

After reviewing the source and target repository, `--push` additionally commits and pushes a new branch using the local Git credential mechanism. It never force-pushes or merges main. Do not treat prepare success as proof that your new CI passed. Prefer the staged directory for reconciling parallel work rather than overwriting a newer branch.

The accompanying Git bundle is another offline recovery route:

```sh
git clone REUNIR-Alpha-04.bundle REUNIR-recovered
cd REUNIR-recovered/platform
npm ci
npm run check
```

A bundle is a local Git history transport, not a GitHub deployment. The publication helper has pure file-integrity/collision tests but its remote network path was not executed here.

## Staging sequence

1. Use the intended dedicated database. Back up and rehearse restore before changing it. Do not reuse another project's Neon database.
2. Run all ordered migrations using a direct administrative connection. Existing runtime roles need `npm run db:grant-runtime`; migration alone does not update grants.
3. Configure the restricted runtime role's pooled connection, canonical HTTPS origin and separate random session/mail/worker secrets on the application. Keep bootstrap/migration credentials off the deployed runtime.
4. Set VITE_DATA_MODE=live at build time and rebuild. A server environment declaration does not rewrite an already built demo frontend.
5. Review the Vercel function routing, trusted forwarded-IP handling and actual cookie behaviour. Never weaken IP throttling just to make a test pass.
6. Configure a verified transactional sender and a separately approved scheduler. View the worker timestamp and tenant invitation queue. A heartbeat does not prove continued scheduling or inbox placement.
7. Receive an invitation and recovery message at consented test addresses. Run two-person/two-tenant hosted-browser tests, message reporting/blocks, suspension and private-goal checks.
8. Verify a restore into a separate empty staging database, including row policies and runtime grants. Approve retention, support and moderation responsibility before any wider pilot.

## Evidence, not assumptions

Configuration present, connection reachable, policy inspection passed, provider accepted, email received and recoverability demonstrated are different observations. Do not collapse them into one green status. The application's built-in manual gates always remain unverified until an external human release process records its own evidence. Group chat, payment setup and AI are not prerequisites to this small pilot.
