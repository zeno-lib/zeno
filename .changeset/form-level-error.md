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
- `useForm` records what `onSubmit` throws, whatever submits the form, and
  `useSubmitError` reads it (`@zeno-lib/forms/lib/submit-error`, with
  `setSubmitError` for a failure outside `onSubmit`). It stays out of the
  form's error map, so the form stays valid and the user can retry, and it
  clears on the next edit, reset or submit. A Next.js `redirect()` or
  `notFound()` is not an error.
- `<Form>` and `FormDialog` still catch what `onSubmit` throws, but now pass
  it to `reportError`, so it reaches the console and error monitoring.
- `FormDialog` renders `FormError` between the fields and the footer, and
  takes `submitErrorMessage`. If your dialog's fields render the form-level
  error themselves, remove that, or it shows twice.
- After a submit that throws, `<Form>` and `FormDialog` keep focus where it
  was: disabling the submit button for the submit drops its focus in
  browsers, so they give it back. A form-level message keeps `SubmitButton`
  disabled until the next edit, so focus can't go back to it there.

Re-add the `create-form` and `form-dialog` items with the shadcn CLI to pick
this up.
