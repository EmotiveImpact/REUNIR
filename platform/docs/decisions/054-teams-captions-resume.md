# Decision 054: leaving a project team, lesson captions and picking up a video

Status: built in Alpha 54. Date: 9 October 2026.

## Problem

- Nobody could leave a project team, and a project's lead could not remove anyone. A team membership row is named by contributions (0002), task assignments (0006) and credits (0033), so it could not simply be deleted.
- A lesson video had no captions, which shuts out deaf and hard-of-hearing learners and anyone watching without sound.
- A long lesson video always started from the beginning.

## Decision

**Project teams.** Migration 0048 adds `left_at` and `removed_by` to `project_members`. A membership that ends keeps its row. New commands:

- `project.leave`: anyone on the team except its lead. Tasks they claimed without proof go back to the team, unassigned and ready to start; tasks with proof keep their name. The lead is told.
- `project.member.remove`: the lead or an administrator, never the lead themselves. The same release, and the person is told their recognised work stays credited to them.
- `project.member.restore`: the lead or an administrator lets a removed person back.
- `project.join` resumes a membership someone left by choice, and refuses someone who was removed until they are let back.

Every rule that asked "is this person on the team" now asks `onTeam`, which ignores ended memberships. A person's view drops ended memberships, except that a project's lead and administrators see whom they removed. Row security on `project_tasks` and `task_notes` is recreated to admit only a current team member. The runtime role may update only `left_at` and `removed_by`. When someone leaves, their membership is written last in the transaction, so row security still admits them while their tasks are released under their own name.

**Captions.** A lesson may carry WebVTT files (`text/vtt`, up to 512 KB, recognised by the `WEBVTT` line, scanned like every file). When the lesson leads with an uploaded video, each captions file becomes a captions track on it. The text comes through `GET …/resources/:resourceId/captions`, checked exactly as a download, because the video plays from storage on another origin and a track loaded from there would need that origin's permission.

**Picking up a video.** The lesson stage remembers the last whole second watched in this browser's local storage, picks up from there when the video opens again, says so with a "Start from the beginning" button, and forgets the place when the video ends. Nothing is sent to the server. Storage that is refused or missing means starting at the beginning.

## Alternatives considered

- **Deleting the membership row.** Blocked by the foreign keys, and it would lose who did the work.
- **Captions through signed storage links.** Needs a cross-origin rule on the bucket, which is configuration outside this repository.
- **Keeping the video position on the server.** It would follow a learner between devices, but it is a record of viewing behaviour that nobody asked to keep. A browser-local place does the job without it.

## Consequences

The confirmation for leaving and removal is asked in place, not with the browser's own dialogue. Captions and resume do not apply to embedded YouTube or Vimeo videos, whose players have their own. Lesson positions do not follow a learner to another device.
