# Decision 051: app, accessibility and speed fixes from the October audit

Status: built in Alpha 51. Date: 9 October 2026.

## Problem

The audit of main at `4d82e9e` found faults people would meet in the web app:

- A modal dialogue puts everything outside it behind its backdrop, including the message strip. A refusal while a dialogue was open was hidden, and the create dialogue then said only "Please check the details above".
- Someone whose membership ended while the page was open met a crash on every page, because the shell assumed they were still in the member list.
- A lesson video whose link expired left a dead black player.
- A second quick click was refused silently and reported as a failure.
- Page changes did not move focus or change the tab title; filter tabs, the current lesson and the open conversation showed their state only visually; many messages were never read aloud; about 70 text styles were below 9px.
- Messages shared one search box between the inbox and the "new message" picker, and kept a report reason for the next report. Events counted former members and offered RSVP to finished events. Search counted only the first 12 results. Real lessons said they were sample content; the help text said video was out of scope; the footer named release 07.
- Every message re-rendered every page, and a hosted build inlined the demo's portraits into its first download.
- The favicon was violet and the browser bar blue-tinted, against the monochrome contract.

## Decision

- Messages live in their own component. One element carries each message: a polite region that stays in the page, or an alert inserted inside an open dialogue for a failure. The create dialogue shows the server's reason.
- A missing or inactive membership shows "Your access to this community has changed" with a way to check again.
- The lesson stage resets on a playback error and says to press play for a fresh link.
- The in-flight guard is a ref; a second click says another change is still saving.
- On a route change the tab title names the area and community, and focus moves to the page heading (or the main area while it loads), unless a dialogue is open. Filter tabs carry `role="group"` and `aria-pressed`; the current lesson and conversation carry `aria-current`; unread counts are spoken. No text style is below 9px, mobile navigation labels are 11px, and the purpose links have a 24px target.
- The listed copy and behaviour fixes, with the footer reading `RELEASE_VERSION`.
- Hosted builds inline only images under 4 KB; the single-file preview still inlines everything.
- A near-black favicon and a neutral theme colour.

## Alternatives considered

- **Rendering messages as a `popover`.** A popover above a modal dialogue is still outside it, and how browsers treat that for assistive technology varies.
- **Splitting the demo seed out of the main bundle.** It is imported for its fixed identifiers across the shell; moving it is a larger change than its size justifies before launch.
- **A shared confirmation dialogue in place of the browser's own.** Fourteen call sites; left for a later pass, as the browser's dialogue is accessible if plain.

## Consequences

Browser checks that looked for message text now find it once. The 9px floor is a floor, not a target; the type scale itself is unchanged.
