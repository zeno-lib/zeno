---
"@zeno-lib/forms": minor
---

`FormDialog` moves focus to the first invalid field when Save fails, as
`<Form>` does, instead of leaving it on the Save button. That covers schema
errors and the field errors a server action returns through `submitAction`.
Each dialog session also mounts fresh fields, so state kept inside a field or
a custom child no longer carries over when the dialog reopens before its close
animation ends.

The focus logic is now `focusFirstInvalid(formElement)` in
`@zeno-lib/forms/lib/focus-first-invalid`, for a `<form>` of your own that
calls `handleSubmit`.

Re-add the `form-dialog` item with the shadcn CLI to pick this up.
