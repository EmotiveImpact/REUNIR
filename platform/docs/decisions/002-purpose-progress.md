# ADR 002: Purpose and evidence without a platform rewrite

Status: accepted for Alpha 02. Date: 24 September 2026.

## Context

The owner directed REUNIR towards purposeful communities where people become, build and achieve. The Alpha 01 auth/community/learning/project foundation is retained. The conceptual unit is transformation, but introducing a generic transformation superclass or graph database would add complexity before the use cases require it.

## Decision

Represent purpose, path, milestone, contribution, outcome, community output and member goal explicitly in the existing relational/domain architecture. Path enrolment is separate from course enrolment. Link milestones to current lesson, mission and project IDs; reuse their evidence. Keep projects intact and add a nullable purpose relationship. Keep verified global identity with scoped community membership.

Private goals remain private to their member at the application boundary. Evidence source visibility applies to all derived views. Review authority is explicit and never inferred from points. Contributions may be reviewed by the project owner or a community administrator other than the author; outcomes require a community administrator other than the author.

Preserve event/outbox boundaries, typed IDs, author/reviewer identity and timestamps for future projections. No additional always-running service, new mandatory dependency, AI service or graph store is required.

## Consequences

We obtain a purposeful Home, a small path builder, private goals, reviewed work and an output archive while retaining established conversations, courses and projects. The database change is additive and versioned. Existing data is not converted into invented transformations.

The initial path supports only lesson completion, approved mission proof and recognised project contributions. It does not support arbitrary prerequisites, external credential verification or quantitative goal attainment. A verified outcome is a community review, not a platform accreditation. A published output is visible to community members, not automatically to the internet.

Published paths have stable milestone lists; later versioning can support controlled curriculum changes. Outcomes currently credit one evidencing author/source while project teams remain separate. Multi-contributor output credits, evidence revocation/appeals and granular audit history need deliberate extensions.

## Alternatives not selected now

Replacing the LMS, storing purpose as arbitrary post JSON, launching a separate graph service, turning likes into trust, or hard-coding all communities into Become + Build + Achieve. None is needed to preserve the future vision.
