# REUNIR Proposed Domain Model

This is an **original REUNIR working model**, informed by the audited products but not copied from any one repository.

## Rule zero: tenancy is structural

Every object owned by a customer's community must have an explicit organisation boundary.

Prefer:

```text
organization_id NOT NULL
```

on tenant-owned data rather than inferring tenancy through several joins.

Any exception must be deliberate and documented.

---

# 1. Identity and tenancy

## `organization`

The customer's community/academy/network.

Core fields:

- id
- slug
- name
- status
- owner_user_id
- plan_id
- default_locale
- timezone
- created_at
- updated_at

## `organization_domain`

- organization_id
- hostname
- verification status
- primary flag

## `brand_theme`

- organization_id
- logo
- icon
- colours
- typography tokens
- radius/density tokens
- light/dark defaults

## `terminology_config`

Tenant-facing labels, for example:

- course → Track
- assignment → Mission
- group → Squad
- points → XP
- leaderboard → The Board

Keep canonical internal names stable while labels are configurable.

## `user`

Global account identity.

## `profile`

Global profile baseline plus optional public information.

## `organization_membership`

- organization_id
- user_id
- status
- role_id
- joined_at
- last_active_at
- display overrides where needed

A user may belong to many organisations.

## `role`, `permission`, `role_permission`

Do not hard-code only `admin/mod/member`. Start with a small default role set but model permissions explicitly.

## `invite`

Supports email invitation, invite link, expiration, allowed role and optional space/cohort assignment.

---

# 2. Community kernel

## `space`

The universal container for sub-communities.

Use one object rather than unrelated “group”, “channel”, “classroom” and “squad” tables where possible.

Fields:

- organization_id
- name/slug
- type
- visibility: public/private/hidden
- join_policy
- description
- cover/avatar
- settings JSON
- created_by

A Space can represent:

- squad
- cohort lounge
- interest group
- programme community
- private team
- announcements

## `space_membership`

- organization_id
- space_id
- user_id
- role
- notification level
- joined_at

## `post`

- organization_id
- space_id nullable for org-wide feed
- author_id
- type
- title nullable
- body/document
- visibility
- status
- pin/lock flags
- published_at

Post types can include:

- discussion
- question
- idea
- announcement
- showcase
- project update
- proof

Do not create a new table for every visual post type unless its behaviour truly diverges.

## `comment`

Threadable, target-aware comments.

## `reaction`

Generic reaction relation.

## `attachment`

S3 object metadata separated from content ownership.

## `follow`

Optional user/user or user/object follow relation.

---

# 3. Conversations and realtime

## `conversation`

Types:

- direct
- group
- project
- support/system

## `conversation_member`

## `message`

## `message_attachment`

Do not put chat messages into the community `post` table.

Realtime transport is an implementation detail; the durable message/event record remains in Postgres.

---

# 4. Learning

Canonical internal term: `track` or `course`. Product labels can change per organisation.

## `track`

- organization_id
- owner/author
- title/slug
- description
- status
- access policy
- cover
- estimated duration

## `track_section`

## `lesson`

Support block/document lesson content and media references.

Lesson types can include:

- article
- video
- audio
- live
- quiz
- mission launch

## `enrollment`

- organization_id
- track_id
- user_id
- cohort_id nullable
- status
- enrolled_at
- completed_at

## `lesson_progress`

Record atomic progress rather than deriving everything from analytics events.

## `cohort`

- organization_id
- title
- dates
- status
- related space_id

## `cohort_membership`

## `cohort_goal`

Useful ClassroomIO pattern. Goals can point to a track, mission, event or arbitrary target.

## `quiz`, `question`, `answer_option`, `quiz_attempt`

## `certificate`

Later, but reserve a clean completion/credential boundary.

---

# 5. Doing layer: REUNIR differentiation

## `mission`

A task/challenge with real output, not merely a lesson exercise.

- organization_id
- title
- brief
- success criteria
- difficulty
- reward configuration
- start/end dates
- visibility
- linked track/lesson/space nullable

## `mission_step`

Optional checklist/milestones.

## `mission_submission`

- mission_id
- user/team
- evidence/proof
- status
- submitted_at

## `mission_review`

- reviewer
- rubric / structured criteria
- feedback
- outcome
- awarded points/badges hooks

## `project`

A persistent thing being built.

- organization_id
- owner
- title
- summary
- status/stage
- category
- visibility
- links
- cover

## `project_member`

Roles can include founder, collaborator, mentor, reviewer.

## `project_update`

Can also emit/render as feed content.

## `proof`

A reusable verified-ish evidence object linked to:

- mission submission
- project
- achievement
- profile

Examples: URL, video, image, file, metric, testimonial, external artefact.

## `opportunity`

- job
- freelance brief
- collaboration
- mentor request
- funding/grant
- event slot

## `opportunity_application`

This is informed by Frappe Learning's job-board breadth, but should be built as a more general opportunity system.

---

# 6. Events and live

## `event`

- organization_id
- space_id optional
- track/cohort/project relation optional
- type
- start/end
- location/URL
- capacity
- host

## `event_rsvp`

## `live_session`

Provider-agnostic metadata. Do not build our own video infrastructure initially.

## `recording`

---

# 7. Reputation and progress

## `activity_event`

This is a critical platform primitive.

Every meaningful event can be emitted once and consumed by:

- feed/activity rendering
- notifications
- webhooks
- analytics
- points rules
- automations

Example event names:

```text
post.created
comment.created
reaction.created
lesson.completed
track.completed
mission.submitted
mission.approved
project.created
project.shipped
event.attended
member.joined
badge.awarded
```

Fields:

- id
- organization_id
- actor_user_id
- verb/type
- object_type/object_id
- context_type/context_id
- payload JSON
- occurred_at

## `points_ledger`

Use an immutable ledger, not only a total on a profile.

- organization_id
- user_id
- activity_event_id
- points
- reason/rule
- reverses_entry_id nullable

Totals can be cached/aggregated.

## `achievement_definition`

## `achievement_award`

## `badge_definition`

## `badge_award`

## `leaderboard_snapshot`

Leaderboards should be scoped and configurable:

- organisation
- space
- cohort
- mission season
- time window

Do not let engagement points become the only reputation signal.

---

# 8. Moderation and safety

## `content_report`

## `moderation_action`

## `moderation_rule`

Borrow the *idea* of LearnHouse-style configurable controls:

- slow mode
- link restrictions
- account age thresholds
- posting rate limits
- reaction enablement
- auto-lock

## `block_relationship`

## `audit_log`

Separate admin/security audit logs from ordinary activity events.

---

# 9. Commerce and entitlements

## `plan`

Platform plan offered by REUNIR.

## `organization_subscription`

## `entitlement`

Do not scatter plan checks through UI code. Resolve features through an entitlement service.

## `product`

Tenant-sold product:

- membership
- course/track
- event
- cohort
- bundle

## `order`, `payment`, `refund`

Use provider abstraction for Stripe first, leaving room for other payment rails.

---

# 10. Integrations

## `api_key`

## `webhook_endpoint`

## `webhook_delivery`

## `integration_connection`

## `automation`

Keep integration events aligned with `activity_event` nomenclature.

---

# 11. Notifications

## `notification`

Durable in-app notification.

## `notification_preference`

Per type/channel/frequency.

## `notification_delivery`

Email/push delivery state.

This mirrors the strongest parts of OpenCircle/HumHub without binding notification creation to a particular transport.

---

# 12. Storage/search/media

## `media_asset`

- organization_id
- owner
- storage key
- mime type
- size
- visibility
- scan/status metadata

## `media_job`

Transcode/transcript/thumbnail jobs.

Search indexes should always carry `organization_id` as a mandatory filter.

---

# 13. Tenant isolation acceptance rules

Before any REUNIR alpha can be considered safe:

1. Every tenant-owned table is explicitly classified.
2. Every query helper requires organisation context or proves it handles public/global records.
3. Cross-tenant tests attempt reads/writes using valid IDs from a different organisation.
4. Object storage keys/presigned URLs are tenant scoped.
5. Realtime rooms/topics encode tenant context.
6. Worker jobs carry tenant context.
7. Webhooks never cross organisation boundaries.
8. Caches include tenant in keys.
9. Search requires tenant filter.
10. Analytics and AI context stores are tenant scoped.
