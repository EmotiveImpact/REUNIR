# REUNIR Alpha 01 architecture

## One product, two explicit data modes

The React client uses a data adapter: either fictional browser-persisted data or the same-origin live API. It never infers a production identity from a supplied user or role header. A live connection failure never triggers demo fallback.

`packages/contracts` holds strict input schemas and domain types. `packages/domain` holds the pure state transitions and permission filtering. The demo uses the same transition logic, while the API obtains identity from Better Auth, re-reads membership, runs the transition and persists it transactionally.

## Modules

- `apps/web`: React, Vite, TanStack Query, React Router, Lucide, original components/styles and sample content.
- `apps/api`: Hono, authentication, validation, scoped application endpoints and an optional Google storage adapter.
- `packages/db`: normalised SQL schema, Drizzle auth tables, parameterised domain persistence, migrations and row-level security.
- `apps/worker`: reserved future boundary. It is not a running job service.
- `api/index.ts`: Vercel Node function adapter.
- `scripts`: development, provisioning, migration, preview bundling and browser verification.

## Database boundary

A verified session identifies the actor. Organisation slug resolution requires active membership. A transaction sets `app.user_id` and `app.organization_id` locally. Tenant-table RLS and composite foreign keys prevent accidental cross-tenant relationships. Application permissions additionally restrict individual private spaces, review powers and ownership within a tenant. RLS alone is not a complete fine-grained policy engine.

The runtime role must not own tenant tables or bypass RLS. Separate administrative credentials apply migrations and provision initial accounts. Database credentials never reach the client.

Within a community, writes lock the organisation row. Reads take a shared lock to avoid a mixed snapshot. Only changed records are inserted/updated/deleted. The business write, audit record, reputation award, outbox event and idempotency receipt commit in the same transaction. The worker that actually delivers external notifications/webhooks is not implemented.

## Idempotency and integrity

The API requires an idempotency key for domain commands and stores a normalised request digest. A repeated key with the same body returns a current authorised snapshot without replaying the mutation. A changed body under the same key is a conflict. Independently, unique constraints prevent duplicate membership joins, completions, reactions and rewards.

Review actions require an admin; members cannot review their own proof. Reputation uses a source-keyed ledger rather than arbitrary client-supplied totals.

## Browser correctness

TanStack Query keys contain the community and actor. A successful mutation removes other cached actor views for that community. Demo role changes invalidate inactive views. This fixes the stale approval seen during browser testing. Search only searches content already filtered for the current actor.

Native dialog handles focus containment and Escape, with explicit focus return. Reduced motion, visible focus, mobile navigation and automatic home-page accessibility checks are included. Automatic checks are not a complete accessibility certification.

## Deliberate scale limit

The first database implementation reads a bounded workspace rather than querying each page independently. Bounds are 5,000 rows per table and 20,000 total snapshot records. This makes the first product loop testable and transactions comprehensible, but it is not the final read architecture. Use cursor-paginated domain endpoints, batched enrichment and separate analytical projections before larger communities or large activity histories.

No heavy video processing, custom WebSocket server, Redis dependency, AI billing loop or arbitrary third-party plugin execution is part of this alpha.

## Reuse

Authentication, query caching, routing, validation, SQL drivers, browser testing and object-store signing reuse mature packages. The application reflects product patterns from the six research references without pretending their whole codebases have been merged. Future direct source reuse is reviewed per component and recorded; an AGPL-compatible product is a legitimate commercial choice, not automatically excluded.
