# Decision 033: a history for correcting or withdrawing reviewed evidence

Status: implemented on a feature branch, verified locally; not deployed. Date: 3 October 2026.

## Problem

Once a contribution was recognised or an outcome verified, nothing could change it. A typo stayed forever, and evidence that turned out to be wrong kept counting towards paths, profiles, goals and the output archive. Editing the record in place would have rewritten what a reviewer actually checked.

## Decision

- **Reviewed history is never rewritten.** Every correction or withdrawal is a new `evidence_changes` row that keeps the reviewed wording it replaced (title, text and link). The runtime role may insert such a row and then change only its decision columns (status, decided by, decided at, response); it cannot reword or delete one.
- **Corrections are reviewed like the original.** Only the author may ask to correct reviewed evidence. A project owner or administrator reviews a contribution's correction; an administrator reviews an outcome's. Nobody reviews a correction to their own evidence. One correction waits at a time, it must change something, and the first submission's length limits apply. The reviewed version stays until the correction is accepted.
- **Accepted corrections carry through.** Accepting updates the contribution or outcome; a published output repeats its outcome's words, so it follows the correction. The earlier wording stays in the history.
- **Withdrawal is explicit, immediate and final.** The author or an administrator withdraws reviewed evidence with a reason. It becomes `withdrawn`, stays on record and visible to the same people as before, marked as withdrawn, and stops counting everywhere that counts recognised or verified evidence: path milestones, profiles, outcome sources, goal completion and the output archive. Withdrawing a contribution withdraws the verified outcomes built on it. A goal completed with a withdrawn outcome is open again and its owner is told. A correction waiting on withdrawn evidence is declined. A project task whose proof was withdrawn returns to in progress and takes new proof as a new contribution.
- **Who sees what.** A waiting correction is visible only to its author and the people who may review it. Decided corrections and withdrawals are visible to whoever can see the evidence. Everything stays inside its community (row security and domain checks), and suspended or former members can neither ask, withdraw nor review.
- **Community review, not accreditation.** A correction accepted here is a community reviewer's decision, as the original recognition was.

## Defaults chosen

- Outcomes still waiting for review are not withdrawn with their contribution; they can no longer be verified because their source is not recognised.
- A goal completed through a path (rather than an outcome) is not reopened when a contribution behind one milestone is withdrawn; completion was explicit at the time, and the path's progress shows the change.
- Withdrawal cannot be undone; new evidence is submitted and reviewed afresh.

## Not decided here

Undoing a withdrawal, corrections to mission proof, a community-wide log of changes, and removing withdrawn wording for privacy (account deletion and owner-authorised erasure remain the routes for that).
