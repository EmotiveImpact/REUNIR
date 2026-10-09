# Decision 057: chapters in lesson videos

Status: built in Alpha 57. Date: 9 October 2026.

## Problem

A long lesson video had no way in except scrubbing. Alpha 54 added captions and picking up where you stopped, but a learner coming back for one part still had to hunt for it.

## Decision

- An uploaded lesson video can carry up to 20 chapters: a start in whole seconds and a title of up to 80 characters. The first starts at 0:00 and each starts after the one before.
- Authors type them in the studio under the video, one a line, as `1:30 Setting up`. The field says what is wrong while a line cannot be read, and the draft cannot be saved until it can. Replacing the video with another kind of file drops its chapters.
- Chapters live on the video's entry in the lesson's files (`resources`), so no migration is needed. The domain refuses chapters on anything but an uploaded video (`CHAPTERS_NEED_VIDEO`), stores none when the list is empty, and the file list as a whole must stay inside the 16,000 bytes migration 0009 allows.
- Under the video, learners get a list of chapters. Choosing one before the video has loaded starts it there; choosing one while it plays jumps to it. The chapter playing is marked as current.

## Alternatives considered

- **A WebVTT chapters file**, like captions. Browsers do not show chapter tracks, so the list would still be ours to draw, and authors would have to write cue timings by hand.
- **Chapters on embedded videos.** Those play in their own provider's player, which has its own chapters.
- **A separate table or column.** More moving parts for a short list that always travels with its video.
