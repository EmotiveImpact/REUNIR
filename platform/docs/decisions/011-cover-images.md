# Decision 011: communities upload their own covers, and nothing is written on a picture

Status: implemented in Alpha 11, verified locally; not deployed. Date: 3 October 2026.

## Problem

Tracks and projects showed generated cover art: translucent shapes on grey with a label, a large title and a footer line written over them. Small text crossed the shapes on narrow covers and failed contrast (Alpha 10 follow-up), and the product owner rejected the look outright. Communities need to show their own pictures, chosen by the people responsible for each track or project, without weakening privacy, tenant isolation or the monochrome interface contract.

## Decision

- Replace every piece of decorative art with either an uploaded picture or a plain neutral panel with one muted icon. Retire the shapes, labels, art variants and the `.art-custom` contrast patch.
- Keep all text off pictures. Titles and details stay in the card body or page heading; only opaque status labels may sit on a picture. This removes the failure WCAG F83 describes instead of measuring around it, and no longer depends on an automated contrast rule that cannot see images.
- Let administrators set track covers, and a project's owner or an administrator set its cover, matching who already edits those records.
- Reuse the private file pipeline: a server-recorded intent bound to exactly one track or project, a short signed POST for an exact size and type, verification of signature and declared dimensions on the pinned generation, and deletion of refused objects.
- Resize in the browser to 1,600 pixels before upload, which also drops metadata such as location. Keep PNG for transparency when it fits; otherwise JPEG.
- Store a focal point and use it as the object position on every surface.
- Serve bytes through one same-origin route whose access rule mirrors the record that displays the cover, with private caching, `nosniff` and a sandboxing content security policy, and add a restrictive row policy so the database applies the same boundary.

## Alternatives considered

- **Fix the contrast of the existing art.** Done first on this branch, then rejected with the art itself: the owner disliked the shapes, and every new art style would need the same per-letter contrast work.
- **Generated covers with the title on a dark gradient, as Frappe Learning does.** Keeps contrast by forcing dark art, but repeats the title, adds colour gradients the monochrome contract forbids, and is still decoration chosen by the software rather than the community.
- **Short-lived signed download links, as lesson files use.** Covers appear on many cards at once and change rarely; a same-origin route with private caching avoids a signing round trip per card and keeps bucket URLs out of the page.
- **Server-side resizing and thumbnails.** Needs image decoding on the server, a larger attack surface and new dependencies. Browser resizing bounds the stored file instead; smaller renditions can follow if real usage needs them.
- **Free cropping with stored crop boxes.** One focal point serves every aspect ratio the layout uses; a fixed crop would suit one ratio and fail others.
- **Remote image URLs.** Would leak readers' addresses to third parties and bypass verification. Rejected.
- **Copying donor code.** The learning projects reviewed are AGPL at their roots. Their behaviour informed the design; no file was copied.

## Consequences

People see their community's own pictures, or a calm panel, and no text depends on what a picture contains. The editor is keyboard operable, and the new demo and connected checks scan it with axe. The knowledge-check connected scan now covers the whole page, because the art that forced it to scope down is gone. Removed pictures stop being served immediately but are deleted only by later pruning, an operator erasure procedure is still open, and one 1,600-pixel file is served at every size. These limits are recorded in COVERS.md and BUILD_STATUS.md rather than implied away.
