# Decision 039: managing the cover library, and smaller copies of covers for cards

Status: implemented in Alpha 39 (first opened as Alpha 23), verified locally; not released or deployed. Date: 3 October 2026.

## Problem

Three limits from decisions 011 and 013 remained. The library held at most 24 pictures, and a picture could not be renamed: an owner had to remove it and add it again, which is impossible while any cover shows it. With more pictures there was nothing to help someone find the right one. And one 1,600-pixel file was served everywhere, so a page of small cards downloaded several full pictures to show thumbnails a few hundred pixels wide.

## Decision

- **Rename and tag library pictures.** Active owners and administrators may change a picture's name and give it up to five tags. A tag is lower case, at most 24 characters, letters and numbers with single spaces or hyphens between words. Tags are trimmed, lower-cased and deduplicated; too many or too long tags are refused, never silently cut. The picture itself, its file and every cover that shows it are untouched. Each change is audited as `cover.library.updated`.
- **A dedicated route, under the two-step rule.** `POST /api/organisations/:slug/cover-library/:itemId/details` takes `{label, tags}`. Like removal, it exists only for owners and administrators, so it calls the same two-step check before anything else. Adding a picture may carry tags in the existing `cover.library.add` command.
- **Find pictures in the picker.** When the library has more than four pictures, or any tags, the cover dialogue offers **Find a picture** (every word must appear in the name or tags) and one toggle button per tag. Each radio button is named by the picture's name; its tags are its description.
- **Sixty pictures.** The limit rises from 24 to 60 and stays enforced by the rules on every library upload and every listing.
- **Small copies drawn in the browser (option a).** When the browser prepares a cover or library picture wider than 480 pixels, it also draws a copy 480 pixels wide from the same decoded image: WebP where the browser can write it, otherwise JPEG on the panel grey, at most 256 KB. The upload intent declares it; the server chooses its key beside the picture (`…/{id}-thumb.{ext}`), records it on the same upload record and signs a second five-minute policy for its exact key, type and size. On completion the server checks the copy as it checks the picture, pinned to its own generation: signature, declared size and type, at most 480 pixels wide, narrower than the picture, at least 16 pixels on each side, and the same shape to within one pixel of height. A copy that is missing or fails is deleted and dropped; the picture alone is kept. A refused picture takes its copy with it.
- **Cards ask for the small copy and fall back.** `…/covers/:kind/:id/:fileId/thumbnail` and `…/cover-library/:itemId/thumbnail` serve the copy when there is one and the picture otherwise, through the same access checks and headers. Cards, lists, settings rows and picker squares use them; a track's or project's own page, the cover dialogue and the feed's wide post picture load the full picture. Every cover stored before this change keeps working unchanged.
- **The database agrees.** Migration 0038 adds `tags` to `cover_library` with a shape check, an UPDATE policy for active owners and administrators of the same community, and runtime grants for UPDATE of `label` and `tags` only. It adds four small-copy columns to `upload_intents` with checks: covers and library pictures only, all or nothing, images only, at most 256 KB, a generation only once ready, and a ready upload that keeps a copy has one. Earlier migrations are unchanged.

## Alternatives considered

- **Serving the existing picture with longer caching (option b).** It needs no new storage objects, but every card still downloads up to 3 MB, which is the problem. Rejected because the signed upload flow could carry a second object cleanly.
- **Server-side resizing.** Needs an image decoder on the server, which means a native dependency and a larger attack surface. Rejected again, as in decision 011.
- **A separate upload record for each small copy.** It would need its own lifecycle, pruning and row policy. Tying the copy to the picture's record means every deletion path (replacement, pruning, library removal, the operator command) removes both files with no new rules.
- **Renaming through a workspace command.** Commands already apply the two-step rule through the role check. Removal is a dedicated owner and administrator route with an explicit two-step check, so renaming follows the same shape and both are guarded the same way.
- **Free-text keywords or a tag table.** A short list on the row is enough for 60 pictures and keeps the row policy simple.

## Consequences

Communities can keep a larger, findable library and correct a picture's name without disturbing covers. Lists download small copies instead of full pictures for new uploads; older covers and pictures still send the full file to cards until they are uploaded again, and nothing backfills copies for them. The copy is only as good as the browser's encoder, and the server checks its container and shape, not its content. Real Google Cloud Storage signing for the second policy, and the 0038 upgrade on hosted PostgreSQL, are not verified here.
