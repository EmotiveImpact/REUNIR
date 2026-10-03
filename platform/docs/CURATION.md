# Collections of useful content

Decision record: `decisions/030-curated-collections.md`. Interface rules: UI_DESIGN_DIRECTION.md.

## What people can do

- **Members** open **Collections** in the second sidebar to see published collections, such as "Start here", each with its items in the team's order and any curator's notes. Home shows the featured collection's first four items. Members see only items whose content they can already open.
- **Owners, administrators and moderators** choose **New collection** to start a draft, then **Add an item** (a conversation, learning track, lesson, project, event, path, mission or community output) with an optional note. They can move items up and down, edit a note, remove an item, edit the title and description, **Publish** or **Return to draft**, **Feature on Home** or **Remove from Home**, and **Delete** the collection. Deleting a collection or removing an item never touches the content itself.
- **Saved for later** remains each member's own private list of bookmarked posts.

## Rules

- Drafts are seen only by active owners, administrators and moderators. Publishing needs at least one item. One published collection at most is featured on Home.
- Items are filtered for each viewer after every other visibility rule: private spaces, hidden posts, unpublished tracks and lessons, draft paths and other communities are respected, and an item's note goes with it. A published collection with nothing a member can see is not listed for them.
- Curators add only live content they can see. Curators are told when an item is limited to a private space or hidden from members.
- Every change is recorded in the audit trail. Suspension or account deletion ends curation at once; a deleted account's collections stay, attributed to Former member.

## Storage

Migration `0030_curated_collections.sql` (additive) adds `collections` and `collection_items` with forced row security and composite tenant keys. An item names exactly one record of its kind. The runtime role may only change a collection's wording, status, feature and editor, and an item's order and note; run `npm run db:grant-runtime` after migrating. The browser demo seeds a featured "Start here" collection, which includes one team-only post that members never see, and a moderator's draft.

## Checks

`tests/collections.test.ts` (domain rules), `tests/collections-database.test.ts` (row security, grants and constraints under the restricted role), `tests/collections-http.test.ts` (command endpoint), the curated collections check in `npm run test:postgres` and `npm run test:browser:curation` (demo journeys, axe checks, monochrome and phone width).
