# Decision 041: hardening found in the pre-pilot review

Status: implemented in Alpha 41, verified locally; not deployed. Date: 5 October 2026.

## Problem

A review of main at `d726e8f` (every planned feature merged) found no cross-community or private-data authorisation gap, but it found four smaller openings that matter before real members arrive:

1. The original member upload route (`POST /api/organisations/:slug/uploads` without a `purpose`) let any active member keep asking for 10 MB upload policies. No screen uses it, nothing listed or removed those files, and nothing limited how many a person could hold. Lesson files, covers and task files already had limits.
2. Better Auth's own `POST /api/auth/update-user` was reachable. The app never uses it, and it skips the 2 to 80 character name rule that registration applies; that name is copied into the membership when an invitation is accepted.
3. One global invitation limit (200 a minute) covered looking up, accepting and registering, and looking up needs no sign-in. Enough anonymous look-ups could make every real invitee wait.
4. The static site sent no Strict-Transport-Security or Permissions-Policy from the repository; it relied on the host's defaults.

## Decision

- **Member uploads are bounded.** A person may have five unfinished member uploads in a community at once; one left unfinished for an hour stops counting. A person may keep fifty member files in each community. Beyond those, the route refuses with 429 `UPLOADS_IN_PROGRESS` or 409 `UPLOAD_LIMIT`. The check runs inside the community lock, so parallel requests cannot pass it together. The route itself stays, because its tests and account deletion rely on it.
- **`/api/auth/update-user` is closed** with 404, as `/api/auth/change-email` already is. Names change only through the app's own rules.
- **Each invitation route has its own global limit** (`invite-global:inspect`, `:accept`, `:register`), still 200 a minute each, beside the unchanged 30 a minute per peer.
- **`vercel.json` adds** `Strict-Transport-Security: max-age=31536000` (without `includeSubDomains` or preload, so it binds only the deployment's own host) and `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`. Nothing in the app uses those features; YouTube and Vimeo embeds do not need them.

No migration, no grant change, no new dependency.

## Alternatives considered

- **Removing the member upload route.** Cleaner, but it changes a tested API and account deletion's coverage for no user-visible gain. Bounding it closes the abuse case.
- **A Content-Security-Policy.** Worth adding, but Radix and the rich lesson editor set inline styles and lessons embed YouTube and Vimeo, so a policy needs a browser run against the hosted build. Left for the hosted staging checks (LAUNCH_RUNBOOK.md) rather than shipped untested.
- **Configuring Better Auth's trusted IP headers.** On Vercel the forwarded address is a single value set by the platform, which Better Auth already reads. Self-hosting behind another proxy needs its own setting, which depends on that proxy; PILOT_OPERATIONS.md keeps the instruction.

## Consequences

A member cannot fill private storage through the unused route, cannot set a name that skips the app's rules, and anonymous look-ups cannot block invitees. Browsers remember to use HTTPS for the deployment's host for a year once they have seen it. The headers are checked only as configuration here; they take effect when a Vercel deployment exists.
