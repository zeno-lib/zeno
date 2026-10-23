---
"@zeno-lib/forms": minor
---

A nullable text field holds `null` for no text. `useForm` starts a `z.string().nullable()` field at `null` instead of `""`, and the kit's `InputField` and `TextAreaField` store `null` when such a field is emptied, so a blank field saves as none, as a nullable column stores it, with no `""` to `null` transform. A plain or optional string field still holds `""`. A form that seeds a nullable text field with `row.note ?? ""` should pass `row.note` as it is, or a field typed in and cleared counts as changed.

`getNoTextValue(field)` from `@zeno-lib/forms/lib/empty-value` gives what a text control of your own stores once cleared.

Update `@zeno-lib/forms` first, then re-add the `create-form` item with the shadcn CLI, or carry the change into your own `input-field.tsx` and `textarea-field.tsx`.
