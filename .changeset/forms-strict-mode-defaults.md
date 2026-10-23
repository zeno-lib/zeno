---
"@zeno-lib/forms": patch
---

`useForm` now keeps the new `defaultValues` its caller passes when React Strict Mode renders twice.
Before, a `FormDialog` opened with `open({ defaultValues })` in development showed empty fields and saved empty values.
