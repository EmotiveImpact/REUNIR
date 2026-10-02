# Build status · REUNIR Alpha 01

24 September 2026. This record describes the files in this release, not an eventual roadmap.

## Delivered

Written PRD (v0.2), a compiled React/Vite application, shared validated domain commands, a Hono API, Better Auth email/password sessions, normalised Postgres persistence and migration/provisioning tools. Code Black and Studio North are independent fictional communities in the browser demo. A CLI-created live-mode tenant starts empty.

The member experience includes the home/feed, spaces, post detail/comments/reactions/saves/reporting, learning catalogue and lesson reader, missions/proof, project directory/team updates, events/RSVP/calendar export, people/profiles, notifications and search. Admin views include proof review, moderation, settings and basic creation of spaces/tracks/lessons/missions/events. There are 19 primary route patterns, plus a home alias and a not-found route, with state-dependent views. This is not a claim of 86 implemented screens.

## Verification

| Check | Actual result |
| --- | --- |
| Strict TypeScript | Passed |
| Domain rules | 57 tests passed |
| PostgreSQL persistence / constraints / RLS | 19 tests passed |
| HTTP / real Better Auth / storage boundary | 31 tests passed |
| Complete `npm test` run | 107 passed, 0 failed, 0 skipped |
| Desktop/mobile browser journey checks | 24 passed |
| Home automatic WCAG A/AA scan | 0 reported violations on the tested view |
| Real Node HTTP + persistent local DB smoke | 4 checks passed |
| Vite production bundle | Built successfully |

See `evidence/all-tests.tap`, `browser-tests.json`, `accessibility.json`, `local-http.json`, `summary.json` and actual screenshots. The browser test covers creating/replying/saving posts, learning progress, proof submission and approval, project creation/updates, RSVP, search, independent communities and mobile navigation. It caught and prompted a fix for an actor-view cache invalidation bug.

Database tests use embedded Postgres through PGlite, including transactions, foreign keys, unique constraints and a restricted test role. They do not establish Neon pooling, production load, restore reliability or cross-region performance. Browser tests render the real self-contained compiled app with setContent in an about: document because this runtime's browser policy blocks network/file navigation. The app uses MemoryRouter in that specific embedding and HashRouter on normal web/file origins. Hosted navigation remains a staging check.

The four Node HTTP smoke checks started the actual server, signed in with a CLI-created account, resolved its cookie membership and opened its empty tenant. No browser-supplied identity headers were used. Google storage boundary tests use an explicitly fake provider; no claim of a real bucket upload is made.

The built JavaScript chunk is about 513 kB before gzip (about 156 kB gzip). Vite emitted a size advisory and ignored library-level `use client` directives in this client build. Split routes/large features in the next optimisation pass. These warnings are not reported as errors or hidden as a warning-free build.

## Not connected or deployed

- Neon: the available connection returned a missing-project-id configuration error. No customer database was changed.
- Vercel: the user's account/team was readable. This release has configuration and a Node adapter, but no new live deployment was created or verified.
- Google Cloud Storage: optional adapter compiles; no bucket, IAM, CORS or external transfer was configured.
- GitHub: `build/reunir-alpha-1` contains the preparatory toolchain workflow, which succeeded. The complete application source is delivered in this archive and has not been pushed or merged. Application CI is supplied but has not run on GitHub.

## Deliberate remaining work

Email invitations/verification/recovery and privileged MFA; broad member administration; native messaging/presence; payments; rich collaborative editing; video hosting; AI; external webhook/email worker delivery; member-facing file attachments; tenant custom domains and quotas; pagination beyond bounded workspace snapshots; lifecycle retention, export/deletion, backups/restore, monitoring, staging and independent security review.

The pending module/worker boundaries are not active services. Current read bounds are 5,000 rows per domain collection and 20,000 total snapshot rows. This is a closed-pilot engineering foundation, not a mature large-scale platform or public-launch approval.

## Next required configuration

Select/bind the intended REUNIR Neon project; configure a restricted runtime role and separate migration credential; choose the Vercel REUNIR project/domain; provision the first real owner securely. A Google bucket is optional until attachments are exposed. Do not paste secrets into chat.
