# Decision 048: lessons lead with their video

Status: built in Alpha 48. Date: 5 October 2026.

## Problem

On 5 October 2026 the owner said lessons had no space for video and asked whether the learning section was as good as it should be. An uploaded lesson video (Alpha 37, decision 037) appeared only as a row in the lesson's file list, and an embedded YouTube or Vimeo video sat inline at text width, inside a lesson column beside a 270px path panel. Tracks without a cover still reserved a large empty panel at the top, practice prompts read as ordinary paragraphs, and the "Join this track" footer did not say what joining gives.

## Decision

- **A video stage.** `featuredVideo` picks the lesson's first uploaded video file, otherwise its first embedded video, and `LessonStage` shows it full width at 16:9 above the lesson title. An uploaded file shows a poster with a Play button and fetches its signed address only when pressed, through the same `playResource` path as before; an embed still asks for consent before loading anything from the provider. The featured video is not repeated in the body or the file list.
- **Room to read.** On wide screens the path panel narrows to 240px; below 1081px the lesson comes first and the path follows. A track with no cover hides its empty cover panel. Lesson text is larger with more line height.
- **Practice prompts.** A paragraph opening with "Try this" or "Your task" renders as a small labelled panel, in plain and rich lessons alike. Nothing changes in stored content.
- **Joining.** The footer says that joining lets the learner mark lessons complete and keep their place.
- **Demo.** The first storytelling lesson embeds the Blender Foundation's open film *Big Buck Bunny* (CC BY 3.0) through youtube-nocookie, loaded only after consent. No real person's data is involved.

No migration and no API change. Monochrome stays: the stage is black, the Play button uses the existing primary button.

## Not done

Chapters, captions upload, playback position and video transcoding are not built. Uploaded video stays off on staging (`LESSON_VIDEO_MAX_MB` unset) until the scan host exists.
