# Decision 017: loose ends after account deletion and ownership transfer

Status: implemented in Alpha 17, verified locally; not deployed. Date: 3 October 2026.

## Problem

Alpha 15 and 16 recorded four limits: tasks claimed in a community where the person was suspended stayed assigned after they deleted their account; a deletion that starts while an invitation is being accepted was handled by reasoning, not a test; a replaced or removed cover picture stayed in private storage until someone uploaded again or an operator pruned it; and mentions of a deleted person inside other people's posts stay as written.

## Decision

- **Claimed tasks go back everywhere.** Deleting your own account releases every task you had claimed without submitting proof, in every community, suspended or not. Migration 0018 (additive) admits exactly those tasks while the transaction is marked as your own deletion, and an update may only leave them unassigned, without proof and back in "to do". PostgreSQL requires an updated row to stay readable, so the transaction names the tasks it releases (`app.released_tasks`) and the read policy admits those once they are unassigned. The domain rule, shared with the demo, was already the same.
- **The timing case has a test.** The PostgreSQL check holds an acceptance's share lock on the account, starts a deletion on another connection, proves it waits, then commits the new membership and proves the deletion removes it with the rest.
- **Replaced covers go at once.** When a track or project cover changes or is removed, the upload record of the picture nothing shows any more is deleted in the same change, and the API deletes its stored file straight after commit. Library pictures stay in the library. Unchosen and rejected uploads keep the existing hourly pruning and the operator command.
- **Mentions stay as written.** REUNIR has no mention links: "@Jo" in someone's post is that author's text and points to no profile. Rewriting it would change another person's words and their record, which the doctrine forbids ("keep original user evidence intact"). The deleted person's own name, photo and profile are already gone everywhere REUNIR renders a member.

## Alternatives considered

- **Leave suspended tasks for an administrator.** That kept a deleted person's name off the task but left work blocked on someone who can never return.
- **A policy that lets the deleting person read any unassigned task.** Wider than needed; naming the released tasks keeps the read to exactly what the deletion changed.
- **Delete replaced covers on a schedule.** No scheduler is provisioned yet, and a schedule leaves the picture stored for longer than the change needs.
- **Replace "@Name" with "@Former member" in other people's posts.** Rejected as above; it also cannot tell "@Jo" the member from "@Jo" the word.

## Consequences

Migrations 0001 to 0017 are unchanged and no grants change. Rerunning `npm run db:migrate` applies 0018. If storage refuses a deletion after commit, the object is private and unreferenced, never served, and `npm run db:prune-covers` lists it.
