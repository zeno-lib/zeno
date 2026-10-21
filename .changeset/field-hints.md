---
"@zeno-lib/db": minor
"@zeno-lib/forms": minor
---

Field hints. The rules of `percentage()` and `year()` carry their scale and bounds as `.meta({ field, scale, min, max })`, and the kit's `PercentageField` and `YearField` read them from the form's schema, through the `.optional()` and `.nullable()` wrappers that drop `.meta()`. A field bound to such a column needs no `scale`, `min` or `max`, so the app-wide default props for them can go. A prop passed to the field still wins. `PercentageField`'s `allowNegative` now defaults to whether `min` is below 0.

`getFieldHints(field, kind)` in `@zeno-lib/forms/lib/field-hints` reads the hints for a field of your own.

Update `@zeno-lib/forms` first, then re-add the `create-form` item with the shadcn CLI, or carry the change into your own `percentage-field.tsx` and `year-field.tsx`.
