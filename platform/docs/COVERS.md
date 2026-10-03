# Cover images for tracks and projects

Version 0.11.0-alpha.1. Built on merged Alpha 10 knowledge checks (`365e1c9`), retaining UI_DESIGN_DIRECTION.md, the upload-intent API and the Google Cloud Storage adapter used by lesson files. The upstream review is in `research/notes/16_COVER_IMAGES.md`, and the decision in `decisions/011-cover-images.md`.

## What people see and do

Every track and project card, detail page, profile list, home list and project post shows either a picture chosen by the community or a plain neutral panel with one muted icon (a book for tracks, layers for projects). Nothing is written on the picture: titles, categories, people and descriptions stay below it or beside it. The only labels over a picture are the existing small status pills and the feed's "work in progress" bar, both on opaque dark grounds.

Owners and administrators see **Add a cover** (or **Change cover**) beside Creator studio on a track page. On a project page the project's own owner and community owners and administrators see it in the heading. The dialogue lets them:

- choose an image, or drop one on the picture area;
- set the focal point by clicking or dragging on the picture, or with the labelled **Left to right** and **Top to bottom** sliders, which work from the keyboard;
- preview the banner, card and small crops before saving;
- save, cancel or remove the cover.

The browser decodes the image and redraws it at most 1,600 pixels on the longest side before anything is sent. Redrawing drops metadata such as camera details and location. A PNG stays PNG when the result fits, so transparent logos keep their transparency; anything else is saved as JPEG, with transparent areas on the panel grey. An image under 800 pixels on its longest side is accepted with a note that it may look soft on large screens. Files the browser cannot read are refused in the dialogue and nothing is uploaded.

The focal point is stored as two whole percentages. Every surface uses them as the CSS object position, so a wide banner and a small square thumbnail both keep the chosen part of the picture in view. Original colours are kept; the interface never greyscales a picture.

## Access rules

| Who | Change a track cover | Change a project cover | See a cover |
| --- | --- | --- | --- |
| Active owner or administrator | Yes | Yes | Wherever they can see the track or project |
| Active member who owns the project | No | Their own project | Wherever they can see the track or project |
| Other active members and moderators | No | No | Published tracks and projects in spaces they can open |
| Suspended or removed member | No | No | No |
| Another community, anonymous visitor | No | No | No |

One domain rule (`visibleSubject` with `resolveCoverImage`) decides every read: the track or project must be visible to the reader (tenant, space access and, for tracks, publication unless the reader administers the community), the requested file must be its current cover, and the upload must be verified with a recorded generation. Clients send only a subject kind, a subject ID and a file ID; they never see storage keys or bucket names.

PostgreSQL enforces the same boundary in depth. A restrictive `cover_image_read` policy on `upload_intents` lets a member's transaction read a cover upload only when a published track or a project in the same tenant displays it, or when they uploaded it and are still active. Owners and administrators can read the community's cover uploads. Database checks keep each cover upload bound to exactly one track or project, require a generation once it is ready and cap it at 3 MB.

## Upload and display lifecycle (live mode)

1. `POST /api/organisations/:slug/uploads` with `{purpose:'cover_image', subject:'track'|'project', subjectId, contentType, sizeBytes}`. The domain checks the editor and subject, prunes the community's cover uploads that nothing displays and that were rejected or started over an hour ago, applies caps (3 pending per person, 400 cover uploads per community) and records a pending intent. Only then does the server mint a five-minute signed POST policy for the exact key, type and size. The key is `organisations/{organisation}/covers/{tracks|projects}/{id}/{uuid}.{ext}`.
2. The browser posts the resized image straight to the bucket with `FormData`, without application cookies.
3. `POST .../uploads/:id/complete`. The server checks the stored size, type and generation, then reads the first 64 KB pinned to that generation. The file signature must match and the header must declare 16 to 4,096 pixels on each side. A refused image is deleted and nothing changes.
4. `POST .../commands` with `{type:'track.cover.set', trackId, fileId, focusX, focusY}` or the `project.cover.set` equivalent. The stored type and size are copied from the verified upload. Sending only new focus values with the same file moves the focal point; `fileId: null` removes the cover.
5. `GET /api/organisations/:slug/covers/:kind/:subjectId/:fileId` returns the bytes from the pinned generation with `Cache-Control: private, max-age=3600`, the stored content type, `Content-Disposition: inline`, `X-Content-Type-Options: nosniff` and `Content-Security-Policy: default-src 'none'; sandbox`. It answers 401 to anonymous visitors, 404 when the reader cannot see the record, the file is not its current cover or the stored object changed, and 503 when private storage is not configured.

`GET /api/account/capabilities` reports `coverUploads`. Without storage the dialogue says so, still allows moving the focal point and removing a cover, and does not offer new uploads.

## Retention and limits

- A removed or replaced picture stops being served at once. Its stored object is deleted the next time anyone in the community starts a cover upload, once it is more than an hour old. If no one uploads again, it stays in private storage until an operator removes it; an erasure procedure is still open work.
- A browser that has already loaded a cover may keep showing it from its private cache for up to an hour after access ends. New requests are refused straight away.
- One 1,600-pixel file is served at every size, including small thumbnails. Covers are typically a few hundred kilobytes and at most 3 MB; smaller renditions are a follow-up.
- Covers are decorative (`alt=""`), because every title is real text nearby. There is no alt text field.

## Demo mode

The fictional demo starts with no covers, so every card shows the plain panel. Uploading in the demo runs the same domain rules in the browser and keeps the bytes in this browser only (IndexedDB, or memory when the browser blocks storage). Resetting the demo clears them. Nothing is sent anywhere.

## Running it

Apply migration 0011 with `npm run db:migrate`, then `npm run db:grant-runtime`. Private storage needs the bucket configuration from SETUP.md section 6, as lesson files do; bucket CORS must allow POST from the application origin.

Checks: `tests/covers.test.ts` (domain), `tests/covers-database.test.ts` (0011 upgrade, runtime role, forced RLS, constraints and grants), `tests/covers-http.test.ts` (API), `npm run test:browser:covers` (demo journey), `npm run test:browser:covers-connected` (live build, Better Auth sessions, PGlite and a stand-in bucket), the restricted-role cover check in `npm run test:postgres`, and the monochrome suite's plain-panel check.
