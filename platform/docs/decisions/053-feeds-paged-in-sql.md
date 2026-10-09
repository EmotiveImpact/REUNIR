# Decision 053: feeds paged in SQL, so posts have no ceiling

Status: built in Alpha 53. Date: 9 October 2026.

## Problem

Every request read the whole community: each table up to 5,000 rows and 20,000 rows in all, refusing with `WORKSPACE_LIMIT` past that. Posts, replies and appreciations grow fastest, so a lively community would have stopped working first through its conversations. Feed pages (Alpha 44) were cut from that full read, so they did not lift the limit.

## Decision

- A workspace read carries a window of posts: the newest 300, every pinned post, the person's own hidden posts, any post a collection, appeal or report names, and the post a command or link names. Replies, appreciations and bookmarks are read for those posts only. Account deletion also reads the person's own appreciations and bookmarks on every post, so its row-count checks against row security still hold.
- Feed pages are cut in SQL by the `(organization_id, created_at)` index: visible spaces and the hidden-post rule (moderators and the author) are applied in the query, with the same millisecond keyset as the audit trail. Space, kind and saved filters are SQL conditions. The page's replies, appreciations and the person's bookmarks are read for its posts.
- The snapshot's post count is a SQL count over visible spaces, since the window does not hold every post.
- A single post by link reads that post and its records.
- No migration: the indexes from migration 0001 serve these queries.

## Alternatives considered

- **Raising the per-table limit.** Moves the cliff without removing it, and every request would still read every post.
- **Paging every collection in SQL now.** Members, spaces, tracks and projects grow far more slowly, and the domain rules need them whole to decide access. They keep the 5,000-row limit for now.

## Consequences

The domain rules are unchanged; they see fewer posts and change only what they were given, and `saveChanges` writes differences, so posts outside the window are never touched. If more than about 270 of the newest 300 posts sit in spaces a person cannot see, their first screen shows fewer than 30 posts; the feed's next page fills in. Client-side search covers the posts on screen, as before.
