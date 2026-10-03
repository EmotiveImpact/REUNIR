# Cover images: uploaded pictures and a plain panel, 3 October 2026

Targeted review for replacing the decorative track and project art with covers that communities upload themselves. The same pinned shallow clones of Frappe Learning, LearnHouse and ClassroomIO were read through the session's anonymous Git proxy, together with the axe-core release REUNIR installs and the W3C WCAG source. This is a behavioural review of specific files, not a whole-repository audit or a legal opinion. The three learning projects are AGPL-3.0 at their roots, so no upstream source was copied. Exact blobs are in `reuse-register.json`.

| Project | Commit | Files and ranges read |
| --- | --- | --- |
| Frappe Learning | `071266699d3ed984eeff7f3e3658d259fd946a97` | `frontend/src/components/CourseCard.vue`: complete file, 186 lines (image or generated fallback, card body, gradient helper) |
| LearnHouse | `5e28b0723176b34ba8777b9980db352268aa8234` | `apps/web/components/Objects/Thumbnails/CourseThumbnail.tsx`: thumbnail source and placeholder (lines 151–153), image area and status badges (186–216), title and description below the image (218–232) |
| ClassroomIO | `72791608774f6fb65fbc33ddbb1d52d8a2a11045` | `packages/ui/src/custom/course-card/course-card.svelte`: complete file, 185 lines (banner image, default banner, badges on the banner, title below) |
| axe-core | `1cc54b900413660610180d631feb73c9e74f4dc9` (tag v4.13.0, the installed version) | `lib/commons/color/get-own-background-color.js` (24 lines), `lib/commons/color/get-background-stack.js` (107 lines), `lib/commons/dom/get-rect-stack.js` (48 lines) |
| W3C WCAG | `30720782e8d4c065d7a99adf28e7e3199167962c` | `techniques/failures/F83.html` (31 lines); `understanding/20/contrast-minimum.html` (317 lines, the incidental text and logotype passages) |

## What each source taught

**Frappe Learning.** A course card shows its uploaded image as a background. Without one it generates art: a dark gradient towards a chosen colour, with the course title in large white type on top. The comment beside the gradient says the card art stays dark in both themes, which is how the generated title keeps its contrast. Everything else (lesson count, instructors, price, certificate) sits in the card body below the art.

**LearnHouse.** The card's image area holds only the picture, from the course thumbnail or a single stock placeholder. The course name and description are ordinary text below the image. Status badges that do sit on the image are small opaque pills. The image is decorative (`alt=""`) where it repeats the title.

**ClassroomIO.** The card uses the uploaded banner or a default banner, and its title is again below the picture. Type and visibility badges are positioned on the banner as opaque `Badge` components.

**axe-core 4.13.** The contrast rule decides an element's background from the element stack at the centre point of the text's bounding box. Each layer contributes only `background-color` multiplied by opacity: borders, box shadows, images and blend modes are not measured. Text over a picture is therefore reported for manual review rather than passed or failed, and translucent decorative shapes can make the automated result differ from what a reader sees.

**WCAG.** Failure F83 applies to text over background images: the text must meet the contrast requirement against the parts of the image most like it, letter by letter if the quick check fails. Pure decoration and logotypes are exempt, but a course or project title is neither.

## How REUNIR adapts this

- **No words on the picture.** Titles, categories, people and status stay in the card body or page heading, as LearnHouse and ClassroomIO do. Only the existing small status pills and the feed's "work in progress" label sit on a cover, on opaque dark grounds. This removes the class of contrast failure F83 describes instead of measuring around it, and stops relying on an automated rule that cannot see the picture.
- **A plain panel, not generated art.** Without an upload, the cover is a neutral panel with one muted icon (a book for tracks, layers for projects). Frappe's generated title art and REUNIR's earlier decorative shapes are both retired. The product owner rejected the decorative shapes, and the monochrome direction keeps colour for people's own pictures.
- **People choose the picture and what stays in view.** Administrators set track covers; a project's owner or an administrator sets its cover. A focal point (two percentages) becomes the CSS object position, so every card size keeps the chosen part of the picture visible. Natural colours are kept; nothing is greyscaled.
- **Uploads follow the existing private file pipeline.** The server records an upload intent bound to exactly one track or project before minting a five-minute signed POST policy for an exact size and type. The browser posts directly to storage without cookies. Completion checks size, type, generation, file signature and the dimensions in the header (16 to 4,096 pixels) on the pinned generation. Rejected objects are deleted.
- **The browser resizes before upload.** Pictures are decoded and redrawn at most 1,600 pixels on the longest side, which also drops metadata such as location. PNG stays PNG when it fits, so transparent logos keep their transparency; everything else becomes JPEG.
- **Access mirrors the record.** Cover bytes come from a same-origin route that checks the tenant, space access and publication of the track or project that displays the cover, with private caching, `nosniff` and a sandboxing content security policy. Restrictive row security limits members to cover uploads that a visible published track or project displays.

## Deliberately not adopted

No generated or stock artwork, no colour gradients, no title text on covers, no hover zoom, no remote image URLs, no in-browser cropping beyond the focal point, no image transformations on the server and no public CDN links. Each can be reconsidered with real community needs.
