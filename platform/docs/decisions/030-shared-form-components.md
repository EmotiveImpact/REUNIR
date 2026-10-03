# Decision 030: every form on the shared shadcn components

Status: implemented in Alpha 30, verified locally; not deployed. Date: 3 October 2026.

## Problem

Alpha 07 brought shadcn Button, Avatar and Dropdown Menu into the shell, but every form still used hand-styled native fields, labels and checkboxes, and most buttons were plain elements with a `button primary` class. ROADMAP.md and UI_DESIGN_DIRECTION.md both said not every form had moved to the new components.

## Decision

- **Seven more shadcn new-york-v4 components, adapted.** Input, Textarea, Label, Native Select, Checkbox, Radio Group and Switch are copied from the official registry source, pinned by blob in THIRD_PARTY_NOTICES.md and research/reuse-register.json, with the same MIT notice as Alpha 07. Four Radix packages are added at exact versions (`react-checkbox` 1.3.3, `react-label` 2.1.7, `react-radio-group` 1.3.8, `react-switch` 1.2.6), matching the Radix versions already in the lockfile; the only new transitive package is `react-use-previous` 1.1.1.
- **A mechanical swap.** Each native field, label and select became its shared component with the same props, so names, ids, labels, accessible names, validation and submit handlers did not change. Buttons with the legacy class became Button with a matching variant and keep the class, so sizes and phone layouts stay. Checkboxes and radios became Radix controls; two on/off settings (Show archive, and showing answers after a knowledge check) became Switches.
- **Native select.** The browser's own select is easier to use on phones and with assistive technology than a Radix Select and keeps `FormData` and `selectOption` working. Its wrapper and drawn chevron are left out so existing rows keep their layout.
- **The dialogue stays native.** `Modal` keeps its API and its modal `<dialog>`, which already makes the page inert, closes on Escape and returns focus. It gains shadcn's dialog slots and a shadcn close Button. A Radix Dialog would add a dependency and a portal for no gain, and current tests across branches use `dialog[open]`.
- **Looks unchanged, monochrome.** REUNIR's unlayered element rules still win over Tailwind's layered utilities, so fields look as they did. `forms.css` gives the Radix controls a neutral border and fill that the global button reset would remove.

## Defaults chosen where the brief was silent

- Radio groups check the choice an arrow key moves to even when the key is released at once, as native radios do; Radix alone needs the key still held when focus arrives.
- File pickers and the cover's focal-point sliders stay native (`input type="file"`, `type="range"`); icon buttons, filter tabs and links styled as buttons keep their markup.
- Options inside selects stay plain `option` elements.

## Not decided here

Removing the legacy `.button` and element rules so the shadcn classes alone style the app, a Radix Slider for the focal point, and moving links styled as buttons to `Button asChild`.
