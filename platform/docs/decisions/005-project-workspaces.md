# Decision 005: project workspaces reuse evidence, not another task platform

Status: implemented in local Alpha 05. Date: 24 September 2026.

## Problem

Projects can already gather people and receive updates, contributions and outcomes. They need a useful plan of work, responsibilities and contextual discussion. A separate task SaaS would duplicate identity and permission boundaries; an independent task-review engine would drift from existing contribution review.

## Decision

Add typed project tasks/notes to the existing modular application. Reference existing Contribution for proof. Derive task recognition from authorised review. Keep planning controls with the project lead/community admin, claim/start/submit with the assignee, and notes within the team. Use explicit date/criteria fields and relational constraints, not metadata on posts. Retain scope caps, expected-version checks and request receipts. Add no runtime dependency.

## Alternatives considered

- Transplant HumHub Tasks: valuable behaviour, but brings its PHP/Yii/content architecture and licence commitments, not a drop-in React/Hono component.
- Treat tasks as posts: weak assignment, workflow and relational guarantees.
- Add an external project platform: duplicates memberships, access and lifecycle, and disconnects proof from paths/outcomes.
- Build a second review engine: duplicates existing tested logic and makes progress inconsistent.

## Adopted references and actual reuse

The exact source observations and local tests are linked in the research register. Zero donor application source files are imported. Existing contribution handlers, review component, domain policies, notifications, outbox, repository transactions and established libraries are reused. Direct imports remain an option after explicit file/dependency/licence review; this is not a blanket clean-room doctrine.

## Consequences

A teammate can perform and discuss work in the application, then carry recognised evidence into the existing purpose system. Note/proof audiences are explicit. Complex task planning, attachments, multiple credited assignees, reminders and realtime collaboration remain outside the release. Task briefs lock after proof to protect meaning. A substantial change should be a follow-up task, not a retroactive redefinition.
