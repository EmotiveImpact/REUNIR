# Knowledge checks: quizzes, attempts, scoring and feedback, 2 October 2026

Targeted review for the assessment slice that follows private lesson resources. The same pinned shallow clones were read through the session's anonymous Git proxy. This is a behavioural review of specific files, not a whole-repository audit or a legal opinion. All three projects are AGPL-3.0 at their roots, so no upstream source was copied. Exact blobs are in `reuse-register.json`.

| Project | Commit | Files and ranges read |
| --- | --- | --- |
| Frappe Learning | `071266699d3ed984eeff7f3e3658d259fd946a97` | `lms/lms/doctype/lms_quiz/lms_quiz.py`: validation (lines 61–112), `submit_quiz` (165–245), `process_results` and `verify_answer` (539–618), progress after a quiz and `check_answer` (702–760) |
| LearnHouse | `5e28b0723176b34ba8777b9980db352268aa8234` | `apps/api/src/services/courses/activities/quiz_modes.py`: complete file, 118 lines (response and grading modes, per-question scoring) |
| ClassroomIO | `72791608774f6fb65fbc33ddbb1d52d8a2a11045` | `apps/api/src/services/submission/submission.ts`: grading states, transitions and overall status (lines 1–160), updates and batch grading (756–912); `apps/api/src/routes/course/submission.ts`: complete file, 94 lines |

## What each source taught

**Frappe Learning.** Scores are computed only on the server against the stored answer key; the client sends answers, never marks. A submitted answer naming a question outside the quiz is rejected rather than failing later. Multi-answer questions need the exact set: every correct option and no incorrect one. Score and percentage are calculated in one place so two paths cannot drift. Open-ended answers are sanitised and need a human grader, and a quiz that mixes open-ended and automatically marked questions is refused, which REUNIR does not copy. Live answer checking is refused unless the author enables it, because otherwise the endpoint is an answer oracle. Passing a quiz can mark lesson progress, and negative marking is available.

**LearnHouse.** Each question declares single or multiple response, and one module is the single place the mode is inferred. All-or-nothing is the default; optional partial credit subtracts wrong picks, so selecting everything scores nothing. A question whose key marks nothing correct scores zero. The client shows a preview grade, but the server stores the real one.

**ClassroomIO.** A submission's overall status follows from its question mix (automatic, manual or both), and grading moves through an explicit table of allowed transitions. The grading routes check course-team membership from the URL, while the grade-update service then loads the submission by its ID alone. Completing exercises can trigger certification.

## How REUNIR adapts this

- **The quiz lives in the lesson.** An optional knowledge check is part of the lesson content, so it follows the existing private draft, preview, explicit publication, capture and restore. There is no second authoring workflow.
- **Learners never receive the key.** Workspace responses strip correct options, accepted answers and explanations from lessons for everyone except active owners and administrators. Live answer checking does not exist.
- **Server-side, deterministic scoring.** Single choice, multiple choice (all-or-nothing, exact set), short answer (exact match after Unicode, whitespace and case normalisation) and written responses (marked by a reviewer). A check may mix automatic and written questions; the attempt then waits for review.
- **Stale answers are refused, not scored.** Each submission carries a fingerprint of everything the learner saw (settings, questions and options, never answers). If the author published a change meanwhile, the server refuses the attempt and the learner answers the current version. Answers must also cover exactly the published questions and options.
- **Attempts are immutable evidence.** Each attempt stores a snapshot of the quiz it was scored against. After submission only the review fields can change, enforced by column-level grants and row policies as well as the domain. Attempts cannot be deleted by the application role.
- **Explicit states, one review.** `scored` (no written questions), `awaiting_review` (written questions) and `reviewed`. Review happens once, by an active owner or administrator who is not the learner, marks every written answer and includes feedback. Feedback can also be added to an automatically scored attempt. A learner with an attempt awaiting review cannot start another until it is reviewed. Unlike ClassroomIO's update service, the review loads the attempt inside the tenant and rechecks lesson visibility.
- **Feedback, not credentials.** Scores are private to the learner and the community's reviewers. They award no reputation points, do not complete the lesson and certify nothing. This keeps the product doctrine: community review is not accreditation.
- **Answer reveal protects retakes.** Correct answers and explanations appear only if the author allows it, the attempt is final, and the learner has passed, used every attempt, or the check has no pass mark to reach.
- **Bounded.** Up to 15 questions of up to 6 options, 16 KB of quiz JSON, attempt limits of 1 to 10 or unlimited (capped at 50 records per learner and lesson), 2,000 characters per written answer and 32 KB of answers per attempt.

## Deliberately not adopted

No proctoring or violation logs, no timed or scheduled quizzes, no question banks shared across lessons, no randomised subsets, no partial credit, no negative marking, no fuzzy text matching, no file or rich-text answers, no live answer checking, and no automatic completion or certification. Each can be reconsidered with real community needs.
