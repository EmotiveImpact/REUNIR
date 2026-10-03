# Decision 013: a community cover library alongside uploaded covers

Status: implemented in Alpha 13, verified locally; not deployed. Date: 3 October 2026.

## Problem

Alpha 11 replaced the decorative art with covers people upload, one track or project at a time. The product owner asked for both ways of getting a cover: uploading your own, and picking from a small set the community supplies. Without a shared set, every editor has to find a suitable picture themselves, and a community cannot give its tracks and projects a common look.

## Decision

- Add a per-community cover library: up to 24 pictures, each with a short name, added and removed only by active owners and administrators.
- Library pictures use the same verified upload pipeline as covers: browser resize that drops photo metadata, a signed policy for the exact type and size, signature and dimension checks on the pinned generation, deletion of refused files. They are stored under `organisations/{organisation}/covers/library/`.
- The cover dialogue offers **Upload your own** or **Community library** whenever the library holds a picture. Choosing one does not copy it: the cover points at the library's verified file with its own focal point. The rule for who may change a cover is unchanged.
- Every active member of the community may see library pictures; other communities, visitors and unlisted uploads may not. Covers made from library pictures follow the visibility of their track or project, as every cover does.
- A picture stays in the library while any track or project shows it. Removing an unused picture deletes its record, its upload and its stored file at once.
- Mirror the rules in row security: a new `cover_library` table (read in the tenant, added only by an active owner or administrator in their own name, removed only by them, no UPDATE for the runtime role) and a restrictive read policy that keeps unlisted library uploads with their uploader and administrators.

## Alternatives considered

- **Stock photo search (Unsplash), as Frappe Learning and ClassroomIO offer.** It needs a third-party access key that most installations leave unset, sends every search to a third party, stores remote addresses that can change or disappear, needs photographer attribution, and in ClassroomIO runs through an unauthenticated route. Rejected for the alpha; a community can upload pictures it has the right to use.
- **Letting any member add library pictures.** It would turn a curated set into a second upload area to moderate. Rejected; owners and administrators curate, and everyone who may change a cover can choose.
- **Copying the picture into each cover.** Simpler deletion, but every use would duplicate storage and the library would no longer say where a picture is used. Rejected; covers point at the library file, and removal waits until nothing shows it.
- **A general media library, as LearnHouse has.** Folders and per-folder access are more than covers need. Rejected for now.
- **Generated or bundled stock art.** The product owner rejected decorative art. The fictional demo seeds one photograph already in the repository, cropped so its caption does not show, to preview the journey.
- **Copying donor code.** The reference projects are AGPL at their roots. Their behaviour informed the design; no file was copied.

## Consequences

Communities can offer a consistent set of covers without anyone hunting for pictures, and the database enforces the same boundaries as the interface. The library is capped at 24 pictures; one 1,600-pixel file is still served at every size; there is no renaming (remove and add again), no tagging or search inside the library and no stock search. COVERS.md and BUILD_STATUS.md record these limits.
