# Decision 037: uploaded lesson video

Status: implemented in Alpha 37, verified locally; not deployed. Date: 3 October 2026.

## Problem

Lessons could embed video from YouTube or Vimeo, but a community that recorded its own teaching had nowhere private to put it. Lesson files were limited to documents and pictures of up to 10 MB, always downloaded.

## Decision

- **Video is a lesson file.** MP4 and WebM join the lesson file types, attached in the creator studio like any other file, kept private in the same bucket under the track, verified by signature and released only through a lesson, draft or revision the person may open.
- **Off until the operator switches it on.** `LESSON_VIDEO_MAX_MB` sets the largest video, from 1 to 500 MB. Unset or 0 keeps video off, so storage sized for documents never receives video it was not planned for. Capabilities report the limit, and the studio names it. The demo shows the 500 MB maximum with bytes kept in the browser.
- **Plays in the page.** Learners and authors choose **Play**; the server checks access exactly as for a download and returns a signed link with `inline` disposition and the recorded type, valid for two hours so a long lesson can be watched. Downloads stay two-minute attachments.
- **The database keeps the bound.** Additive migration 0036 replaces the 0001 size check on `upload_intents`: lesson files declared as MP4 or WebM may be up to 500 MB, everything else stays at 10 MB. Earlier migrations are byte-identical; no grant change.
- **Scanning.** Video goes through upload scanning (Alpha 23) like every lesson file: the API reads the stored file whole at the recorded generation and streams it to clamd. clamd refuses streams over its `StreamMaxLength` (25 MB by default), and a refusal is treated as no verdict, so the upload stays pending rather than being accepted unscanned. The launch preflight warns when video above 25 MB is switched on with a scanner: raise `StreamMaxLength` to the video limit and give the API memory for a file that size. Scanning in chunks without holding the file is follow-up work.

## Not decided here

Transcoding, adaptive streaming, captions and transcripts, poster frames, and video in posts or projects.
