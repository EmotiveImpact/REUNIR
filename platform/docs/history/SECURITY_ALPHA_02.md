# Security status: engineering alpha, not public launch

## Implemented and tested locally

Verified cookie sessions through Better Auth; strict command schemas; server-authoritative roles and authors; private-space and nested-resource filtering; tenant foreign keys; transaction-local RLS context; PostgreSQL rate counters; request body cap; Origin checks on cookie-authenticated mutations; safe HTTPS links; React text escaping; one-time rewards; transaction rollback; idempotency receipts; tenant/actor cache boundaries; non-owner production credential check; explicit live/demo separation.

Database tests run SQL in PGlite, including explicit restricted-role RLS tests. PGlite is an embedded Postgres runtime, not the customer's Neon instance. Its concurrency scheduling does not establish high-load Neon performance. Staging tests against a real pooled Postgres connection remain required.

The storage boundary is tested using an explicitly fake provider. The Google SDK compiles, but no real bucket upload or IAM configuration was verified. Only owner-private files are supported at API level; there is no shipped attachment UI, malware scanning or content-based MIME detection. PDFs/images are served as downloads, not trusted executable page content.

## Before a public or paid launch

- Configure and test verified email, invitation expiry, password recovery and privileged-account MFA; decide signup policy.
- Verify reverse-proxy origin/client-IP trust, abuse controls and rate-limit behaviour. Never trust arbitrary forwarding headers.
- Run independent authorisation/security review, live Neon tenant-isolation tests and a real restore rehearsal. Add monitoring and incident procedures.
- Implement retention/export/deletion flows, policy notices and documented handling of reports. Do not claim regulatory compliance from a technical prototype.
- Add bounded/paginated read endpoints, worker delivery with retries, outbox/receipt/rate-table retention and appropriate indexes before scale.
- Connect real storage with private IAM/CORS, lifecycle limits, generation-bound objects and content scanning before exposing attachments to members.
- Review the complete transitive dependency/SBOM and known vulnerabilities; CI must enforce these gates. Build success is not a vulnerability audit.
- Verify Vercel function routing, cookie security, preview isolation, bundle size, operational cost caps and production environment settings.

## Secret handling

Do not commit `.env`, database URLs, authentication secrets, service-account JSON, bootstrap passwords or signed URLs. Only `VITE_DATA_MODE` is a public frontend setting. The server fails closed on missing configuration. Never configure an administrative database credential as the production application role.

Default demo data is fictional and browser-local. The demo contains switchable roles deliberately for evaluation; no production API recognises these identities. Do not use the preview for confidential information.


## Alpha 02 purpose and evidence boundaries

Member goals are private by default and filtered even from ordinary community administrators. Member sharing is an explicit visibility choice. The application does not expose goal content through search or automatically place it in activity/outbox payloads. This is not end-to-end encryption from the database operator.

Paths and milestones inherit access restrictions from their linked lesson, mission and project resources. Publishing validates the full path audience. Recognised contributions, verified outcomes and community outputs are filtered together with their source resources; a public-looking page is not permission to expose private work. Output publication is currently a member-visible community archive.

Review transitions are server-authorised. A project owner or community administrator can review another member's contribution; an administrator verifies another member's outcome. No reviewer may approve their own contribution or outcome. Feedback, reviewer identity and timestamps are recorded. An outcome requires exactly one eligible owned, reviewed source; membership or a plain update does not count as proof. A goal completes only from a completed linked path or an explicitly selected verified outcome owned by that member and linked to that purpose.

The new eight tables have tenant foreign keys, RLS and explicit runtime-role grants. `db:grant-runtime` refuses an elevated role, table-owning role or a role with membership inheritance; it does not grant schema ownership or access to migration checksums. Per-user privacy is domain-level in addition to tenant RLS, not a claim that tenant RLS by itself knows which member is accessing each row.

Community verification is not accreditation or independent validation of a real-world claim. Preserve source-review attribution. Revocation, appeal histories, multi-contributor credits and consented cross-community discovery need further design before introduction. Do not infer sensitive capability or publish personal goals to power later matching or AI.
