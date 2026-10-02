# REUNIR Reference Extraction Map

This file turns the repo audit into an actionable clean-room research map. It documents **what to learn**, not what to copy.

| REUNIR area | Primary reference | Secondary reference | What to study | What not to inherit |
| --- | --- | --- | --- | --- |
| Tenant routing + org isolation | ClassroomIO | LearnHouse | organisation ownership, host routing, org memberships, tenant-aware services | licence-gated implementation, LMS-first assumptions |
| Social feed | OpenCircle | HumHub, Roost | channels/spaces, timeline aggregation, post/comment/reaction lifecycle | single-instance tenancy |
| Spaces / groups | HumHub | OpenCircle, Roost | join policy, visibility, roles, per-space modules | PHP/Yii implementation details |
| Member profiles | HumHub | Roost | custom profiles, following, directories, visibility | legacy UI conventions |
| Learning authoring | LearnHouse | ClassroomIO, Frappe | block editing, lesson object model, course navigation, authoring UX | AGPL source and enterprise-gated code |
| Cohorts | ClassroomIO | Frappe Learning | cohorts, goals, memberships, cohort-specific progress | compliance-training posture |
| Assignments / submissions | Frappe Learning | ClassroomIO, LearnHouse | review lifecycle, submission state, evaluator/reviewer flow | school terminology in member UX |
| Missions | Original REUNIR | Frappe + ClassroomIO only as workflow references | brief, evidence, review, reward, public proof | treating Missions as ordinary homework |
| Projects / showcase | Roost | LearnHouse showcase labels/boards | project discovery, voting, reviews, public work | Roost's single-community assumptions |
| Opportunities | Frappe Learning | Original REUNIR | job/opportunity data shape, application workflow | only supporting jobs |
| Events | Roost | Frappe, HumHub modules | RSVP, calendar, replay/recording link | building video infrastructure early |
| Messaging | Roost | HumHub Mail module | conversation/member/message separation | one-to-one-only design |
| Moderation | LearnHouse | ClassroomIO, HumHub | configurable rate/age/link rules, reports/actions | hard-coding one community's policy |
| Gamification | Roost | Frappe badges | points ledger, scoped leaderboard, badges | vanity-score-only reputation |
| Notifications | OpenCircle | HumHub, ClassroomIO | preferences, durable notification + async delivery | transport-specific creation logic |
| API / webhooks | ClassroomIO | Frappe | public-API mindset, validation/service/query layers, retries | coupling API contracts to UI internals |
| Extension model | HumHub | ClassroomIO packages | modular boundaries, capabilities, module activation | runtime plugin marketplace in v1 |
| Self-hosting UX | LearnHouse | Roost, Frappe | CLI/wizard, backups, upgrades, doctor/diagnostics | bespoke manual server steps |

## First files to keep revisiting

### Roost
- `README.md`
- `src/App.tsx`
- `prisma/schema.prisma`
- `src/services/leaderboard.ts`
- `src/pages/Showcase*.tsx`
- `src/pages/Messages.tsx`
- `server/src/routes/stripe-webhook.ts`

### OpenCircle
- `README.md`
- `docs/www/pages/features/channels.mdx`
- `docs/www/pages/features/posts.mdx`
- `apps/api/src/core/base_models.py`
- `apps/api/src/api/*`
- `apps/platform/src/*`

### ClassroomIO
- `ARCHITECHTURE.md`
- `apps/tenant-router/README.md`
- `prd/self-host-single-org.md`
- `packages/db/src/schema*`
- `apps/api/src/services/cohort/*`
- `apps/api/src/routes/*`
- `prd/webhooks/README.md`

### LearnHouse
- `README.md`
- `apps/api/src/db/communities/*`
- `apps/api/src/db/organizations.py`
- `apps/web/components/Objects/Editor/*`
- `apps/collab/*`
- `apps/cli/*`

### Frappe Learning
- `README.md`
- `lms/lms/doctype/lms_batch/*`
- `frontend/src/components/Discussions.vue`
- `lms/lms/doctype/lms_badge*`
- `lms/job/doctype/job_opportunity/*`
- `lms/lms/payments.py`

### HumHub
- `README.md`
- `protected/humhub/modules/space/models/Space.php`
- `protected/humhub/modules/content/*`
- `protected/humhub/modules/stream/*`
- `protected/humhub/modules/notification/*`
- module marketplace architecture

## Clean-room rule

All third-party code remains reference material. REUNIR implementation decisions should be restated in our own domain language and written from our own specifications under `platform/`.
