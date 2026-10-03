# Decision 019: notification settings and email digests

Status: implemented in Alpha 19, verified locally; not deployed. Date: 3 October 2026.

## Problem

Every notice reached everyone it concerned, with no way to turn a kind of notice off, and nothing reached people who do not open the app. Busy members needed fewer notices; quiet members needed a reason to come back.

## Decision

- **Four topics people can turn off.** Notices are grouped by where they lead: conversations, learning, projects and events. Each member can turn any of them off for each community. Notices about their own access, role, ownership or teaching ("Your access") have no switch, because they change what the person may do.
- **Muting is forward only.** Turning a topic off stops new notices about it; notices already received stay. Muted notices are never written, so they cannot reappear, appear in a count or reach a digest.
- **Settings are private.** A member reads and changes only their own settings; administrators do not see them, and saving them writes no audit entry. Suspended members keep their settings but cannot change them. Account deletion removes them.
- **Digests are opt-in and plain.** A member may choose a daily or weekly email listing notices they have not read since the last digest, at most 20 named with a count of the rest, linked back into the app. Nothing is sent when there is nothing new, to a suspended member or to someone who no longer has an account. The digest job lists who is due across communities through a narrow read policy (`app.worker='digest'`) and then works inside each member's own community context, so row security applies as for a request. Overlapping runs queue one digest.
- **Nothing is scheduled automatically.** The digest job only queues mail; the existing mail drain sends it. Both need a scheduler and a mail provider configured at deployment, and digests are only offered where mail can be sent.

## Not decided here

Per-notice-type switches, quiet hours, push notifications and digests of community activity a member has not been notified about.
