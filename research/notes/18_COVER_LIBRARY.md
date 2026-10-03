# Cover library: choosing a community picture as well as uploading one, 3 October 2026

Targeted review for letting people pick a cover from a small set their community supplies, alongside uploading their own (Alpha 11). The product owner asked for both. The same pinned shallow clones of Frappe Learning, ClassroomIO and LearnHouse were read through the session's anonymous Git proxy. This is a behavioural review of specific files, not a whole-repository audit or a legal opinion. The three projects are AGPL-3.0 at their roots, so no upstream source was copied. Exact blobs are in `reuse-register.json`.

| Project | Commit | Files and ranges read |
| --- | --- | --- |
| Frappe Learning | `071266699d3ed984eeff7f3e3658d259fd946a97` | `frontend/src/components/Modals/EditCoverImage.vue`: complete file, 147 lines (search box, upload button, image grid, empty state, attribution); `lms/unsplash.py`: complete file, 44 lines (server-side requests with the site's access key) |
| ClassroomIO | `72791608774f6fb65fbc33ddbb1d52d8a2a11045` | `packages/ui/src/custom/editor/ui/components/image-upload-modal.svelte`: tabs and state (lines 1–48), search (88–97), the upload, Unsplash and link panels (110–219); `apps/api/src/routes/unsplash/unsplash.ts`: complete file, 42 lines; `apps/dashboard/src/lib/features/ui/upload-widget/upload-widget.svelte`: complete file, 52 lines |
| LearnHouse | `5e28b0723176b34ba8777b9980db352268aa8234` | `apps/web/components/Dashboard/Pages/Course/EditCourseGeneral/ThumbnailUpdate.tsx`: size limits (lines 15–16), image and video tabs (27–47), upload checks (74–85), panels (249–346); `apps/web/components/Dashboard/Library/ResourcePicker.tsx`: resource kinds and endpoints (lines 1–60) |

## What each source taught

**Frappe Learning.** The cover editor is one popover with a keyword search over Unsplash and an **Upload Image** button side by side. Choosing a search result saves the photo's remote address as the cover. The search needs an Unsplash access key in site settings; most sites never set one, so the grid is empty by default, and a comment and a dedicated test explain that the picker now says so instead of showing a blank box. Every option has the same alternative text ("Cover image option"), and results carry a "powered by Unsplash" line.

**ClassroomIO.** The image dialogue has tabs: **Upload** (with a cropper at the cover's aspect ratio), **Unsplash** (search results with each photographer credited) and **Link**. The Unsplash route on the API is marked as public and unauthenticated, and spends the server's key on every request. A chosen result is stored as the photo's remote address.

**LearnHouse.** An organisation has a shared media library with folders, uploads and per-folder access, and a picker that links library items into activities. The course thumbnail editor itself only uploads, with separate image and video tabs and an 8 MB image limit; it does not offer the media library.

## How REUNIR adapts this

- **Both choices in one dialogue.** As in Frappe Learning and ClassroomIO, the cover dialogue offers the two sources together: **Upload your own** or **Community library**. The choice appears only when the library holds a picture, so nobody meets an empty grid; Community settings says plainly when the library is empty.
- **The community supplies the set, not a stock service.** Owners and administrators upload library pictures through the same verified pipeline as covers (browser resize that drops location metadata, signed policy for the exact size and type, signature and dimension checks on the pinned generation). There is no third-party search, access key, attribution to maintain, remote address or unauthenticated route. The demo works the same way with no network.
- **Choosing does not copy.** A cover chosen from the library points at the library's verified file, with its own focal point. One picture can serve several tracks and projects.
- **Every option has a real name.** Each picture is listed with a short name its administrator gives it, and that name is the option's accessible name. Thumbnails are decorative. The options are native radio buttons, so arrow keys move between them.
- **Nothing silently disappears.** A picture cannot leave the library while any track or project shows it; Community settings says how many covers use it. Removing an unused picture deletes its stored file at once.
- **Visible to the community, private outside it.** Every active member can see library pictures (the library is how covers come to share a look), but other communities and visitors cannot. Unlisted library uploads stay with administrators and their uploader. Row security enforces the same rules.

## Deliberately not adopted

No stock photo search, no remote image addresses or link tab, no per-folder library access, no video thumbnails, no cropper beyond the focal point, no tagging or search inside the library, and no library pictures chosen by members who cannot already change a cover. The library holds up to 24 pictures for the alpha.
