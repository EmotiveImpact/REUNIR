# Contribution and outcome credits

The member who recorded a project contribution can credit teammates who worked on it with them. Decision: decisions/034-contribution-credits.md. Since Alpha 59 the person who recorded an outcome can do the same on the outcome (decisions/059-outcome-credits.md; see **Outcome credits** below).

## How it works

1. On a project page, under **Work worth recognising**, the author of a contribution chooses **Credit someone…**, picks a teammate from the project's team and can add what they did (up to 60 characters, one line).
2. The teammate gets a notice, opens the project and sees an **Accept credit** / **Decline** prompt on that contribution. Until they accept, only the author and they can see the invitation.
3. Once accepted, the contribution reads "With Idris Cole" for everyone who can read it, and the teammate's profile lists the work under **Credited on**, apart from their own contributions.
4. The author can withdraw an invitation or remove a credit; the credited person can remove their own accepted credit. A person who declined or removed a credit is not asked again on that contribution.

## Rules

- Only the author invites; only active members of the project's team, never the author; one live credit per person; at most 10 at once and 30 records per contribution.
- Credits are acknowledgement, not evidence. They do not count towards milestones, paths, goals, outcomes, outputs, reputation, roles or any credential, and they are not community review. A credited person cannot review the contribution they share.
- Administrators do not see invitations or refusals. Suspended members' accepted credits are hidden from people who cannot see suspended members. Deleting an account deletes the credits naming that person.

## Storage and checks

Migration `0033_contribution_credits.sql`, additive, with forced row security and column-limited update grants (see `packages/db/src/runtime-role.ts`). Tests: `tests/credits.test.ts`, `tests/credits-database.test.ts`, the account-deletion tests, the credits check in `scripts/postgres-check.ts`, and `npm run test:browser:credits`.

## Known limits

- There is no way to leave a project team yet, so a credit cannot end because someone left the team.
- An open invitation from a person who then deletes their account can still be accepted or declined.
- Credit descriptions are free text chosen by the author and are not moderated separately.
- The demo seed holds two fictional accepted credits: Nia James on Sofia Chen's Notes contribution and on the outcome published from it.

## Reviewers and credits

Nobody both reviews a contribution and shares its credit. A credited person cannot recognise the contribution or decide a correction to it, and someone who reviewed it or decided a correction cannot be invited or accept a credit on it (`REVIEWER_NOT_CREDITED`).

## Outcome credits

Alpha 59 adds the same consent flow to outcomes, on **Community outputs**.

- The outcome's author chooses **Credit someone…** on the outcome. For an outcome from project work the choice is the project's team; for one from a mission proof, any active member who can see the mission (the server checks who can see it).
- The person invited is notified and may read the outcome before it is reviewed, so they can decide. Once they accept, the outcome reads "With Idris Cole", and so does the community output published from it. Their profile lists it under **Credited on** as "Outcome recorded by …".
- A credited administrator cannot verify the outcome or decide a correction to it, and the administrator who verified it, or decided a correction, cannot be credited on it. A withdrawn outcome takes no new credits.
- A credit never lets the credited person complete a goal with the outcome, and adds nothing to reputation or roles.

Storage: migration `0050_outcome_credits.sql` (`outcome_credits`, forced row security, the same column-limited update grant). Tests: `tests/outcome-credits.test.ts`, `tests/outcome-credits-database.test.ts`, the outcome credits check in `scripts/postgres-check.ts`, and the outcome checks in `npm run test:browser:credits`.
