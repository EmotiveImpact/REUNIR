# Learner records: your own download, owner-authorised erasure and long review queues

Version 0.14.0-alpha.1. Built on Alpha 13 (cover library, receipt `0fb6903`, PR #5), retaining UI_DESIGN_DIRECTION.md and the knowledge-check, cover and instructor rules. The upstream review is in `research/notes/19_LEARNER_RECORDS.md`, and the decision in `decisions/014-learner-records.md`.

## Your learning record

On their own profile, every member sees **Your learning record** with **Download your learning record**. It downloads a dated JSON file, `reunir-learning-record-<community>-<date>.json`, for the community they are in. Nobody else can download it, and no other profile shows the button.

The file holds:

- the community's name and the member's name and joining date;
- tracks they joined, and lessons they completed, with dates;
- every knowledge-check attempt: lesson, attempt number, date, status, score, pass or not, each question with the options they chose and anything they wrote, whether each answer was correct and the points awarded, and any feedback with the reviewer's name and date;
- their mission submissions with status, link and feedback.

Every record that is the member's own is included, even when a track has since been unpublished or moved to a space they cannot open. Titles and names, though, come only from what the member can see: a track they can no longer open appears as "A track you can no longer open". Correct answers, accepted answers and explanations appear only where the author's reveal rule already shows them on screen. The file contains nothing about other members beyond the names of people who reviewed the member's work, and no internal identifiers, storage keys or other communities' data.

In live mode the file comes from `GET /api/organisations/:slug/me/learning-record`, read inside the member's own tenant transaction under the restricted runtime role, sent as an attachment with `Cache-Control: no-store` and `nosniff`. The demo builds the same file in the browser from fictional data.

## Long review queues

The review queue in Community studio and on the Teaching page shows 20 items at a time in each list, with **Show 20 more** (or the number left). Waiting answers stay oldest first, so the person who has waited longest is marked first; scored and reviewed attempts are newest first. The counts beside each heading are always the full totals; before, the scored and reviewed lists stopped at 30 and showed 30. After more appear, focus moves to the first new item so keyboard and screen reader users continue where the new items begin.

## Operator procedures

Two commands for operators, on the migration connection only (`MIGRATION_DATABASE_URL`). Each needs `AUTHORISED_BY`, the user ID of an active owner of the community who approved the request, and runs inside that owner's tenant transaction, so forced row security still applies. Each is a dry run that only counts or lists unless explicitly confirmed. Never paste credentials into chat or commit them; set them in the operator's own shell.

### Erase a learner's answers

```sh
COMMUNITY_SLUG=code-black MEMBER_USER_ID=<their user id> AUTHORISED_BY=<owner user id> \
ERASURE_REFERENCE="request 41" npm run db:erase-learner          # dry run: counts only
ERASE=yes ... npm run db:erase-learner                             # erase
```

This deletes the member's knowledge-check attempts in that community (their answers, results, marks and feedback) and the "Feedback on your knowledge check" notices sent to them. It refuses a partial erasure, bumps the workspace revision so open screens refresh, and records an audit entry, `learner.answers.erased`, with the request reference and counts only: no answer or feedback text.

What it does not erase, and why:

- The member's account, profile, enrolments, completions, posts, projects and missions. Accounts are shared across communities; account deletion and identity scrubbing are separate work.
- Reviewers' notices that the member answered a check ("A knowledge check needs feedback"). They sit in reviewers' inboxes and name the member and lesson only.
- Audit and outbox entries about attempts, which hold record IDs and actors, not answers.

Migration 0014 makes this possible under forced row security: one delete policy on attempts that admits only the member named in the transaction's `app.erasure_subject`, when the acting user is an active owner. The runtime role has no delete privilege on attempts, so the application itself can never erase.

### Clear unused cover files

```sh
COMMUNITY_SLUG=code-black AUTHORISED_BY=<owner user id> npm run db:prune-covers   # dry run: lists files
PRUNE=yes GCS_BUCKET=<bucket> npm run db:prune-covers                             # delete
```

It lists cover and library uploads that no track or project shows and the library does not list, and that were rejected or started over an hour ago, with their storage keys. With `PRUNE=yes` it deletes each stored file first, then removes only the records that are still unused at that moment, so a cover chosen again in between is kept. Files that could not be deleted keep their records and are listed for a later run. An audit entry, `cover.uploads.pruned`, records the count. Uploads also keep pruning these lazily, as before.

## Running it

Apply migration 0014 with `npm run db:migrate`. No runtime grant changes. Checks: `tests/learning-record.test.ts` (domain), `tests/learning-record-http.test.ts` (API under the restricted runtime role), `tests/operator-erasure-database.test.ts` (0014 upgrade, dry run, authorisation, runtime refusal, erasure through a role without row-security bypass, cover pruning), the record download and the 45-answer paging check in `npm run test:browser:assessments`, the live download in `npm run test:browser:assessments-connected`, and the erasure check in `npm run test:postgres`.
