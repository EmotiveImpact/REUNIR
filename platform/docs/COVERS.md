# Cover images for tracks and projects

Version 0.13.0-alpha.1. Uploaded covers arrived in Alpha 11 (built on merged Alpha 10 knowledge checks, `365e1c9`); Alpha 12 let track instructors change their own track's cover; Alpha 13 adds the community cover library. They retain UI_DESIGN_DIRECTION.md, the upload-intent API and the Google Cloud Storage adapter used by lesson files. The upstream reviews are in `research/notes/16_COVER_IMAGES.md` and `research/notes/18_COVER_LIBRARY.md`, and the decisions in `decisions/011-cover-images.md` and `decisions/013-cover-library.md`.

## What people see and do

Every track and project card, detail page, profile list, home list and project post shows either a picture chosen by the community or a plain neutral panel with one muted icon (a book for tracks, layers for projects). Nothing is written on the picture: titles, categories, people and descriptions stay below it or beside it. The only labels over a picture are the existing small status pills and the feed's "work in progress" bar, both on opaque dark grounds.

Owners, administrators and the track's instructors see **Add a cover** (or **Change cover**) beside Creator studio on a track page. On a project page the project's own owner and community owners and administrators see it in the heading. The dialogue lets them:

- upload their own image, or drop one on the picture area;
- or, when the community has a cover library, choose **Community library** and pick one of its pictures by name;
- set the focal point by clicking or dragging on the picture, or with the labelled **Left to right** and **Top to bottom** sliders, which work from the keyboard;
- preview the banner, card and small crops before saving;
- save, cancel or remove the cover.

The browser decodes the image and redraws it at most 1,600 pixels on the longest side before anything is sent. Redrawing drops metadata such as camera details and location. A PNG stays PNG when the result fits, so transparent logos keep their transparency; anything else is saved as JPEG, with transparent areas on the panel grey. An image under 800 pixels on its longest side is accepted with a note that it may look soft on large screens. Files the browser cannot read are refused in the dialogue and nothing is uploaded.

## The community library

Owners and administrators keep a small set of pictures under **Community settings → Cover library**: up to 24, each with a short name such as "Harbour at dawn". **Add a picture** opens a dialogue that prepares the image in the browser exactly as a cover upload does, then asks for the name. The list shows each picture, its name and how many tracks or projects use it.

Anyone who may change a cover can choose a library picture instead of uploading one. Choosing does not copy the picture: the cover points at the library's file and keeps its own focal point, so one picture can serve several tracks and projects. The pictures are native radio buttons named after their pictures, so arrow keys move between them and screen readers announce each name; the thumbnails are decorative. The choice appears only when the library holds a picture.

A picture cannot be removed while any track or project shows it. Community settings says how many do, and the server refuses with "This picture is the cover of 2 tracks or projects. Choose other covers for them first." Removing an unused picture deletes its record, its upload and its stored file at once. There is no renaming; remove a picture and add it again under a new name.

The focal point is stored as two whole percentages. Every surface uses them as the CSS object position, so a wide banner and a small square thumbnail both keep the chosen part of the picture in view. Original colours are kept; the interface never greyscales a picture.

## Access rules

| Who | Change a track cover | Change a project cover | See a cover | Add or remove library pictures | See library pictures |
| --- | --- | --- | --- | --- | --- |
| Active owner or administrator | Yes | Yes | Wherever they can see the track or project | Yes | Yes, and unlisted uploads |
| Active instructor of the track | That track | No | As members do | No | Yes |
| Active member who owns the project | No | Their own project | Wherever they can see the track or project | No | Yes |
| Other active members and moderators | No | No | Published tracks and projects in spaces they can open | No | Yes |
| Suspended or removed member | No | No | No | No | No |
| Another community, anonymous visitor | No | No | No | No | No |

Choosing a library picture needs only the right to change that cover.

One domain rule (`visibleSubject` with `resolveCoverImage`) decides every read: the track or project must be visible to the reader (tenant, space access and, for tracks, publication unless the reader administers the community), the requested file must be its current cover, and the upload must be verified with a recorded generation. Clients send only a subject kind, a subject ID and a file ID; they never see storage keys or bucket names.

Library pictures have one gate too (`resolveLibraryPicture`): an active member of the community, a picture in that community's library, and a verified upload with a recorded generation. A cover that shows a library picture is read through the cover route, so it follows its track or project like any cover.

PostgreSQL enforces the same boundary in depth. A restrictive `cover_image_read` policy on `upload_intents` lets a member's transaction read a cover upload only when a published track or a project in the same tenant displays it, or when they uploaded it and are still active. Owners and administrators can read the community's cover uploads. Database checks keep each cover upload bound to exactly one track or project, require a generation once it is ready and cap it at 3 MB. Migration 0013 adds the `cover_library` table with forced RLS: every member of the community reads it; only an active owner or administrator inserts a row, in their own name, or deletes one; the runtime role has no UPDATE. A restrictive `cover_library_read` policy on `upload_intents` keeps a library upload with its active uploader and active owners and administrators until it is listed. Library uploads name no track or project, need a generation once ready, are capped at 3 MB, and are listed at most once.

## Upload and display lifecycle (live mode)

1. `POST /api/organisations/:slug/uploads` with `{purpose:'cover_image', subject:'track'|'project', subjectId, contentType, sizeBytes}`. The domain checks the editor and subject, prunes the community's cover uploads that nothing displays and that were rejected or started over an hour ago, applies caps (3 pending per person, 400 cover uploads per community) and records a pending intent. Only then does the server mint a five-minute signed POST policy for the exact key, type and size. The key is `organisations/{organisation}/covers/{tracks|projects}/{id}/{uuid}.{ext}`.
2. The browser posts the resized image straight to the bucket with `FormData`, without application cookies.
3. `POST .../uploads/:id/complete`. The server checks the stored size, type and generation, then reads the first 64 KB pinned to that generation. The file signature must match and the header must declare 16 to 4,096 pixels on each side. A refused image is deleted and nothing changes.
4. `POST .../commands` with `{type:'track.cover.set', trackId, fileId, focusX, focusY}` or the `project.cover.set` equivalent. The stored type and size are copied from the verified upload. Sending only new focus values with the same file moves the focal point; `fileId: null` removes the cover.
5. `GET /api/organisations/:slug/covers/:kind/:subjectId/:fileId` returns the bytes from the pinned generation with `Cache-Control: private, max-age=3600`, the stored content type, `Content-Disposition: inline`, `X-Content-Type-Options: nosniff` and `Content-Security-Policy: default-src 'none'; sandbox`. It answers 401 to anonymous visitors, 404 when the reader cannot see the record, the file is not its current cover or the stored object changed, and 503 when private storage is not configured.

Library pictures follow the same steps with three differences:

1. `POST /api/organisations/:slug/uploads` with `{purpose:'cover_library', contentType, sizeBytes}`. Only active owners and administrators may start one. Unlisted library uploads that were rejected or started over an hour ago are pruned; listed pictures never are. The key is `organisations/{organisation}/covers/library/{uuid}.{ext}`. Completion is the same as for a cover.
2. `POST .../commands` with `{type:'cover.library.add', fileId, label}` lists the verified picture under its name. The stored type and size come from the upload; adding the same file twice changes nothing.
3. `GET /api/organisations/:slug/cover-library/:itemId` returns the bytes with the same headers as a cover. A library entry never changes its picture, so its ID is as stable as a file ID for caching. `POST /api/organisations/:slug/cover-library/:itemId/remove` removes an unused picture and deletes the stored object; it answers 409 `COVER_IN_USE` while any cover shows it.

`GET /api/account/capabilities` reports `coverUploads`. Without storage the dialogue says so, still allows moving the focal point and removing a cover, and does not offer new uploads.

## Retention and limits

- Removing an unused library picture deletes its stored file straight away. Library uploads that were never listed are deleted at the next library upload once they are an hour old.
- A removed or replaced picture stops being served at once. Since Alpha 17 its upload record goes in the same change and its stored object is deleted straight after that change commits, when nothing else shows it (a library picture stays in the library). Moving the focal point keeps the picture. Uploads that were started but never chosen, or were rejected, are still deleted the next time anyone starts a cover upload once they are more than an hour old, or by an operator with `npm run db:prune-covers` (LEARNER_RECORDS.md), which an active owner authorises. If storage refuses the deletion, the object is private and unreferenced, never served, and the operator command lists it.
- A browser that has already loaded a cover may keep showing it from its private cache for up to an hour after access ends. New requests are refused straight away.
- One 1,600-pixel file is served at every size, including small thumbnails. Covers are typically a few hundred kilobytes and at most 3 MB; smaller renditions are a follow-up.
- Covers on cards and lists are decorative (`alt=""`), because every title is real text nearby. Since Alpha 22 whoever edits a cover may add a short description (up to 150 characters, plain text on one line). It is read aloud on the track's or project's own page, where the picture is shown large; left empty, the picture stays decorative there too. Moving the focal point keeps the description; choosing a new picture starts without one (decision 022).

## Demo mode

The fictional demo starts with no covers, so every card shows the plain panel, and with one library picture, **Mountain ridge**: the landscape photograph already bundled with the demo, cropped so its caption does not show. No bytes are stored for it. Uploading in the demo runs the same domain rules in the browser and keeps the bytes in this browser only (IndexedDB, or memory when the browser blocks storage). Resetting the demo clears them. Nothing is sent anywhere.

## Running it

Apply migrations 0011 and 0013 with `npm run db:migrate`, then `npm run db:grant-runtime`. Private storage needs the bucket configuration from SETUP.md section 6, as lesson files do; bucket CORS must allow POST from the application origin.

Checks: `tests/covers.test.ts` and `tests/cover-library.test.ts` (domain), `tests/covers-database.test.ts` and `tests/cover-library-database.test.ts` (0011 and 0013 upgrades, runtime role, forced RLS, constraints and grants), `tests/covers-http.test.ts` and `tests/cover-library-http.test.ts` (API), `npm run test:browser:covers` (demo journey, including the library in Community settings, choosing by pointer and keyboard, removal and the instructor's choice), `npm run test:browser:covers-connected` (live build, Better Auth sessions, PGlite with the API under the restricted runtime role and a stand-in bucket), the restricted-role cover and library checks in `npm run test:postgres`, and the monochrome suite's plain-panel and settings checks.
