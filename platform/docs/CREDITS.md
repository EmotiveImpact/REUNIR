# Contribution credits

The member who recorded a project contribution can credit teammates who worked on it with them. Decision: decisions/0NN-contribution-credits.md.

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
- The demo seed holds one fictional accepted credit (Nia James on Sofia Chen's Notes contribution).
