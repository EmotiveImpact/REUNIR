# Decision 055: one confirmation box across the app

Status: built in Alpha 55. Date: 9 October 2026.

## Problem

Fourteen actions asked "are you sure?" with the browser's own confirm box: a grey system prompt with "OK" and "Cancel", outside the app's look, unreadable to the app's accessibility checks, and with OK as the default button. The project team panel from Alpha 54 asked in place instead, a third pattern.

## Decision

`components/confirm.tsx` provides `ConfirmProvider` (mounted once in `main.tsx`) and `useConfirm()`. A call reads `if (await confirm({ title, body, confirmText })) …`.

- The box is a native modal `<dialog>` like `Modal`, with the `alertdialog` role and shadcn alert dialogue slots, so it takes the top layer, traps focus and makes the page behind it inert.
- The confirming button names the action ("Remove picture", "Leave group"), never "OK". Cancel has focus first, so Enter or Escape never confirms by accident. Focus returns to whatever opened it.
- A second request while one is open answers the first with "no". Outside the provider (static rendering in tests) every request is refused.
- The unsaved-lesson guard in the editor holds back the click, asks, and replays the click when the person chooses to discard their edits.
- Every former `window.confirm` call and the project team panel use it. A source contract test (`scripts/test_forms_contract.py`) fails if `window.confirm` returns.

## Alternatives considered

- **Radix Alert Dialog.** It would add a dependency for what the existing native dialogue pattern already does; `Modal` deliberately stays native (Alpha 30).
- **Asking in place everywhere.** Fine for one row in a list, but it reads differently in each place and does not stop the rest of the page being used mid-question.
