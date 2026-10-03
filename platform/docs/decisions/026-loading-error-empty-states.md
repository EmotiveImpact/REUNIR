# Decision 026: loading, error and empty screens

Status: implemented in Alpha 26, verified locally in the browser demo; not deployed. Date: 3 October 2026.

## Problem

The roadmap asked for better loading, error and empty screens. Pages handled these one by one: a lazy route showed one line of text, a failed page replaced the whole app with a generic interruption, unknown addresses reused an empty-state box, a failed background refresh in a connected community swapped the entire app for a reconnect screen, command failures looked the same as successes, and empty lists could not tell "nothing yet" from "nothing matches this filter". Some offered nothing to do next; others did not say who could.

## Decision

- **Shared pieces, one convention.** `components/states.tsx` holds `Loading`, `PageLoading`, `ShellLoading`, `ErrorState`, `InlineError`, `PageBoundary`, `NotFound`, `ConnectionNotice` and `useOnline`. `Empty` in `components/ui.tsx` gains a Lucide `icon` and a wrapped action row. The conventions are in `docs/STATES.md`.
- **Errors carry their kind.** `api()` now throws `ApiError` with the HTTP status and the server's error code, and a request that never reached the server becomes `OFFLINE` with a plain message. `failureOf` maps errors to offline, session ended, two-step sign-in, no access, not found, outdated code or unknown. Screens choose their words and actions from that. `displayError` turns a blank required field into a sentence naming the field.
- **Failures stay inside the shell.** A route-level boundary keeps navigation and the account menu, resets when the viewer moves to another page and offers Try again and Go to your home, with technical detail tucked away. The top-level boundary stays as the last resort.
- **A failed refresh keeps the page.** Once a workspace has loaded, a failed background refresh shows a notice instead of replacing the app.
- **Failure toasts are marked.** `toast(message, 'error')` adds the `error` class, an icon and a longer display time. Every command, upload and messaging failure uses it. The single `.toast` live region is kept, so existing checks still find one element.
- **Empty states respect roles and filters.** First-run and no-results are separate messages. The first-run action appears only when the viewer's role allows it.

## Defaults chosen where the brief was silent

- Without pilot observations, every list page with a filter got a "Show all" action, and the first-run actions were limited to those the page already offered by role (administrators create tracks, missions and events; anyone can post or start a project; project leads and administrators add tasks; anyone can message an active member).
- The command progress line appears after 250 ms. Failure toasts stay for eight seconds, other toasts for 4.8.
- The toast stays a polite status region for failures too, so announcements are not doubled; the failure is distinguished visually and by its wording.
- The demo-only `#/states/fault` route exists to check the error screen and is decided by the build-time data mode.
- The breadcrumb on the Not found page still reads Home; the page heading names the problem.

## Not decided here

Retrying commands automatically, queuing changes made while offline, a service worker, reporting front-end errors to the operator and wording informed by pilot members. Server validation messages in connected mode still come from the validator's own wording; only the demo and client-side validation get the field sentence.
