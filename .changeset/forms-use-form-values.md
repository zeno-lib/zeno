---
"@zeno-lib/forms": minor
---

Add `useFormValues(form)`, which returns the form's current values typed from
the form. It replaces `useSelector(form.store, (state) => state.values)` and
re-renders only when a value changes, not on focus, blur or validation.
