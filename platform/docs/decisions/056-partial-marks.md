# Decision 056: partial marks on multiple-choice questions

Status: built in Alpha 56. Date: 9 October 2026.

## Problem

A multiple-choice question scored all or nothing: a learner who found two of three right options earned the same zero as one who chose nothing right. Written answers already take any mark from zero to the question's points from a reviewer, so multiple choice was the one place without partial marks.

## Decision

- An author can turn on **Partial marks** for a multiple-choice question in the studio. It is off by default, and only multiple choice may carry it; the schema refuses it elsewhere.
- Marking: right options chosen minus wrong options chosen, as a share of the right options, times the question's points, rounded down to whole points and never below zero. With three right options worth 6 points, two right earns 4, two right and one wrong earns 2, and ticking every option earns 2, so guessing everything is no shortcut.
- The exact set still scores full marks and counts as correct; a partial score shows as "Partly right · 2 of 6 points".
- Learners see "partial marks" beside the question's points, so the rule is part of what they answer. It is therefore part of the check's fingerprint, but only when on, so every check published before Alpha 56 keeps its fingerprint and no open attempt goes stale.
- The stored attempt keeps the quiz it was marked by, including the rule. No migration: quizzes are JSON already.

## Alternatives considered

- **Per-option points.** More flexible, but every option would need a number and authors would have to keep totals straight.
- **Fractional points.** Scores, pass marks and the review queue all use whole points; rounding down keeps a partial score from ever rounding up into a pass.
- **Question banks and timers** stay parked until pilots ask for them.
