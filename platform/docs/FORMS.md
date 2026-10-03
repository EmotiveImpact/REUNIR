# Forms and the shared shadcn components

Alpha 30, 3 October 2026. Every form in the web app now uses the shared components in `apps/web/src/components/ui/`. Alpha 07 added shadcn Button, Avatar and Dropdown Menu for the shell; this slice adds Input, Textarea, Label, Native Select, Checkbox, Radio Group and Switch and moves the remaining forms onto them. See decisions/030-shared-form-components.md and THIRD_PARTY_NOTICES.md.

## The components

| Component | File | Renders | Replaces |
| --- | --- | --- | --- |
| Input | `ui/input.tsx` | `<input data-slot="input">` | text, email, password, number, URL, date-time and search inputs |
| Textarea | `ui/textarea.tsx` | `<textarea data-slot="textarea">` | every textarea |
| Label | `ui/label.tsx` | Radix Label, `<label data-slot="label">` | every label |
| NativeSelect | `ui/native-select.tsx` | `<select data-slot="native-select">` | every select |
| Checkbox | `ui/checkbox.tsx` | Radix Checkbox, `<button role="checkbox" data-slot="checkbox">` | `input type="checkbox"` |
| RadioGroup, RadioGroupItem | `ui/radio-group.tsx` | Radix Radio Group, `role="radiogroup"` and `<button role="radio" data-slot="radio-group-item">` | `input type="radio"` |
| Switch | `ui/switch.tsx` | Radix Switch, `<button role="switch" data-slot="switch">` | on/off checkboxes that change a view or a setting |
| Button | `ui/button.tsx` (Alpha 07) | `<button data-slot="button" data-variant>` | `<button className="button primary/secondary/ghost">` |

Names, ids, `aria-*` attributes, `required`, `minLength`/`maxLength`, `pattern`, `type` and submit handlers pass straight through, so native constraint validation and `FormData` reads are unchanged.

**Native select, not a Radix Select.** A Radix Select is a button and a pop-up list: it cannot be typed into, does not use the phone's own picker, needs a hidden input to take part in `FormData`, and every test would have to click through it. The shadcn Native Select keeps the browser's own control, so keyboard, phone, autofill and assistive technology behave as before and `selectOption` still works. The wrapper and drawn chevron are left out so selects keep their place in the existing grid and flex rows (`.instructor-add select{flex:1}`, `.goal-actions select{max-width:330px}`).

**The dialogue stays native.** `Modal` keeps its API and its `<dialog>` opened with `showModal()`: the browser makes the rest of the page inert, Escape closes it through `onCancel`, a click on the backdrop closes it and focus returns to what opened it. The element now carries shadcn's `dialog-content`, `dialog-header` and `dialog-title` slots and closes with a shadcn ghost icon Button. A Radix Dialog would add a dependency and a portal without improving any of that, and tests in this and parallel branches find dialogues by `dialog[open]`.

**Arrow keys in a radio group.** Radix checks the next choice only while the arrow key is still held when focus arrives, which a quick key press from automation or an assistive switch can miss. `RadioGroup` notes an arrow key pressed on a choice and `RadioGroupItem` checks itself when that move arrives, as a native radio does. Tab into a group focuses the checked choice without changing it.

**Styles.** The components carry the shadcn new-york classes against neutral tokens (`--color-input`, `--color-ring` added to `design-system.css`). Tailwind's utilities live in a cascade layer, so REUNIR's existing unlayered element rules in `styles.css` still decide field padding, type and colour; forms look as they did. `forms.css` restores the border and fill that the global `button` reset would otherwise remove from the Radix controls, all in neutral greys, and lets legacy `.button` and `.icon-button` sizes win over Button's fixed heights.

## Inventory, before and after

Counts are elements in the source (one element inside a `.map` counts once).

| File | Before (native) | After |
| --- | --- | --- |
| `App.tsx` | 1 input, 1 `.button` button | Input, Button |
| `components/cover-library.tsx` | 1 label, 1 input, 5 `.button` buttons | Label, Input, Button, file picker stays native |
| `components/cover.tsx` | 6 labels, 1 input, 5 `.button` buttons, 2 radio sites | Label, Input, Button, RadioGroup, sliders and file picker stay native |
| `components/email-address.tsx` | 2 labels, 2 inputs, 5 `.button` buttons | Label, Input, Button |
| `components/forms.tsx` | 18 labels, 10 inputs, 2 textareas, 6 selects, 2 `.button` buttons | Label, Input, Textarea, NativeSelect, Button |
| `components/instructors.tsx` | 2 labels, 2 inputs, 3 selects, 5 `.button` buttons | Label, Input, NativeSelect, Button |
| `components/learning-record.tsx` | 1 `.button` button | Button |
| `components/lesson-editor.tsx` | 2 labels, 2 inputs | Label, Input |
| `components/lesson-resources.tsx` | 2 labels, 1 input, 1 textarea | Label, Input, Textarea, file picker stays native |
| `components/notification-settings.tsx` | 2 labels, 1 `.button` button, 1 checkbox site, 1 radio site | Label, Button, Checkbox, RadioGroup |
| `components/ownership.tsx` | 2 labels, 2 inputs, 2 `.button` buttons | Label, Input, Button |
| `components/quiz-editor.tsx` | 7 labels, 3 inputs, 2 textareas, 3 selects, 1 checkbox site, 1 radio site, on/off checkbox | Label, Input, Textarea, NativeSelect, Checkbox, RadioGroup, Switch, answer marks are a RadioGroup for one answer, Checkboxes for several |
| `components/quiz-review.tsx` | 2 labels, 1 input, 1 textarea, 1 `.button` button | Label, Input, Textarea, Button |
| `components/quiz-view.tsx` | 1 label, 1 input, 1 textarea, 1 checkbox site, 1 radio site | Label, Input, Textarea, Checkbox, RadioGroup, answers are a RadioGroup for one answer, Checkboxes for several |
| `components/second-step.tsx` | 1 label, 1 input, 2 `.button` buttons | Label, Input, Button |
| `components/simulated-fault.tsx` | 1 `.button` button | Button |
| `components/states.tsx` | 3 `.button` buttons | Button |
| `components/two-step.tsx` | 2 labels, 2 inputs, 12 `.button` buttons | Label, Input, Button |
| `components/ui.tsx` | native `<dialog>`, `icon-button` close | native `<dialog>` with dialog slots, ghost icon Button |
| `lib/context.tsx` | 2 labels, 2 inputs, 5 `.button` buttons | Label, Input, Button |
| `main.tsx` | 1 `.button` button | Button |
| `pages/access.tsx` | 8 labels, 7 inputs, 1 select, 12 `.button` buttons, 1 checkbox site | Label, Input, NativeSelect, Button, Checkbox |
| `pages/account.tsx` | 2 labels, 2 inputs, 3 `.button` buttons | Label, Input, Button |
| `pages/authoring.tsx` | 5 labels, 3 inputs, 1 textarea, 5 `.button` buttons, on/off checkbox | Label, Input, Textarea, Button, Switch |
| `pages/collections.tsx` | 6 labels, 1 input, 3 textareas, 2 selects, 11 `.button` buttons | Label, Input, Textarea, NativeSelect, Button |
| `pages/community.tsx` | 2 labels, 2 textareas, 4 `.button` buttons | Label, Textarea, Button |
| `pages/doing.tsx` | 3 labels, 1 input, 2 textareas, 9 `.button` buttons | Label, Input, Textarea, Button |
| `pages/events.tsx` | 5 `.button` buttons | Button |
| `pages/learning.tsx` | 6 `.button` buttons | Button |
| `pages/message-groups.tsx` | 4 labels, 3 inputs, 7 `.button` buttons, 1 checkbox site | Label, Input, Button, Checkbox |
| `pages/messages.tsx` | 4 labels, 2 inputs, 2 textareas, 13 `.button` buttons | Label, Input, Textarea, Button |
| `pages/operations.tsx` | 2 `.button` buttons | Button |
| `pages/people.tsx` | 7 labels, 6 inputs, 2 textareas, 14 `.button` buttons | Label, Input, Textarea, Button |
| `pages/project-work.tsx` | 10 labels, 4 inputs, 4 textareas, 2 selects, 16 `.button` buttons | Label, Input, Textarea, NativeSelect, Button, task file picker stays native |
| `pages/purpose.tsx` | 28 labels, 8 inputs, 6 textareas, 14 selects, 25 `.button` buttons | Label, Input, Textarea, NativeSelect, Button |

Totals: 131 labels, 69 inputs, 29 textareas, 31 selects and 184 buttons styled `button primary/secondary/ghost` plus the dialogue's close button; 7 checkbox sites (two on/off settings became Switches, five stay Checkboxes) and 5 radio sites (all now Radio Groups).

## Deliberately native

- **File pickers** (`cover.tsx`, `cover-library.tsx`, `lesson-resources.tsx`): hidden inputs opened by a Button; nothing to style.
- **Focal-point sliders** (`cover.tsx`): `input type="range"` keeps its value, `fill()` and arrow-key steps; a Radix Slider would make the value a `div` and lose typed entry.
- **Options** inside selects stay plain `option` elements; shadcn's option classes would only recolour the system list.
- **Buttons that are not form buttons** (icon buttons, filter tabs, list rows, save and appreciate toggles, the editor toolbar) and **links styled as buttons** keep their own markup. They are navigation or toggles with their own styles, not form controls.
- **The rich lesson editor** body is Tiptap's `contenteditable`, not a form field.

## Tests

- `npm run test:browser:forms` (`scripts/forms-browser-check.ts`, in CI): opens every sidebar page as an administrator, the creator studio and lesson editor, every create dialogue, notification settings, member access, a new collection, a new group conversation, a task with its files and a track's teaching roles, and fails on any native input, textarea, select, label, legacy `.button` or checkbox, radio or switch that is not a shared component (file pickers and sliders excepted). It also checks keyboard use (Space on a checkbox and switch, arrows in a radio group, Tab order and Enter to submit, Escape closing a dialogue with focus returned), native validation still stopping an empty required field, accessible names, axe (WCAG 2.1 AA) on each form, and a 390px phone width.
- `scripts/test_forms_contract.py`: pinned Radix versions match the lockfile, notices and licences are present, component files carry their attribution and `data-slot`, no native control or legacy `.button` remains in `apps/web/src` outside `components/ui`, the Modal keeps its native dialog, the form styles are neutral and the browser check runs in CI.
- Selector changes in existing suites, where a native checkbox became a Radix Checkbox: `pilot-browser-check.ts` (`.access-checkbox input` to `.access-checkbox [role=checkbox]`) and `operations-browser-check.ts` (`.pilot-check input` now also matches `[role=checkbox]`). No assertion changed.
