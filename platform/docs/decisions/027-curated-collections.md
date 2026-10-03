# Decision 027: collections of useful content

Status: implemented, verified locally; not deployed. Date: 3 October 2026.

## Problem

Useful material was scattered across discussions, learning tracks, paths, projects and events. A new member had no way to find "the five things worth reading first", and the community team had no way to point at them. Posts carried a `pinned` flag, but only the fictional seed set it: there was no command to pin, and a pinned post could only highlight one conversation inside the feed. Members already had private bookmarks and a Saved for later page.

## Decision

- **Collections, not copies.** A collection is a named list ("Start here") with a short description. Each item points at one existing post, learning track, lesson, project, event, path, mission or community output, with an optional curator's note (up to 280 characters) and a manual order. Content is never copied, so editing, hiding or unpublishing the content changes what the collection shows. Private goals, messages, bookmarks, scores, attempts and notification settings cannot be collected: the command only accepts the eight kinds above.
- **Curators are owners, administrators and moderators.** The PRD gives moderators the job of keeping discussions useful and safe, and curating is part of that. Curating grants nothing else, and teaching a track is not curating. Like every role, it needs an active membership: suspension or account deletion ends it at once. Owner and administrator two-step sign-in is not required for curation, because a moderator could do the same; an administrator reaching an item only through administrator access to a private space is asked for it, as for any other administrator action.
- **Drafts are private, publication is explicit.** A new collection is a draft that only curators see. Publishing needs at least one item, and returning to draft takes it off Home. At most one published collection is featured on Home; featuring another moves the feature.
- **Each person sees only what they could already see.** Items are filtered after every other rule, against the viewer's own filtered workspace: a post in a private space, a hidden post, an unpublished track or lesson, a draft path, or anything else the viewer cannot open is left out, with its note, before the snapshot leaves the server. A published collection with nothing the viewer can see is left out for members. Curators see which items are limited to a private space or hidden from members. Curators can only add content they can see that is live; an item that later becomes hidden simply stops showing.
- **Ordinary command pipeline.** Eight strict commands (`collection.save`, `.publish`, `.feature`, `.delete`, `.item.add`, `.item.note`, `.item.remove`, `.items.reorder`) run through the existing workspace command endpoint, idempotency and outbox. Every change is audited like other administrative actions; unchanged commands write nothing. Reordering compares the curator's current order and refuses a stale one; a moderator reorders the items they can see and items they cannot see keep their places.
- **Additive migration.** Two tables, `collections` and `collection_items`, with tenant-scoped composite keys, foreign keys to each kind of content, one target per item matching its kind, one entry per piece of content in a collection, unique positions checked at commit and one featured collection per community checked at commit. Row security is forced: members read published collections and their items; drafts and every write need an active owner, administrator or moderator, writing in their own name. The runtime role may change only a collection's wording, status, feature and editor, and only an item's order and note. Run `npm run db:grant-runtime` after migrating.
- **Home and navigation.** The second sidebar gains **Collections** (navigation only, within the approved v4 shell). Home shows the featured collection's first four visible items in one compact panel under the purpose hero, and nothing when there is no featured collection. Global search lists collections the person can see.
- **Saved stays private.** Saved for later already existed and is unchanged: bookmarks are visible only to their owner, never counted for anyone else and never used for ranking or curation.

## Defaults chosen where the brief was silent

- Up to 30 collections per community and 50 items per collection; titles up to 80 characters and descriptions and notes up to 280.
- Pinning stays as it was (a data flag with no command); collections replace the need for it. Collections do not notify anyone.
- A deleted account's collections and items stay, attributed to Former member, like other shared work.
- Collections are ordered with the featured one first, then published ones newest first, then drafts.

## Not decided here

Collections scoped to one space, member-suggested items, per-item publication dates, public collections outside the community and reading counts. None of these is needed for "Start here".
