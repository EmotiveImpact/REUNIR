# The scan host: clamd and the scan worker on one small machine

Uploads are scanned by a worker beside ClamAV's clamd, never inside a Vercel request (decision 042). This folder runs both on one always-on machine dedicated to REUNIR (decision 047). **Nothing here has been provisioned.** The owner creates the machine only after approving the cost in [STAGING_LAUNCH.md](../../docs/STAGING_LAUNCH.md).

## What runs

| Container | Image | Reaches | Reached by |
| --- | --- | --- | --- |
| `clamd` | Official `clamav/clamav:1.4`, which runs freshclam to keep signatures current | ClamAV's signature mirror, over HTTPS | Only `worker`, on the compose project's private network |
| `worker` | This repository's `Dockerfile`, running `scripts/scan-worker.ts` | Neon (as `reunir_app`), the bucket, `clamd` | Nothing: it serves no port |

`compose.yaml` publishes no port. The machine's firewall must allow no inbound traffic except the administrator's SSH, ideally only through Google's Identity-Aware Proxy range `35.235.240.0/20`.

## Machine size and cost

clamd holds about 1.2 GB of signatures in memory. Reloading them without pausing scans briefly doubles that, so `compose.yaml` pauses scanning during the daily reload (`ConcurrentDatabaseReload no`) unless `CLAMD_CONCURRENT_RELOAD=yes` is set.

| Google Compute Engine machine | Memory | On-demand price in London (europe-west2), checked 5 October 2026 | Fit |
| --- | --- | --- | --- |
| e2-micro (free tier) | 1 GB | Free in some US regions only | Too small for clamd |
| **e2-small** | 2 GB | About $16 a month | Enough with the reload pause; recommended for staging |
| e2-medium | 4 GB | About $31 a month | Room for concurrent reloads and larger video |

Add about $4 a month for the machine's public address (needed for outbound updates unless Cloud NAT is set up) and about $2 for a 20 GB disk. Bucket storage at staging size costs pennies. Confirm on Google's pricing pages before creating anything.

## Steps for the owner

All in the Google Cloud project that holds the REUNIR bucket, in the same region.

1. Create the machine: Debian 12, e2-small, 20 GB balanced disk, **no** "Allow HTTP" or "Allow HTTPS" traffic. Restrict the default SSH rule to `35.235.240.0/20` and connect through the console's SSH button.
2. Install Docker Engine with the Compose plugin by following Docker's own instructions for Debian.
3. Fetch the source: add a read-only deploy key for this machine to the GitHub repository, then clone it. Never copy a personal token onto the machine.
4. Fill in the values, which stay on this machine:

   ```sh
   cd REUNIR/platform/deploy/scan-host
   cp scan.env.example scan.env && chmod 600 scan.env
   nano scan.env      # the same DATABASE_URL, GCS_BUCKET and GCS_CREDENTIALS_JSON as Vercel
   ```

5. Start it: `docker compose up -d --build`. The first start downloads signatures, which takes a few minutes before clamd reports healthy and the worker starts.
6. Check it: `docker compose exec worker node --import tsx scripts/scan-check.ts` must pass all three lines, and `docker compose logs worker` shows `scan-worker.started`.
7. On Vercel, set `GCS_BUCKET`, `GCS_CREDENTIALS_JSON` and `CLAMAV_HOST=clamd` (on the API it only switches scanning on; the API never connects), then redeploy. After a test upload, the owner's Pilot console shows "Virus scan worker observed" as passed.

## Keeping it current

After a release that changes the worker or the scanning code: `git pull && docker compose up -d --build`. To stop scanning in an emergency, `docker compose stop worker`: uploads then wait as "being checked" and nothing unscanned is ever served.
