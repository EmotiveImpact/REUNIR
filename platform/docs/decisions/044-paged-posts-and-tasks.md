# Decision 044: posts and archived tasks a page at a time

Status: implemented in Alpha 44, verified locally; not deployed. Date: 5 October 2026.

## Problem

Decision 018 paged notices, review queues and the audit trail, and left posts and project tasks for later. Every browser still received every post it could see, with every reply, appreciation and bookmark, and every task with its notes and files. A busy community would send ever larger snapshots to every page.

## Decision

- **Feeds page from the server.** The conversation, a space, Saved and Knowledge read posts from `GET /api/organisations/:slug/pages/posts`, 20 at a time, newest first, with the same keyset cursors as decision 018. Optional `space`, `kind` and `saved=1` filters narrow the list. A page carries the replies, appreciations and the person's own bookmarks its posts need (`records`).
- **Pinned posts always travel in the snapshot** and show first; the paged list leaves them out, so nothing repeats.
- **The snapshot keeps a window of posts.** The newest 30 (`POST_WINDOW`), every pinned post, the person's own hidden posts (so they can appeal), and any post a visible collection, appeal or open report names. Replies, appreciations and bookmarks travel only for those. `summary.posts` gives the exact count of visible, unhidden posts.
- **One post can be read alone.** `GET .../pages/posts/items/:id` returns a post the snapshot does not carry, with every reply, under the same visibility rules; anything hidden or private is 404.
- **Archived tasks leave the snapshot.** Active tasks stay, because a project already holds at most 100 of them and the board needs them all to count its columns. Archived tasks, with their notes and files, page from `GET .../pages/archived-tasks?project=:id` for people who can work on that project (404 for anyone else, 400 `PROJECT_REQUIRED` without a project), and a link to one reads it from `.../archived-tasks/items/:id`. `summary.archivedTasks` counts them per project.
- **Feeds keep their place.** When the community changes, the browser reads every page already shown again from the top, so a reply or appreciation on an older post shows without the list collapsing to its first page, and nothing is skipped or repeated. Posts the snapshot already holds that are newer than the last one paged join at once.
- **The demo pages the same way**, over its fictional data.

## Consequences

- The server still reads the whole community for the domain rules, as before. The browser payload is what this decision bounds. The per-table read bound (5,000 rows) still applies to posts; reading posts in SQL a page at a time, as the audit trail is, is the next step if a community approaches it.
- Global search, recent activity and "add to collection" see the posts in the snapshot window, not every post.

## Not decided here

Server search across every post, and paging replies within a single very long conversation.
