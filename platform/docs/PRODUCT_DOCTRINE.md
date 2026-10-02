# REUNIR product doctrine

Accepted direction · 24 September 2026 · Applies to Alpha 02 and subsequent work.

## The product unit is transformation

**People join communities here to become something, build something or achieve something.**

The community is the container. The deeper product is progress, creation, contribution, reputation and belonging through action. The fundamental product unit is therefore not simply the community. It is the transformation: what a person is becoming, what they are building, and what evidence exists that progress has happened.

Internally, REUNIR is **an operating system for purposeful communities**. This is a product doctrine, not a claim that a literal operating system or every future capability has already been implemented.

A community should be able to answer at least one of these questions:

1. What are these people becoming?
2. What are these people building?
3. What are these people trying to achieve?

One direction is enough. The product must not force every community into three programmes or fabricate a purpose during a migration. An existing community can keep operating while its owner articulates the purpose.

**People + Purpose + Progress + Projects + Proof** is the internal product framework. **Become + Build + Belong** is a potential expression, not a requirement to rename every navigation item.

## What stays

Conversation, friendship, questions, humour, events and belonging are not distractions from the product. They make participation possible. Posts, spaces, notifications, moderation, permissions, search, accounts and eventual messaging remain core capabilities.

We are not replacing a feed with a productivity assessment system. A member can read, ask for help, pause a goal or change direction without being ranked as a failure. Home should offer a useful next action rather than force a ritual or endlessly recommend more content.

## The model

Conceptual model: **Person → Community → Purpose → Path → Project → Contribution → Outcome**.

This is a network of relationships, not a compulsory sequence. A person can join a project without taking a path. A path can include a lesson, a short mission or a project contribution. An outcome can result from approved mission proof without a large project. A goal can start without a chosen path.

The current Person boundary is the existing authenticated user and their tenant-scoped memberships. We do not create a duplicate identity table or a global public profile to satisfy a diagram. Community-specific roles and privacy remain authoritative.

### Distinguish the records

**Purpose** is the shared direction. **Member goal** is one person's intention. **Path** connects meaningful steps. **Milestone** specifies the evidence of a step. **Project** is the work being made. **Contribution** identifies a person's concrete work and its reviewer. **Outcome** states what changed and points to a reviewed source. **Community output** is a deliberately published record of work produced inside the community.

A post describing a film is not the film project. Joining its team is not a contribution. Submitting an assignment is not approval. A completed lesson is not proof of professional competence. A verified outcome in this release means that an authorised community reviewer checked the submitted record, not that REUNIR independently accredited it.

## Progress and evidence

Alpha 02 adds paths over the existing learning and mission systems, not a parallel LMS. Lesson milestones use existing completion records. Mission milestones require approved proof. Project milestones require recognised contributions by that member. No universal percentage attempts to measure the whole person.

Goal completion is explicit. The member must have completed the linked, enrolled path or select a verified outcome authored by them for that goal's purpose. Merely having some outcome in the community does not auto-complete the goal. A completion source and timestamp are retained.

People may describe skills in their profile, but self-description is distinct from evidence. Reviewer identity and feedback should accompany recognised work. New purpose, path, contribution, outcome and output actions do not issue additional points. Existing bounded lesson/mission recognition remains intact; extensive gamification is not part of this wave.

## Home and information architecture

Home answers **what we are here to do**, then offers a member's chosen direction, active projects, relevant discussions, upcoming events, people and outputs. It is not just a composer followed by an infinite feed.

Current navigation is Home, Paths & learning, Projects, Events, Your people, Discussions and Knowledge. Missions, Community outputs, Saved, Notifications, Settings and Community studio remain reachable. Existing course and mission routes keep working.

Knowledge starts as a view of accessible resource posts and learning links. It is not yet a wiki, automated knowledge extractor or institutional archive engine. The output archive is similarly a small, explicit feature, not a fabricated impact dashboard.

## Privacy and consent

Member goals are private by default. Application-level community administrators do not receive another member's private goals through snapshots or profile views. Explicit sharing is scoped to members of that community, not the internet. This is access control, not end-to-end encryption: database operators remain a separate trust boundary.

Evidence visibility must follow its sources. A public-within-the-community path cannot expose private-space targets. Private project/mission evidence must not silently become a community-wide output. A published output currently means the authenticated member archive, not public marketing or cross-community discovery.

Future portable profiles, talent discovery, AI context and public showcases need explicit consent and revocation policies. Private goals must not quietly become recommendation-training data. Never copy private discussions into a public profile because an engagement feature would find them useful.

## Future concepts preserved, not implemented

### Communities produce outputs

Films, software, companies, research, music, books, campaigns, events, trained people and completed projects are potential measures of community value. Define counting rules, review standards, collaborators, time windows and deduplication before claiming those measures. A curated record count is not automatically a verified real-world impact statistic.

### Contribution graph

Eventually connect who worked with whom, what they delivered, whom they helped, what responsibility they carried and whom they taught. Explicit IDs, typed relationships, reviewer references, timestamps and the transactional event outbox preserve this direction. There is no graph database or automatic reputation inference now. Future many-to-many output credits can extend the relational model without replacing identity or project records.

### Communities can become institutions

Curriculum, rituals, standards, apprenticeships, archives, alumni and leadership succession can allow a community to behave like a school, guild, studio or society. Add those capabilities in response to actual communities, not as empty navigation. An earned social distinction must never automatically elevate security permissions without an explicit governance action.

### AI should help humans act together

A later AI layer may understand goals, obstacles, available help, project needs, buried knowledge and readiness to mentor. “Three projects need the directing skill you want to practise” is a more useful direction than merely adding a chatbot. It needs consent-aware context, grounded evidence, operator controls and safe failure behaviour. None is shipped in Alpha 02.

### Progression loop

**Discover → Join → Learn → Do → Build → Prove → Teach → Lead**.

Or **Join → Become → Build → Contribute → Lead**. These are product loops, not enforced ranks. Becoming a mentor or leader should be an earned, voluntary relationship supported by evidence and human judgement.

## Not now

Advanced reputation graphs, AI matching, automatic mentor identification, marketplaces, funding, cross-community talent discovery, sophisticated credentials, AI orchestration, health scoring and complex progression remain deferred. Native chat, email/recovery, operational moderation, reliable deployment, accessibility, pagination and ownership workflows have priority over those systems.

## Decision filter

When adding a feature, ask what people can do, learn, create or demonstrate because it exists; whose time and privacy it consumes; what evidence supports the result; and whether an existing primitive already serves the need. A proposed feature does not need a new service, point system or navigation item merely because a reference platform has one.

**Architect for the full vision. Productise it progressively.**
