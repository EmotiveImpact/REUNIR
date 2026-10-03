# Decision 014: members download their own learning record; owners authorise erasure

Status: implemented in Alpha 14, verified locally; not deployed. Date: 3 October 2026.

## Problem

Knowledge-check attempts, feedback and other learning records have been kept as feedback history since Alpha 10, with no way for a member to take a copy and no procedure for erasing a learner's answers when they ask. Unused cover files could also linger in storage until someone uploaded again. Review queues showed only the first 30 scored or reviewed attempts and reported 30 as the count.

## Decision

- A member downloads their own learning record for one community from their profile, as a dated JSON file. It includes every record that is theirs, but titles, names and answer keys follow exactly what their own screen shows, and it contains nothing about other members beyond reviewers' names.
- Erasure is an operator procedure on the migration connection, authorised by an active owner of the community and run inside that owner's tenant transaction. It is a dry run unless confirmed, erases one member's knowledge-check attempts and the feedback notices about them, refuses a partial erasure, and leaves an audit entry with the request reference and counts only.
- Migration 0014 adds one delete policy on attempts that admits only the member named in the transaction, when the acting user is an active owner, so the procedure works for a hosted migration role without row-security bypass. The runtime role has no delete privilege on attempts.
- A second operator command lists and clears unused cover and library uploads, deleting stored files before records and keeping anything chosen again in between.
- Review queues page 20 at a time with exact totals; waiting answers stay oldest first; focus moves to the first new item.

## Alternatives considered

- **An administrator export of someone else's data, as LearnHouse offers.** It suits an organisation answering a request, but the person whose learning it is should not need anyone's help. The member's own download comes first; an administrator export can follow if communities need it.
- **Scrubbing identity and keeping learning records, as LearnHouse's anonymise does.** That keeps analytics but leaves the answers. Learners ask most often about what they wrote; REUNIR erases answers and keeps identity, because accounts are shared across communities and need their own deletion design.
- **Letting members erase their own attempts in the app.** Attempts are evidence for reviewers and instructors; removing them without an owner's knowledge could hide work under review. An owner-authorised procedure keeps accountability.
- **Running erasure as a database superuser or turning off forced row security.** Hosted roles may have neither, and both would bypass the very rules being relied on. A narrowly scoped policy keeps row security in force.
- **Server pagination for the queue.** Attempts still arrive in the bounded workspace snapshot; paging the interface fixes the misleading counts and long screens now, and server pagination remains roadmap work for large communities.
- **Copying donor code.** The reference projects are AGPL at their roots. Their behaviour informed the design; no file was copied.

## Consequences

Members can keep their own learning; communities can honour a request to erase a learner's answers with a reviewable trail; unused cover files can be cleared on demand; long queues read honestly. Account deletion, identity scrubbing, reviewers' notices that name a learner, and server-side pagination remain open, and LEARNER_RECORDS.md and BUILD_STATUS.md record these limits.
