# REUNIR Working Architecture Direction

This is a **working technical recommendation**, not a final locked architecture.

## 1. Start with a modular monolith

Do not begin with a microservice fleet.

REUNIR's first real implementation should be one deployable product with clear internal domain modules and a separate worker process.

```text
REUNIR monorepo
│
├── apps/
│   ├── web/             member + admin web product
│   ├── api/             public/internal API
│   ├── worker/          jobs, notifications, media, automation
│   └── docs/            later
│
├── packages/
│   ├── db/
│   ├── auth/
│   ├── ui/
│   ├── tenancy/
│   ├── events/
│   ├── storage/
│   ├── permissions/
│   ├── notifications/
│   └── config/
│
└── infrastructure/
    ├── docker/
    └── migrations/
```

Services can split later when measured load or organisational boundaries justify it.

---

# 2. Proposed stack

## Web

**Next.js + React + TypeScript**

Why:

- broad ecosystem
- excellent server/client composition
- good route/layout model for tenant-aware application surfaces
- strong compatibility with Radix/shadcn-style primitives
- LearnHouse demonstrates this class of product successfully

Alternative if we want to stay closer to ClassroomIO: SvelteKit is credible, but React gives us the broader component/integration ecosystem for a product intended to become a platform.

## UI

- Tailwind CSS
- Radix primitives and/or shadcn-style source-owned components
- design tokens from the beginning
- no vendor-specific visual identity in the domain layer

The visual product should be **social-first, human and energetic**, not a grey enterprise dashboard.

## API

**Hono + TypeScript** is the current preferred working direction.

Why:

- small and explicit
- easy to deploy in Node/serverless/edge-adjacent environments
- ClassroomIO demonstrates Hono at meaningful product scale
- keeps core product language in one language across API, UI and shared contracts

FastAPI is also excellent, particularly for AI-heavy services, but we do not need Python merely because several references use it. Add a Python service later only when workloads justify it.

## Database

**PostgreSQL**

Recommended ORM/query layer: **Drizzle** or similarly explicit TypeScript SQL tooling.

Requirements:

- migrations committed to source
- explicit foreign keys
- indexes designed around tenant + time/feed access patterns
- database constraints, not only application validation
- Postgres RLS for high-risk tenant data as defence in depth

## Auth

Use a modern auth library such as **Better Auth** or an equivalent abstraction that supports:

- email/password or passwordless
- OAuth
- sessions
- MFA later
- organisation invitation flows
- SSO later

Do not let the auth library define our organisation/permission domain model.

## Cache and queues

**Redis** initially.

Use it for:

- job queue/locks
- rate limiting
- temporary presence
- realtime fanout/pub-sub if appropriate
- short-lived cache

Durable state remains in Postgres.

## Object storage

S3-compatible abstraction:

- Cloudflare R2 for managed cloud
- MinIO or compatible endpoint for self-hosters

Keep bucket/key generation inside one storage package.

## Realtime

Start with normal WebSockets/Socket.IO-style realtime for:

- chat
- notifications
- presence
- live feed invalidation

Use **Yjs/Hocuspocus only for collaborative documents/boards**. Do not turn every realtime feature into a CRDT problem.

## Search

V1:

- PostgreSQL full-text + trigram search

Later if needed:

- Meilisearch, Typesense or OpenSearch

Every indexed record must be tenant-scoped.

## Email

Provider abstraction:

- managed provider such as Resend/Postmark initially
- SMTP option for self-hosting

## Payments

Stripe first behind a payment-provider interface.

Separate:

1. **REUNIR billing organisations for use of the platform**
2. **an organisation selling memberships/courses/events to its members**

Those are different financial relationships and should not share confused tables.

---

# 3. Internal modules

Recommended initial domain boundaries:

```text
identity
organizations
tenancy
permissions
community
spaces
messaging
learning
cohorts
missions
projects
events
reputation
notifications
moderation
search
media
commerce
integrations
analytics
```

Modules may share one database, but they should not freely reach into each other's internal query code.

---

# 4. Universal event stream

Create an application event contract early.

Example:

```ts
interface DomainEvent {
  id: string
  organizationId: string
  type: string
  actorUserId?: string
  objectType?: string
  objectId?: string
  contextType?: string
  contextId?: string
  payload: Record<string, unknown>
  occurredAt: string
}
```

This becomes the common input for:

- notifications
- webhook delivery
- analytics
- activity feed
- XP/reputation rules
- automation
- audit-adjacent observability

Avoid duplicating feature-specific “event” concepts everywhere.

---

# 5. Permissions model

Use a hybrid:

- organisation-level roles/permissions
- space/cohort/project role overrides
- ownership checks
- resource visibility

Do not implement a gigantic policy language in v1.

Example permissions:

```text
org.manage
members.manage
spaces.create
spaces.moderate
content.post
content.moderate
tracks.manage
missions.manage
projects.manage
events.manage
billing.manage
integrations.manage
```

---

# 6. SaaS + self-host from one core

## Managed cloud

```text
app.reunir...
 ├─ tenant routing
 ├─ shared Postgres with strong tenant isolation initially
 ├─ R2
 ├─ Redis
 └─ workers
```

Enterprise isolation can later offer dedicated DB/project deployments.

## Self-hosted

One `docker compose up` experience should eventually launch:

- web/API
- worker
- Postgres
- Redis
- optional MinIO

With an installation wizard/CLI for:

- domain
- admin
- SMTP/email
- object storage
- backups
- updates

Roost and LearnHouse show why install ergonomics are part of the product, not merely DevOps documentation.

---

# 7. Product architecture should support modular tenant configuration

Each organisation has entitlements/module settings:

```text
community      ON
learning       ON
missions       ON
projects       ON
events         ON
leaderboards   OFF
opportunities  OFF
certificates   OFF
```

This is not a frontend hide/show hack. Module availability needs to be enforced at service/API boundaries.

---

# 8. Suggested build sequence

## Foundation A

- monorepo
- Postgres + migrations
- organisation/user/membership
- roles/permissions
- tenant middleware/query context
- auth
- object storage abstraction
- audit logging
- domain event contract

## Foundation B: Community

- spaces
- feed/posts
- comments/reactions
- member directory/profile
- notifications
- moderation reports
- search

## Foundation C: Learning

- tracks/sections/lessons
- enrollments
- progress
- cohorts
- quizzes/basic submissions

## Differentiator D: Doing

- missions
- submissions/reviews
- projects
- project members/updates
- proof
- points ledger

## Growth E

- events/RSVP
- direct/group messaging
- opportunities
- payments
- webhooks/API keys
- configurable terminology
- deeper analytics

---

# 9. Non-negotiable engineering acceptance criteria

Before REUNIR is used by Code Black members:

- tenant-isolation test suite exists
- permission tests cover org + space roles
- migration rollback/recovery strategy exists
- rate limiting exists on auth and public writes
- media upload validation exists
- XSS/content sanitisation is deliberate
- moderation/report flow works
- backup/restore has been tested
- audit log captures sensitive admin actions
- secrets are not stored in tenant-readable config
- webhook signatures/retries are implemented if webhooks ship
- no AGPL-derived code is present in proprietary core unless deliberately licensed/complied with
