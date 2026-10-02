# REUNIR Master Platform Audit

**Status:** Working research baseline  
**Date:** 24 September 2026  
**Purpose:** Determine what REUNIR should become by auditing the strongest self-hosted community + learning platforms, without contaminating REUNIR's original product code with third-party source.

## Executive conclusion

REUNIR should **not** be a reskin of one existing project and should **not** be a mechanical merge of several repositories.

The research points towards an original, multi-tenant product built around three equal systems:

1. **COMMUNITY** — people, feed, spaces, conversations, events.
2. **LEARNING** — tracks, lessons, cohorts, assessments, progress.
3. **DOING** — missions, projects, squads, proof, opportunities and outcomes.

Most existing platforms are strong in one or two of these. None of the six core references treats all three as a first-class product loop. That gap is REUNIR's clearest product opportunity.

A useful shorthand is:

> **REUNIR = Circle/Skool-style community + serious learning + an execution network.**

The product should feel social and alive rather than like an enterprise dashboard or university portal.

---

# 1. Core repo verdicts

## 1.1 Roost

**Repository:** https://github.com/msrbuilds/roost  
**Current scale:** ~4 MB reported repo size, very young/small project  
**Licence signal:** README states MIT, but there is no root `LICENSE` file in the current repo metadata. Treat permissive status as **unverified until the maintainer/licence file is confirmed**.

### Why it matters

Roost is the closest single codebase to the product *shape* we want:

- community feed
- groups/classrooms
- course modules + lesson completion
- direct messaging
- events/calendar
- points + leaderboard
- member directory
- project/showcase gallery
- live rooms + live chat
- notifications
- admin/moderation
- subscriptions/payments scaffolding
- feature request voting

Its consolidated SQL schema contains more than 40 tables and provides a compact example of how all these product features relate.

### Strong patterns to study

- Simple all-in-one navigation.
- `groups` as the bridge between community and learning.
- Project/showcase as a first-class community object.
- Points ledger and leaderboard mechanics.
- One-to-one messaging model.
- Feature flags for optional modules.
- S3-compatible storage abstraction.
- Supabase RLS usage as defence in depth.
- Installer/deployment ergonomics.

### Why not use it as our foundation

- The repository is extremely young and small.
- It is primarily single-instance/single-community. It does not have a robust SaaS organisation/tenant model.
- Some multi-tenant-looking variables in self-hosted Supabase config are infrastructure stubs, not a full product tenancy model.
- We have not yet established the licence with the confidence required for commercial code reuse.
- It would be risky to entrust REUNIR's long-term identity, migrations and customer data to it without a full security and code-quality audit.

### REUNIR role

**Product schema donor and feature-pattern reference.**

Do not make Roost the REUNIR core. Use it to make sure we do not forget useful community mechanics.

---

## 1.2 OpenCircle

**Repository:** https://github.com/devscalelabs/opencircle  
**Licence:** AGPL-3.0  
**Status:** README explicitly calls the project **Alpha**.

### Why it matters

OpenCircle is philosophically very close to REUNIR's community-learning intersection:

- courses
- sections and lessons
- video/text/quiz/assignment lesson types
- channels
- posts/articles
- mentions/reactions
- notifications and preferences
- broadcast messaging
- user presence
- real-time data flows
- separate platform/admin surfaces

The architecture is clean and contemporary:

- React 19 + TypeScript
- TanStack Router/Query
- Tailwind + Radix
- FastAPI
- PostgreSQL + SQLModel
- Redis + Celery
- Cloudflare R2-compatible media
- Docker services for app, admin, API, worker, migrations, Postgres and Redis

### Strong patterns to study

- Distinct `Channel`, `Post`, `Reaction`, `Activity`, `Notification` objects.
- Clean split between learner-facing platform and admin app.
- Background notification work via Celery/Redis.
- Small, understandable service boundaries.
- A social model that does not force all conversation to live under lessons.

### Why not use it as our foundation

- AGPL.
- Alpha and APIs are explicitly subject to change.
- It currently has no proper organisation/tenant entity, so it is effectively one community per deployment.
- Smaller data model and less battle-tested than the more mature references.

### REUNIR role

**Architecture reference for the seam between social and learning.**

---

## 1.3 ClassroomIO

**Repository:** https://github.com/classroomio/classroomio  
**Root licence:** AGPL-3.0  
**Important inconsistency:** root `package.json` currently declares `MIT`, but the repository's root `LICENSE` is GNU AGPL v3 and GitHub reports AGPL-3.0. For REUNIR risk decisions, treat it as **AGPL unless the copyright holder clarifies otherwise in writing**.

### Why it matters

ClassroomIO is the strongest of the six references for the boring-but-critical SaaS machinery that REUNIR will eventually need:

- organisations and organisation membership
- invitations and audit records
- courses/lessons/exercises/quizzes/submissions
- completion and certificates
- programmes
- cohorts + cohort membership
- goals and goal assignments
- course/cohort newsfeeds
- org-wide community Q&A
- content reporting/moderation
- SSO/token auth/API keys
- REST API + webhooks
- analytics
- AI usage/credits/conversations/agents
- background media jobs/transcripts
- worker processes
- object storage

The current database schema contains more than 100 named tables. Tenant scoping is a recurring design concern and the repository includes explicit notes/tests about preventing cross-organisation leakage.

### Strong patterns to study

- `organizationId` as a pervasive ownership boundary.
- Separation of programmes, cohorts and courses.
- Cohort goals and cohort-specific feeds.
- Event/webhook thinking from the beginning.
- Separate worker/background jobs.
- AI credit/usage accounting by organisation.
- Moderation/report object model.
- API keys and integrations as platform-level features.

### Limits for REUNIR

- Product posture is still LMS-first.
- The community feature is closer to org-wide Q&A than a living social network.
- Self-hosted deployments have licence-gated enterprise features such as SSO, token auth, no-tracking, custom domain and custom branding.
- AGPL makes direct proprietary reuse risky without commercial permission.

### REUNIR role

**Primary tenancy, platform-services, cohort and back-office architecture reference.**

---

## 1.4 LearnHouse

**Repository:** https://github.com/learnhouse/learnhouse  
**Licence:** AGPL-3.0; README says enterprise features use a separate Enterprise Licence.

### Why it matters

LearnHouse is the most useful reference for what a genuinely modern learning product can feel like:

- course authoring
- block-based Tiptap editor
- collections
- assignments
- podcasts
- analytics
- AI playgrounds/simulations
- code execution + auto-grading
- certificates + verification
- user groups
- custom landing pages and branding
- communities
- discussions
- voting/reactions
- collaborative boards
- real-time collaborative editing
- Stripe payment provider implementation
- AI and embeddings

Its architecture is also sophisticated:

- Next.js + React + TypeScript
- Tailwind + Radix
- FastAPI + Python + SQLModel + Alembic
- PostgreSQL + pgvector
- Redis
- Hocuspocus/Yjs collaboration server
- S3-compatible storage
- CLI for setup/update/backup/diagnostics

### Community model worth studying

A `Community` belongs to an organisation and can optionally belong to a course. Discussions include:

- labels: General, Q&A, Ideas, Announcements, Showcase
- pinning and locking
- votes
- comments
- emoji reactions
- moderation rules

Community moderation settings include slow mode, link blocking, post length, comment length, daily posting limits, minimum account age, email verification, reaction disabling and auto-lock.

Collaborative `Board` objects are organisation-scoped and use owner/editor/viewer roles. New boards default to private.

### Strong patterns to study

- Modern authoring UX.
- Org-scoped communities.
- Flexible discussion labels.
- Moderation configuration.
- Collaborative board architecture.
- Yjs only where CRDT collaboration is actually valuable.
- Certificate verification links/QR.
- Provider abstraction for payments.
- Self-host CLI ergonomics.

### Limits for REUNIR

- AGPL.
- README explicitly puts payments, SSO and multi-org behind enterprise licensing.
- Still learning-first in its overall mental model.

### REUNIR role

**Primary UX/editor/collaboration reference.**

---

## 1.5 Frappe Learning

**Repository:** https://github.com/frappe/lms  
**Licence:** AGPL-3.0.

### Why it matters

Frappe Learning has deeper learning-operations coverage than its simple marketing positioning suggests. Verified features include:

- courses/chapters/lessons
- course progress
- batches/cohorts
- Zoom-linked live classes
- quizzes
- assignments/submissions
- discussions/replies
- course reviews
- certificates
- certificate requests/evaluations
- badges + criteria/assignments
- jobs + job applications/job board
- payments/payment gateway workflow

### Strong patterns to study

- Batch/cohort operations.
- Live class scheduling.
- Badge assignment criteria.
- Job/opportunity board.
- Certificate evaluation as a workflow, not merely a PDF.
- Payment state and reminders.
- Mature admin controls.

### Why not use it as our foundation

- AGPL.
- Tightly coupled to Frappe's framework and doctype model.
- A Frappe installation can host multiple sites, but the LMS itself is not designed around a shared `tenant_id` SaaS model in the way REUNIR needs.
- Social/community experience remains secondary to learning.

### REUNIR role

**Deep LMS workflow and opportunities reference.**

---

## 1.6 HumHub

**Repository:** https://github.com/humhub/humhub  
**Licence:** dual licensing, AGPL or proprietary licence.

### Why it matters

HumHub is mature and gives us the strongest reference for a modular community kernel. Its model is intentionally built around four concepts:

- **User**
- **Space**
- **Content**
- **Module**

Spaces act as flexible content containers for groups, projects, departments, events and other social contexts. Operators can add modules to extend capabilities.

The ecosystem includes or references modules for:

- calendar
- wiki
- tasks
- direct messages/mail
- galleries
- polls
- news
- OnlyOffice
- REST API
- LDAP/JWT SSO
- legal tools
- custom themes/pages

### Strong patterns to study

- `Space` as a universal container instead of proliferating unrelated group types.
- Per-space roles, permissions and notification settings.
- Extension/module contracts.
- Content-container abstraction.
- Digests and notification architecture.
- Admin-configurable profiles and fields.

### Why not use it as our foundation

- PHP/Yii2 and legacy frontend dependencies do not match the product/engineering direction we want.
- Not a native LMS.
- The product is a network with Spaces rather than a SaaS application with many branded tenant organisations.
- Proprietary use would require a commercial licence if we reuse covered HumHub code outside AGPL terms.

### REUNIR role

**Community-kernel and modularity reference.**

---

# 2. What each platform contributes to REUNIR

| REUNIR area | Best references | What to learn |
| --- | --- | --- |
| Multi-tenant organisations | ClassroomIO, LearnHouse | Tenant scoping, memberships, roles, isolation |
| Feed/social objects | Roost, OpenCircle, HumHub | Posts, reactions, following, spaces/channels |
| Spaces/groups | HumHub, Roost, LearnHouse | Universal content container, membership, visibility |
| Courses/tracks | ClassroomIO, LearnHouse, Frappe | Authoring, sections, lessons, progress |
| Cohorts | ClassroomIO, Frappe | Membership, goals, schedules, cohort feed |
| Assignments/missions | Frappe, LearnHouse, ClassroomIO | Submission/review/progress workflows |
| Project/showcase | Roost, LearnHouse discussions | Showcase, voting, proof, collaboration |
| Realtime/collaboration | LearnHouse, OpenCircle | WebSocket/Yjs where needed, notifications |
| Points/badges | Roost, Frappe | Ledger, criteria, awards, leaderboard |
| Opportunities/jobs | Frappe | Job board + application mechanics |
| Events/live | Roost, Frappe | RSVP, sessions, recordings, live class links |
| Notifications | OpenCircle, HumHub, Roost | Preferences, digests, background dispatch |
| Moderation | LearnHouse, ClassroomIO, HumHub | Reports, slow mode, limits, locks, roles |
| APIs/webhooks | ClassroomIO, HumHub | Integration-first event model |
| Self-hosting | LearnHouse, Roost, Frappe | CLI/install/update/backups |
| Modular product | HumHub, Roost | Feature modules and per-tenant enablement |

---

# 3. Product gaps REUNIR can exploit

## Gap A: Community systems rarely have serious execution loops

Most community platforms optimise for posting, commenting and consuming.

REUNIR should make action visible:

- missions
- milestones
- proof submissions
- project updates
- team formation
- peer reviews
- outcomes
- opportunities

## Gap B: LMS products still treat social as an accessory

Learning should produce conversation, teams and work, not simply completion percentages.

## Gap C: reputation is usually shallow

Instead of one engagement leaderboard, REUNIR can distinguish:

- learning progress
- contribution
- collaboration
- missions completed
- projects shipped
- mentoring/helpfulness
- real-world outcomes

## Gap D: customer terminology is too rigid

A fitness community, creator academy and business network should not all be forced to call things “courses”, “assignments” and “groups”. REUNIR should allow the organisation to rename major modules.

Examples:

- Courses → Tracks / Programmes / Paths
- Assignments → Missions / Challenges
- Groups → Squads / Circles / Spaces
- Points → XP / Credits / Reputation
- Leaderboard → The Board / Rankings

## Gap E: most platforms choose either hosted SaaS or technical self-hosting

REUNIR can use the same core for:

- managed cloud
- self-hosted community edition
- enterprise deployments

---

# 4. Working product principle

The main member loop should be:

> **Discover → Learn → Do → Share proof → Get feedback → Collaborate → Progress → Unlock opportunity.**

That is a stronger foundation than “post → comment → watch lesson → repeat”.

---

# 5. Commercial consequence

Because the strongest source references are AGPL, dual-licensed or ambiguous, REUNIR should preserve a clean-room posture:

- study concepts and architecture
- document patterns
- build original source in `REUNIR/platform/`
- do not paste third-party implementation code into the product
- where a specific dependency is desirable, verify its exact licence and obligations first

This also keeps open a future REUNIR licensing model such as proprietary cloud + self-hosted community edition, dual licensing, or open core.

---

# 6. Current working direction

REUNIR should start as a **modular monolith**, not microservices.

Recommended core properties:

- multi-tenant from the first migration
- Postgres as source of truth
- tenant ID on every tenant-owned row
- tenant-aware service/query layer
- Postgres RLS on sensitive tables as defence in depth
- event/activity ledger from day one
- modular domains with clear boundaries
- API + webhooks from early versions
- object storage abstraction
- realtime only for features that need it
- background worker for media, notifications, email and automation
- one codebase that can support managed cloud and self-hosting

See `03_ARCHITECTURE_DIRECTION.md` for the proposed technical shape.

---

# 7. Research caveat

The shell runtime used for this research could not directly clone GitHub repositories. The audit therefore used the live GitHub repository API/search/fetch interface against the current default branches. No third-party source has been copied into `REUNIR/platform/`.

The `research/clone-research.sh` script remains available for a normal Git-enabled environment so we can later perform local builds, test suites and deeper security analysis.
