---
"@zeno-lib/db": minor
"@zeno-lib/schema": minor
"@zeno-lib/forms": minor
---

Field hints. `withRule(builder, refinement, hint)` takes a hint for the form field that edits the column, and `percentage()` and `year()` give one: `{ field: "percentage", scale }` and `{ field: "year" }`. `defineTableSchema` registers it on the schema the rule returns, in a registry of its own rather than `.meta()`, so `z.toJSONSchema` leaves it out. The kit's `PercentageField` and `YearField` read it from the form's schema, through its wrappers (`.optional()`, `.nullable()`, `.describe()`, `.catch()`, `z.preprocess`), and take `min` and `max` from the schema's own `.min()` and `.max()`, so a refinement that narrows them narrows the field too.

A field bound to such a column needs no `scale`, `min` or `max`. A prop passed to the field wins, and so does one from `defaultProps`: remove `scale`, `min` and `max` from the app-wide `PercentageField` and `YearField` defaults, or they override every column. `PercentageField`'s `allowNegative` now defaults to whether `min` is below 0, and `YearField` takes a negative year when `min` is below 0.

`getFieldHints(field, kind)` in `@zeno-lib/forms/lib/field-hints` reads the hints for a field of your own.

Update `@zeno-lib/forms` first, then re-add the `create-form` item with the shadcn CLI, or carry the change into your own `percentage-field.tsx` and `year-field.tsx`.
