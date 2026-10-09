# Decision 060: usage stats that respect privacy

Status: built in Alpha 60. Date: 9 October 2026.

## Problem

Pilot owners need to learn which parts of their community people actually use, so they can tend what works and drop what does not. The usual tools for that record each person's visits, often across sites, and turn them into engagement scores. Ferven's doctrine rules that out: private activity is never made public, nothing is inferred about a person from their engagement, and there are no engagement badges.

## Decision

- **Count parts, not people.** Moving into a part of the community (home, discussions, paths and learning, missions, projects, events, people, messages, knowledge and collections, community outputs, your profile, notifications, saved for later) adds one to that part's count for the day. Moving between pages within the same part adds nothing. The stored record is the community, the UTC day, the part and the count, and nothing else: no person, session, device, address, time of day, page or referrer. Account, appeals, teaching (a course's authoring studio included) and community management pages are not counted.
- **Owners and administrators see weekly totals.** Community studio has a **Usage** tab with the last eight weeks for each part. A count under five shows as "<5", so a small community never shows what one person did. There are no per-person figures, rankings, scores or trends about anyone, and the counts feed nothing else in the product.
- **People can leave themselves out.** Your account has **Count what I open from this device**. When it is off, the browser sends nothing. A browser sending Global Privacy Control or Do Not Track is never counted. Because nothing identifies a person, the choice lives on the device rather than the account.
- **The browser sends only the part's name.** `POST /api/organisations/:slug/usage` with `{ "area": "projects" }`; anything else is refused. Only an active member of the community is counted. More than 30 counts a minute from one person are dropped quietly, and counting has its own allowance, so it never uses up the limit on a member's actions. A lost count never shows an error.
- **Kept for 183 days.** The existing retention job clears older days, so no new scheduler is needed, and Your account says so.
- **Storage.** Additive migration `0051_usage_counts.sql` adds `usage_counts` (community, day, part, count) with forced row security. Only the API's counting step, which marks its transaction for that community, can start today's count at one or add one to it, and only for an active member. Active owners and administrators read their own community's counts. Only the retention job, whose own transaction alone carries its worker mark, can see and delete days past keeping. The runtime role may update only `count`.
- **The demo** keeps counts in the page, on top of an illustrative history, and says so.

## Alternatives considered

- **A third-party analytics service.** It would send members' visits to another company and another project's infrastructure, which AGENTS.md rules out.
- **Counting distinct people.** It needs an identifier for each person, however hashed, and makes "who was here this week" answerable. Plain counts answer the pilot's question without it.
- **Counting actions from the audit trail.** The audit trail names who did what; reading usage from it would tie the figures to people and to private actions such as goals and messages.
- **Hourly counts.** A time of day makes a single visit in a small community easier to attribute. A day is enough to see what is used.
