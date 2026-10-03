# Decision 024: group conversations

Status: implemented in Alpha 24, verified locally; not deployed. Date: 3 October 2026.

## Problem

Messages held only one thread per pair of members. A small team, a critique circle or the people organising an event had to repeat themselves in several threads or move to the public discussion spaces, which is the wrong place for private planning.

## Decision

- **A group is a conversation with a name.** Any active member can start one from Messages with **New group**: a name of up to 80 characters and at least two other active members, up to 20 people in all. Direct threads are unchanged and stay one per pair.
- **Only the people in it can read it.** The existing participant list and its row security cover groups, so owners, administrators and moderators have no access to a group they are not in, in any community. Nothing from a group enters the community feed, search, notices or activity.
- **Anyone in the group can add people and rename it.** Someone added later reads only what is written after they join, because earlier messages were written to a smaller audience. This is enforced twice: the API filters, and a restrictive row-security policy on `messages` hides earlier rows from that person even in a direct query. Someone who leaves and is added again starts from the newest message.
- **The person who started the group removes others**, while they are still in it. Anyone can leave. Leaving or being removed ends access to the whole group; their messages stay for the others, under their name or as Former member if they later delete their account.
- **Blocks still matter, without silencing a group.** You cannot put someone in a group, or add them later, if either of you has blocked the other. A block never pauses a group that both are already in: it pauses only the direct thread between the two people. Leaving remains available.
- **Reports work as before.** Reporting a message in a group shares only that message, its reason and the people involved with moderators.

## Database

Additive migration 0022:

- `conversations` gains `kind` (`direct` or `group`, defaulting to `direct` for every existing row), `title` and `created_by`. The column check from 0004 that required exactly two people becomes one shape check: a direct thread has exactly two different people and no name; a group has a name, a starter and at most 20 people.
- `conversation_joins` records, for someone added after a group began, the newest message sequence when they joined. It has forced row security: rows are visible to the people in the group, and written only in the adding member's own name.
- `message_group_history`, a restrictive select policy on `messages`, hides messages at or before a person's join point.
- Leaving needs two policies, because the updated row no longer names the person leaving and PostgreSQL checks an updated row against the select policies too: `conversation_leave` admits that update for a group they are in, and `conversation_leaving` keeps the row readable only while the API marks it for that transaction (`app.leaving_conversation`), after it has confirmed under the participant policy that they are in it. The mark is cleared straight after the update.
- `conversation_joins` is granted explicitly to the runtime role. Run `npm run db:grant-runtime` after migrating.

## Not decided here

Join and leave lines inside the conversation, read receipts or typing indicators, mentions, attachments, notices or emails about new group messages, more than one starter, handing the starter's role on when they leave, and groups larger than 20.
