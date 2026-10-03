# Evidence history: corrections and withdrawals

Reviewed evidence (recognised contributions and verified outcomes) can be corrected or withdrawn without rewriting what was reviewed. See decisions/033-evidence-history.md.

## Behaviour

- **Correct…** (author only, on a recognised contribution in the project view or a verified outcome on Community outputs) proposes new title, text and link with a reason. Reviewers are notified: the project owner and administrators for a contribution, administrators for an outcome. The reviewed version stays until a reviewer accepts in the **Review a correction** dialogue, which shows both wordings. Accepting updates the evidence and any published output that repeats an outcome, and the evidence then shows the accepting reviewer and their response; the history keeps the earlier wording with its original reviewer. Declining keeps the reviewed version. Either way the author is notified.
- **Withdraw…** (author, or any administrator) with a reason. The item stays, marked **withdrawn** and greyed, with its history. Verified outcomes built on a withdrawn contribution are withdrawn too, a goal completed with a withdrawn outcome reopens, and the output leaves the archive. The author is told when an administrator withdraws; the reviewer is told when the author does.
- **History** lists, oldest first: Corrected on (with the earlier wording), Correction not accepted on (with the wording that was not accepted), Withdrawn on (with the reviewed wording), each with its reason and any reviewer response.
- Waiting corrections are visible only to the author, administrators and, for contributions, the project owner.

## Data

- Commands: `evidence.correct`, `evidence.correction.review`, `evidence.withdraw` (packages/domain/src/evidence-history.ts).
- Migration 0032 adds `withdrawn` to the `contributions_status_check` and `outcomes_status_check` constraints and creates `evidence_changes` (forced row security, tenant policy, one waiting correction per item enforced by a partial unique index). The runtime role may select and insert; it may update only `status`, `decided_by`, `decided_at` and `response`, and may not delete.

## Known limits

- Withdrawal cannot be undone. Mission proof has no correction history.
- The browser demo keeps its history in browser storage only.
