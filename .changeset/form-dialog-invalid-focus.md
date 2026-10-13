---
"@zeno-lib/forms": minor
---

`FormDialog` moves focus to the first invalid field when Save fails, as
`<Form>` does, instead of leaving it on the Save button. That covers schema
errors and the field errors a server action returns through `submitAction`.
Each dialog session also mounts fresh fields, so state kept inside a field or
a custom child no longer carries over when the dialog reopens before its close
animation ends.

`FormDialog` also takes three new options:

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

The focus logic is now `focusFirstInvalid(formElement)` in
`@zeno-lib/forms/lib/focus-first-invalid`, for a `<form>` of your own that
calls `handleSubmit`.
`useLeaveGuard` takes an `onSave` that resolves whether it saved, and returns
`saveAndLeave()` and `isSaving`, so other editors can offer Save in their own
confirm UI.

Update `@zeno-lib/forms` first, then re-add the `form-dialog` item with the
shadcn CLI: the new item imports `focusFirstInvalid`, which older versions
don't have.
