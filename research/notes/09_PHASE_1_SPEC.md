# REUNIR Phase 1 Specification

## Goal

Deliver a secure, multi-tenant alpha that can run **Code Black as tenant #001** and prove the full REUNIR loop:

> Join → connect → learn → do a Mission → publish proof → collaborate on a Project → progress.

## Phase 1 modules

### Foundation
- user/auth
- organisation
- organisation membership
- roles/permissions
- invites
- tenant context
- brand + terminology settings
- audit log
- media/storage
- domain-event bus

### Community
- Spaces
- posts
- comments
- reactions
- member directory
- profiles
- notifications
- moderation/reporting

### Learning
- Tracks
- sections
- lessons
- enrolment
- progress
- cohorts
- simple quizzes

### Doing
- Missions
- Mission submissions
- reviews
- Projects
- project members
- project updates
- Proof objects
- points ledger

### Events
- event creation
- RSVP
- external live-link / replay link

## Explicitly out of Phase 1

- native video conferencing
- native mobile apps
- full Stripe marketplace/payouts
- SAML/enterprise SSO
- plugin marketplace
- collaborative whiteboards
- SCORM
- deep AI agents
- complex certificates
- public marketplace discovery outside a tenant

## Tenant isolation acceptance criteria

1. Every tenant-owned table has `organization_id` unless documented otherwise.
2. Request context resolves exactly one organisation before protected tenant data is queried.
3. Service/query tests attempt cross-tenant read/write using valid foreign IDs and must fail.
4. Object storage keys are tenant-prefixed and authorisation checked before signing URLs.
5. Redis keys and realtime rooms include organisation context.
6. Worker jobs serialise organisation context.
7. Search is tenant-filtered.
8. Domain events and notifications carry organisation context.
9. Admin actions create audit records.
10. No AGPL-derived implementation exists in proprietary core without a deliberate licensing decision.

## Product acceptance criteria for Code Black alpha

A Code Black administrator can:
- invite members
- configure branding/terminology
- create Spaces
- create a Track and lessons
- create a Mission linked to a Track or Space
- review a Mission submission
- create an event
- moderate content

A Code Black member can:
- join and set up a profile
- see a personalised Home
- post/comment/react in authorised Spaces
- enrol and complete lessons
- submit proof to a Mission
- create/join a Project
- publish Project updates
- RSVP to an event
- see meaningful progress/reputation

## Success metric

Phase 1 is successful when members can complete the full loop without the product feeling like a course portal with a forum bolted on.
