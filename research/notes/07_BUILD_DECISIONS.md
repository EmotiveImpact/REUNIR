# REUNIR Build Decisions v0.1

These are the decisions justified by the six-repo audit. They are working locks for the first implementation wave.

## Product locks

1. **REUNIR is not an LMS with a forum.** Community, Learning and Doing are equal product systems.
2. **Code Black is tenant #001**, not a hard-coded product fork.
3. **Missions + Projects + Proof + Opportunities** are the strategic differentiator.
4. **Spaces** are the universal sub-community container. Tenant UI can rename them to Squads, Circles, Groups, Rooms, etc.
5. The global feed can surface authorised events from multiple domains, but canonical objects remain in their owning domains.
6. Reputation is multi-dimensional. A single engagement score must not become the user's identity.
7. Admin and member experiences share the same mental model. Operators manage the same objects members use.

## Commercial / licensing locks

1. REUNIR core is a **clean-room original implementation**.
2. AGPL and dual-licensed repos are research references unless we deliberately obtain/comPLY with a suitable commercial licence.
3. Third-party source stays under `research/`; original source stays under `platform/`.
4. No code moves from research to platform without an explicit licence record.

## Architecture locks

1. **Multi-tenant from migration 001.** No retrofitting `organization_id` later.
2. **Modular monolith first.** Clear domain packages, one primary Postgres database, separate worker process.
3. **TypeScript-first stack** for web/API/contracts. Add Python only where a workload genuinely benefits.
4. **PostgreSQL** is the durable source of truth.
5. Use explicit migrations and tenant-aware query helpers.
6. **Redis** for jobs, rate limits, presence and transient coordination, not durable business state.
7. **S3-compatible storage** behind one abstraction; R2 in managed cloud, MinIO-compatible self-host path.
8. **Universal domain events** power notifications, webhooks, analytics, feed activity and reputation rules.
9. **Immutable points ledger** rather than only mutable totals.
10. **Provider abstractions** for auth, email, payments, storage and live-meeting providers.

## Working technology direction

- Web: React + TypeScript
- API: Hono + TypeScript
- DB: PostgreSQL + Drizzle-style explicit SQL mapping
- Validation/contracts: Zod
- Auth: Better Auth or equivalent, separated from REUNIR's permission model
- Jobs/realtime: Redis + worker; WebSockets for chat/presence/notifications
- Collaborative documents later: Yjs/Hocuspocus only where needed
- UI: source-owned component system using Radix/shadcn-style primitives + REUNIR design tokens

These are architectural directions, not excuses to import ClassroomIO/LearnHouse implementation source.
