# REUNIR Product Information Architecture

This is the working member/admin product map that follows from the research.

## Product stance

REUNIR should not look like a generic corporate dashboard.

It should feel like a **living place** with movement, people, work and progression.

The product is not primarily “a dashboard of modules”. It is a network where a member can immediately answer:

1. What is happening?
2. What should I learn?
3. What can I do now?
4. Who can I do it with?
5. What am I building?
6. How am I progressing?
7. What opportunity has opened up?

---

# 1. Member navigation

Recommended working navigation:

## Home

Personalised pulse rather than admin stats.

Contains:

- activity from your Spaces
- current mission
- track progress
- project updates
- upcoming event
- people you work with
- useful opportunity
- notifications needing action

## Community

Organisation-wide feed/discovery.

Views:

- For You
- Latest
- Following
- Questions
- Ideas
- Show & Tell

## Spaces

Communities within the community.

A Space has:

- feed
- members
- resources
- events
- optionally linked Track/Missions/Projects

## Learn

Tracks and programmes.

Member view:

- Continue
- Your Tracks
- Discover
- Cohorts
- Saved

## Missions

Action layer.

Member view:

- Active
- Available
- Submitted
- Reviewed
- Completed

A mission should feel closer to a brief/challenge than a school assignment.

## Build

Projects and proof-of-work network.

Views:

- Your Projects
- Discover Projects
- Looking for Collaborators
- Shipped
- Showcases

Each project can have:

- pitch
- stage
- team
- updates
- proof
- needs
- feedback

## Events

- Upcoming
- Your RSVPs
- Replays
- Calendar

## People

Search/discover members by:

- role/skills
- interests
- Spaces
- projects
- reputation/proof
- availability to collaborate/mentor

## Inbox

Direct/group conversations.

## Profile

Not just biography.

Profile should tell the member's story through:

- identity
- skills/interests
- Spaces
- completed Tracks
- Missions/proof
- Projects
- collaborations
- badges/achievements
- contributions
- public links

## Progress / The Board

This may be a configurable tenant label.

Should distinguish multiple dimensions rather than a single vanity score:

- Learning
- Doing
- Contribution
- Collaboration
- Impact

---

# 2. Operator/admin product

Do not make the admin a completely different mental universe. It should feel like “edit/manage this community”.

## Overview

- member growth/activation
- meaningful participation
- learning progress
- mission completion
- project activity
- upcoming events
- moderation queue

## Members

- members
- roles
- invitations
- cohorts
- tags/segments
- suspensions/moderation

## Spaces

Create/edit Spaces, permissions, join rules and linked modules.

## Learning

- Tracks
- sections/lessons
- quizzes
- cohorts
- progress

## Missions

- mission builder
- rubrics/criteria
- reviewers
- submissions
- rewards

## Projects

- categories
- visibility
- featured/showcase controls
- collaboration settings

## Events

- events/live sessions
- RSVP/capacity
- replays

## Community

- categories/labels
- posting controls
- moderation rules
- reports

## Reputation

- points rules
- badges
- leaderboard scopes
- seasons

## Monetisation

- memberships
- products
- orders
- payouts/Stripe connection

## Appearance

- logo
- colour/theme
- custom domain
- terminology
- navigation/module switches

## Integrations

- API keys
- webhooks
- connected services
- automations

## Analytics

Focus on outcomes rather than page views alone:

- active members
- contributors
- track completion
- mission completion
- projects shipped
- collaborations formed
- event participation
- opportunity conversion

---

# 3. Core social object strategy

Avoid creating five disconnected feeds.

The global/community feed should be able to surface authorised activity from:

- posts
- mission completions/submissions (where public)
- project updates
- new projects/showcases
- achievements
- events
- meaningful member milestones

This is powered by the universal activity-event system, with canonical objects still living in their own domains.

---

# 4. Tenant customisation

Each organisation can decide which modules exist:

```text
Community       ON
Spaces          ON
Learn           ON
Missions        ON
Build           ON
Events          ON
People          ON
Inbox           ON
Progress        ON
Opportunities   OFF
Marketplace     OFF
```

And rename major labels.

That lets the same platform become:

### Code Black

- Tracks
- Missions
- Squads
- Build
- The Board

### Fitness community

- Programmes
- Challenges
- Teams
- Transformations
- Rankings

### Business network

- Learning
- Briefs
- Circles
- Ventures
- Reputation

The database/API uses canonical terms. The UI uses the organisation's vocabulary.

---

# 5. The Code Black proof case

Code Black should be REUNIR tenant #001 and exercise the hard parts first:

- creator profiles
- creative/technical Tracks
- weekly Missions
- project showcase
- squads/collaboration
- critique/feedback
- live events
- opportunities
- reputation based on contribution + proof

If this is compelling for Code Black, the product has evidence that it can be sold to other communities rather than being built in a vacuum.
