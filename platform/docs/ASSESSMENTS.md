# Creator Studio 4: knowledge checks

Version 0.10.0-alpha.1. Built on merged Alpha 09 private lesson resources (`788e5d7`), retaining UI_DESIGN_DIRECTION.md and the existing draft, publication and revision model. The upstream review is in `research/notes/15_ASSESSMENTS.md`.

## What creators, learners and reviewers can do

**Creators.** In Creator Studio, an owner or administrator can add one optional knowledge check to a lesson. It holds up to 15 questions of four kinds: single choice, multiple choice, short answer and written response. Each question has a prompt, 1 to 10 points and an optional explanation. Choice questions have 2 to 6 options with the correct ones marked; short-answer questions have up to 10 accepted answers. The check has an optional pass mark (1% to 100%), an attempt limit (1 to 10, or unlimited) and a choice about whether correct answers may be shown later. The editor lists every problem that blocks saving in plain language. The check is part of the private draft: it is saved with **Save draft**, appears in the private preview exactly as learners will see it, and reaches learners only after **Publish saved lesson**. Revision history records it and an older revision can be restored into the draft.

**Learners.** A learner who has joined the track sees the check below the lesson and its files, with its rules ("3 questions · 4 points · Pass mark 75% · 3 of 3 attempts left") and a privacy note. **Submit answers** is enabled once every question is answered. The server scores the attempt and the learner sees, per question, whether it earned its points. Correct options, accepted answers and explanations appear only under the author's reveal rule. Earlier attempts stay listed. A learner can try again while attempts remain and no written answer is waiting for review.

**Reviewers.** Active owners and administrators see a **Knowledge checks** tab in Community studio, with a count of attempts waiting for feedback. Each card shows the learner, lesson, every answer, the automatic results and the answer key. The reviewer marks each written answer (0 to its points) and writes feedback; both are required. Feedback can also be added to an automatically scored attempt. Reviewers cannot review their own answers. The learner is notified and sees the marks and feedback with their attempt.

## Rules

| Rule | Behaviour |
| --- | --- |
| Scoring | On the server only. Single and multiple choice need the exact set of correct options (no partial credit). Short answers match an accepted answer after Unicode, whitespace and case normalisation (no fuzzy matching). Written responses wait for a reviewer. Percentages round down, so a score never rounds up into a pass. |
| Answer keys | Lessons reach members, moderators and learners without correct flags, accepted answers or explanations. Owners and administrators receive them because they author and review. |
| Reveal | An attempt's answers and explanations unlock only when the author allows it, the attempt is final (not waiting for review), and the learner has passed, used every attempt, or the check has no pass mark. |
| Stale answers | Each submission carries a fingerprint of everything the learner saw. If the author published a change meanwhile, the attempt is refused with "This knowledge check changed after you opened it" and the page reloads the current version, keeping answers to unchanged questions. Answers must also cover exactly the published questions and options. |
| Attempts | Must be enrolled in the track, able to open the lesson, track and space, and an active member. One attempt may wait for review at a time. Unlimited checks are still capped at 50 attempts per learner and lesson. |
| Evidence | Each attempt stores the quiz it answered, so later edits or removal never change its meaning. After submission only review fields can change; attempts are never deleted by the application. |
| Review | Once, by an active owner or administrator who is not the learner, against the attempt's current version. Every written answer must be marked, nothing else, within its points. |
| Doctrine | Scores are private feedback. They award no reputation points, do not complete the lesson, do not appear to other members and certify nothing. Community review is not accreditation. |

## Who sees what

| Who | Questions | Answer keys | Own attempts | Others' attempts | Review |
| --- | --- | --- | --- | --- | --- |
| Active owner/admin | Yes, including drafts | Yes | Yes, with keys | Yes, in their community | Yes, except their own |
| Active member, moderator | Published lessons they can open | Only under the reveal rule, on their own attempts | Yes | No | No |
| Suspended or removed member | No | No | No | No | No |
| Another community, anonymous visitor | No | No | No | No | No |

PostgreSQL enforces the boundary in depth. `quiz_attempts` has forced row-level security: members read their own rows; active owners and administrators read their community's; inserts must be the caller's own, unreviewed and by an active member; updates are allowed only to an active owner or administrator who is not the learner and must record that person as the reviewer. The runtime role has no DELETE on the table and may UPDATE only `results`, `score`, `passed`, `status`, `feedback`, `reviewer_id`, `reviewed_at` and `version`.

## Model, API and migration

- `lessons`, `lesson_drafts` and `lesson_revisions` gain a nullable `quiz` JSON object (at most 20,000 bytes as stored). Nothing is backfilled: existing rows keep NULL, which reads as no check.
- `quiz_attempts` holds one row per submission: the quiz snapshot, answers, per-question results, score, maximum, status (`scored`, `awaiting_review`, `reviewed`), pass result, feedback, reviewer, review time and version. Constraints tie status to the review fields, forbid self-review, keep feedback empty until review, and make `(organisation, lesson, learner, attempt number)` unique.
- Commands go through the existing `POST /api/organisations/:slug/commands` route with its idempotency key: `quiz.attempt.submit {lessonId, fingerprint, answers}` and `quiz.attempt.review {attemptId, expectedVersion, marks, feedback}`. The quiz itself is saved with `lesson.draft.save {..., quiz}`. A draft that has a check must be saved with the `quiz` field present (or `null` to remove it), so an older client cannot drop it silently.
- Limits: 16 KB of quiz JSON, 2,000 characters per written answer, 120 per short answer, 32 KB of answers per attempt, 2,000 characters of feedback.

Migration `0010_assessments.sql` is additive; migrations 0001 to 0009 are byte-identical. Upgrade order: `npm ci`, `npm run db:migrate` with the administrative `MIGRATION_DATABASE_URL`, then `npm run db:grant-runtime`, which also applies the attempt column grants.

## Demonstration mode

The fictional Code Black demo has two checks: "Cut it down to the useful part" (three automatically scored questions, pass mark 75%, three attempts, answers shown after passing or using every attempt) and "Test before you celebrate" (one choice question and one written response, no pass mark, unlimited attempts, answers never revealed). Sofia Chen's fictional attempt on the second waits in the review queue. Studio North has no checks. Demo state stays in the browser. Because the demo runs the whole fictional community in the browser, its storage holds the answer keys too: the demo shows the learner experience, not answer secrecy. Withholding keys is a server guarantee, verified by the HTTP, database and connected-browser tests.

## Verification

`tests/assessments.test.ts` (schema, scoring, fingerprints, reveal rule, attempts, review, visibility, tenant isolation, draft and publication), `tests/assessments-database.test.ts` (0010 upgrade, restricted runtime role, column grants, RLS for members, moderators, suspended and demoted administrators and another tenant), `tests/assessments-http.test.ts` (API validation, replay, body limits, review permissions, tenant isolation), `tests/assessments-ui.test.ts` (rendered markup never shows keys before the reveal rule), `scripts/assessments-browser-check.ts` (demo creator, learner and reviewer journey with accessibility, neutral-colour and mobile checks), `scripts/assessments-connected-check.ts` (live build, Better Auth sessions, review and a concurrent edit) and the knowledge-check step in `scripts/postgres-check.ts`. See BUILD_STATUS.md for the recorded runs.

## Limits and not yet done

- No question banks, randomised order, timers, partial credit, negative marking, fuzzy matching, file or rich-text answers.
- Attempts load with the workspace snapshot, like other community records, within its existing bounds (5,000 rows per table). A community with many thousands of attempts will need a paginated review queue and archive.
- No export of a learner's attempts, and no operator procedure yet for erasing a learner's answers on request. Attempts are retained as feedback history.
- Notifications for reviewers are in-app only; the email outbox is not used for knowledge checks.
- Not deployed. Real Neon, Vercel and hosted sessions have not exercised this slice.
