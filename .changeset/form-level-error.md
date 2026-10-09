---
"@zeno-lib/forms": minor
---

A submit that fails without a field error is no longer silent.

- `FormError`, a new form component (`const { FormError } = form`), shows the
  form-level error as a `role="alert"` message styled like a field error: the
  `formErrors` an action returns through `submitAction`, a `ValidationError`'s
  `formError`, or "Something went wrong. Try again." when `onSubmit` throws.
  `submitErrorMessage` rewords that last one, and a function gets what was
  thrown. `<Form>` doesn't render it, so place it next to your submit button.
- `<Form>` and `FormDialog` record a thrown submit with `setSubmitError`, and
  `useSubmitError` reads it (`@zeno-lib/forms/lib/submit-error`). It stays out
  of the form's error map, so the form stays valid and the user can retry, and
  it clears on the next edit or submit.
- `FormDialog` renders `FormError` between the fields and the footer, and
  takes `submitErrorMessage`.
- After a failed submit with no invalid field to focus, `<Form>` and
  `FormDialog` keep focus where it was. Disabling the submit button for the
  submit drops its focus in browsers, so they give it back.

Re-add the `create-form` and `form-dialog` items with the shadcn CLI to pick
this up.
