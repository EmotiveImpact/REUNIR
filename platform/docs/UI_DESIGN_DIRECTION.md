# REUNIR approved UI direction: v4 integrated into the application

2 October 2026. This supersedes the earlier palette-only patch and coloured moodboards. It is the user's approved `REUNIR-shadcn-reference-v4.html`, applied to the existing application, not a new app or a replacement backend.

Reference SHA-256: `c27b5c75f88837ae6c5a1b49368b2c432a5deb8edfa8a27c16b25521d66c40f4`. The screenshot and behavioural comparisons are included in the release evidence. Example copy/counts in the mock are not production data requirements.

## Non-negotiable design decisions

- Keep the narrow far-left workspace rail. Community changes remain scoped to real account memberships in connected mode.
- The second sidebar is navigation only: no search field or community-switcher control. Keep all authorised learning, projects, discussions, messages, events, knowledge, missions, outputs and management routes.
- One account portrait/menu in the top-right. No duplicate account avatars or profile card at the bottom of either sidebar. Help and authorised management remain reachable.
- Portrait pictures for people, not coloured initials. Original avatar photos retain their natural colour. Without a supplied photo use a neutral person icon. Demo images are strictly gated to fictional demo IDs, never substituted for live users.
- Black/near-black surfaces, white text and buttons, restrained borders, neutral secondary controls. No coloured icon tiles, navigation stripes or decorative glow. Selection still has text contrast and `aria-current`; focus remains visibly outlined.
- Lucide library icons, consistently sized and stroked. Do not replace icons with text glyphs or invent bespoke SVG illustrations for functional navigation.
- Clean Inter-first UI typography, using system fallbacks when Inter is unavailable. A restrained system editorial serif is used for the main Home heading. No font binaries are distributed.
- Keep the mountain photographic moment, spacing and visual hierarchy of v4. Do not add quote cards, oversized promotional statistics or another motivational-dashboard redesign.

## Actual integration, not a static reference

`App.tsx` implements the two-level shell, global search and a single keyboard-operated account menu. `PurposeHome` is backed by the existing filtered workspace and `pathProgress`. Counts, next steps, projects, activity and published outputs use actual current records. Pending proof, private messages and other people's private goals are not activity content.

`components/ui/button.tsx`, `avatar.tsx` and `dropdown-menu.tsx` adapt official shadcn registry source over pinned Radix primitives. `components.json`, `lib/utils.ts`, Tailwind utilities/theme and a Vite plugin are present. The original stylesheet remains; scoped v4 styles keep the other working routes coherent. This is not a claim that every legacy form/dialog has been migrated to shadcn.

The account menu uses Radix's supported non-modal mode, with keyboard navigation, Escape, focus restoration and outside dismissal. The mobile drawer has an explicit close control, focus cycling and Escape handling. Drawer content is not duplicated into another independent navigation system.

## Content and privacy fidelity

The static mock's 62% is replaced by calculated evidenced progress. Past sample events do not pretend to be upcoming. Existing private goals retain explicit visibility, and role-switching is demo-only. Product navigation is permission-filtered; hidden UI is not an authorisation boundary. No migrations or permission rules are changed for presentation.

The seven sample portrait JPEGs and hero crop originate in the supplied reference. They are fictional preview assets. Production photography and rights review are still required before public launch. Track and project covers are pictures uploaded by the community, cropped around a stored focal point and kept in their natural colours, or a plain neutral panel with one muted icon. No text is placed on a picture: titles and details stay below or beside it, and only opaque status labels may sit on it. The earlier generated cover art is retired and must not return.

## Loading, error and empty screens

Follow `STATES.md`: keep the shell while a page loads or fails, use the shared loading, error and `Empty` components, explain failures in plain words with a way forward, tell first-run apart from no results, and offer an empty-state action only when the viewer's role permits it. Run `test:browser:states` after changing them.

## Acceptance

Run `test:browser:v4`, the retained community/purpose/pilot/work/authoring suites, the monochrome suite and, for anything that touches covers, `test:browser:covers`. Verify desktop and narrow viewports, one account trigger, no repeated bottom avatars, all routes, real progress, image fallbacks, access boundaries, menu/drawer focus and no horizontal overflow. Preserve original image colours; do not grayscale the entire page.

This implementation is not a hosted deployment or proof of a GitHub merge. Those require their own verified receipts.
