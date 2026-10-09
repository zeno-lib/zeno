---
"@zeno-lib/forms": minor
---

`FormDialog` takes three new options:

- `saveFromPrompt` adds Save to the unsaved-changes prompt, next to Discard.
  It submits, and closes the dialog if the submit succeeds. If it fails, the
  prompt closes, the dialog stays open, and focus moves to the first invalid
  field. Its label is `discardPrompt.saveLabel`, which defaults to
  `submitLabel`.
- ⌘/Ctrl+Enter submits from anywhere in the dialog, a textarea included, but
  not while the prompt is open.
- `disabled` turns off Save and the shortcut, and wraps the `<form>` in a
  `<fieldset disabled>` that disables its native controls. Checkbox, switch,
  radio and slider fields draw their own controls, so pass them `disabled`
  too.

`useLeaveGuard` takes an `onSave` that resolves whether it saved, and returns
`saveAndLeave()` and `isSaving`, so other editors can offer Save in their own
confirm UI. `@zeno-lib/forms/lib/focus-first-invalid` also exports
`findFirstInvalid`.

Re-add the `form-dialog` item with the shadcn CLI to pick this up.
