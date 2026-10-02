# Decision 010: knowledge checks live in the lesson, and attempts are reviewed evidence, not credentials

Status: implemented in Alpha 10, verified locally; not deployed. Date: 2 October 2026.

## Problem

Creators want to check understanding after a lesson and give feedback. Learners need to know how they did without the answer key leaking, and reviewers need a queue for written answers. All of it must respect the existing draft and publication model, tenant isolation and current roles, and must not turn learning into public scores or implied accreditation.

## Decision

- Store one optional quiz as bounded JSON on lessons, drafts and revisions, next to the rich body and resources. The `lessonContent` whitelist carries it through save, preview, publication, capture and restore, so no parallel authoring lifecycle exists.
- Score on the server only. Strip correct flags, accepted answers and explanations from every lesson sent to anyone but owners and administrators. Reveal them on a learner's own attempts only under the author's rule.
- Refuse answers to a changed check by comparing a fingerprint of the learner-visible quiz, rather than scoring answers against questions the learner never saw.
- Record each attempt in `quiz_attempts` with the quiz it answered. Treat attempts as evidence: no deletion by the application role, and only review columns can change, enforced by column grants, row policies, constraints and the domain.
- One review per attempt, by an active owner or administrator who is not the learner, with every written answer marked and feedback written.
- Keep scores private and separate: no reputation points, no automatic completion, no visibility to other members, no certificates.

## Alternatives considered

- **A separate quiz entity with its own publish workflow.** Would duplicate draft, preview, publication and history and let a lesson and its check drift apart. Keeping the check inside lesson content reuses every existing rule.
- **Normalised question and option tables.** Better for analytics later, but triples the copy logic for publication, capture and restore. The JSON follows the precedent of `rich_body` and `resources`; validation happens in one schema shared by client and server.
- **Live answer checking or client-side scoring.** Turns the endpoint into an answer oracle, as Frappe Learning's guard recognises. Rejected.
- **Partial credit and negative marking, as LearnHouse and Frappe offer.** Adds rules authors and learners must understand. All-or-nothing per question keeps scoring predictable; partial credit can be reconsidered with real needs.
- **Mutable attempts or deleting old ones.** Would let feedback history change silently. Rejected; a privacy erasure procedure is a separate, explicit operator task.
- **Completing the lesson or awarding points on a pass, as Frappe Learning and ClassroomIO can.** Conflicts with the doctrine that engagement is not credentials. Rejected.
- **Copying donor code.** All three reference projects are AGPL at their roots. Their behaviour informed the design; no file was copied.

## Consequences

Creators author and publish checks with the same private workflow as lesson text and files. Learners get server-scored, privately held feedback, and reviewers have a queue with explicit states. Attempts cannot be rewritten after the fact. Question banks, timers, partial credit, exports and an erasure procedure remain open and are listed in ASSESSMENTS.md and BUILD_STATUS.md rather than implied.
