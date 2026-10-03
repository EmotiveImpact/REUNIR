# Loading, error and empty screens

How the web app says "on its way", "that did not work" and "nothing here yet". Every new page or panel should follow these conventions so a person never meets a blank area, a silent failure or an offer they are not allowed to take up. The pieces live in `apps/web/src/components/states.tsx` and `components/ui.tsx` (`Empty`), styled in `apps/web/src/states.css`. Decision record: `decisions/027-loading-error-empty-states.md`.

There are no pilot observations yet. These are the defaults; change them when real members show where they get stuck.

## Loading

- **Keep the shell.** Navigation, the top bar and the account menu stay while a page loads. Only the page area shows its outline.
- **Use the shared pieces.** `PageLoading` is the fallback for lazy routes. `ShellLoading` covers the moment before the workspace exists (it draws the outline of the rail, sidebar and top bar). `Loading` is for a panel or list, such as notices, invitations, the inbox or a review queue.
- **Words are read out, shapes are not.** Each loading state has `role="status"`, `aria-busy="true"` and a short sentence ("Opening your inbox…"). The skeleton shapes are `aria-hidden`.
- **Lists that load more** keep what is shown and mark the button: `disabled` and `aria-busy` while the next page loads, with the button reading "Loading…".
- **Commands in flight** disable their controls through the shared `busy` flag. The main region is `aria-busy` and a thin line appears at the top of the window only if the command takes longer than a quarter of a second, so quick demo commands do not flicker.
- **Motion is gentle and optional.** Skeletons pulse slowly; with `prefers-reduced-motion: reduce` they and the progress line are still.

## Errors

- **Say what happened in plain words, then offer a way forward.** `ErrorState` takes the error and picks the wording: offline, session ended, two-step sign-in needed, no access, not found, REUNIR updated since the page opened, or a page that failed to display. It offers **Try again** (or **Sign in again** / **Reload REUNIR** where only a reload helps) and **Go to your home**.
- **Technical detail is kept but tucked away** in a closed "Technical detail" disclosure, with the server's error code and HTTP status where there is one.
- **A page that fails keeps the shell.** `PageBoundary` wraps the routes inside the shell. Moving to another page clears the failure. The boundary says "Your saved demo data has not been deleted." in the demo, and that a display failure changes nothing saved in a connected community. The top-level boundary in `main.tsx` remains the last resort.
- **Unknown addresses get a real Not found page** (`NotFound`), inside the shell, naming the address that was asked for. A record the viewer cannot open (a private space, a removed project) uses `Empty` with a link back to its list. It never says whether a private record exists.
- **Offline.** The shell shows a calm notice while the browser reports no connection. In the demo it says the demo keeps working and nothing is sent anywhere. In a connected community it says changes cannot be saved until the connection returns. On reconnecting, a short "You are back online." notice appears and the workspace refreshes.
- **A failed refresh does not throw away the page.** In a connected community the workspace refreshes in the background. If that fails after a workspace has loaded, the page stays and a notice explains (session ended, access changed, or the latest changes could not be loaded) with the matching action. Only a first load that fails replaces the app with an error screen, and that screen offers the viewer's other communities.
- **Failed commands are never silent.** A refused command shows a toast marked as a failure (class `toast error`, an alert icon, kept on screen longer) or an inline message inside a dialogue. The form keeps what was typed. Validation messages name the field ("Nothing was saved. Fill in the name and try again."). A request that cannot reach the server says so and that nothing was saved. Panels that fail to load use `InlineError` with **Try again**.
- **Two-step sign-in.** The existing notice for owners and administrators stays. A command refused with `TWO_FACTOR_REQUIRED` shows the server's own message, and an error screen for it links to Your account.

## Empty

- **One component.** `Empty` takes a title, a body, an optional action and a Lucide `icon` chosen for the context (for example `Calendar` for events, `Mail` for the inbox, `Bell` for notices, `ListTodo` for tasks, `SearchX` for no results, `Lock` for something the viewer cannot open). Icons are decorative (`aria-hidden`) and neutral grey.
- **Tell first-run apart from no results.** When nothing exists yet, say so and, if the viewer may, offer to make the first one. When a filter or search hides everything, say that nothing matches and offer to clear it ("Show all projects", "Clear the search").
- **Only offer what the viewer's role permits.** An administrator sees "Plan the next event" or "Set the first mission"; a member is told the community team has not added one yet. "Add the first task" appears only for the project lead or an administrator. Hidden controls are presentation only; the server still decides.
- **Honest copy.** No invented activity, counts or encouragement that implies progress. Private things stay private: an empty inbox says only the two participants can read a conversation, and saved posts are said to be visible only to the viewer.
- **Distinct labels.** An empty-state action never repeats the exact name of a control already on the page (for example "Write a first message" beside "New message", "Add the first task" beside "Add task"), so each has one meaning for assistive technology and tests.

## Copy and appearance

British English, no em dashes, short sentences. Black, white and neutral grey only: the error and empty icons use the same grey tile, failure toasts differ by icon and border, not colour. Run `npm run test:browser:states` (not found, a page error with Retry, offline, a failed command and first-run empty states, with axe and the neutral-colour check) and `npm run test:browser:monochrome` after changing these screens.

## Demo-only simulation

The fictional demo registers `#/states/fault`, a page that fails to display until **Try again** is pressed, so the error screen can be seen and checked. It changes no data. The route is decided by the build-time data mode, so the connected application does not include it.
