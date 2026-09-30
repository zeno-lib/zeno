---
"@zeno-lib/forms": minor
---

Add the `form-dialog` registry item and its headless hooks on npm (`@zeno-lib/forms/lib/use-form-dialog`: `useFormDialog`, `useLeaveGuard`). `useFormDialog().open({ defaultValues, focus })` starts a session with its own values and initial focus; `FormDialog` submits from a footer button outside the `<form>`, shows a spinner while submitting, closes on success, resets after closing, and asks before discarding unsaved changes (`!isDefaultValue`) on Cancel, ×, Escape or outside press, with a page-unload warning while open. Also exposed as `@zeno-lib/forms/form-dialog`.
