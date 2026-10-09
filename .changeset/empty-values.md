---
"@zeno-lib/forms": minor
---

One empty value per field, picked by its schema: the first it accepts of
`null`, `undefined` and the type's own (`""` for a string, `[]` for an array).
So `.nullable()` empties to `null`, `.optional()` to `undefined`, and a bare
`z.string()` to `""`.

- Clearing a `ComboboxField`, emptying a `NumberField`, `MoneyField`,
  `PercentageField` or `YearField`, and unpicking a `DatePickerField` store the
  field's empty value, instead of a fixed `undefined` or `null` that the
  schema could reject (a cleared bare-string combobox used to fail
  validation).
- A field that accepts an empty value gets no `*`, so `.nullable()` fields
  (`z.number().nullable()`, `z.uuid().nullable()`) no longer show one, as the
  docs said.
- A field whose schema rejects `""` or `[]` starts at its empty value instead
  (`z.email().optional()` at `undefined`, `z.uuid().nullable()` at `null`), so
  an untouched optional field passes.
- New `getEmptyValue(field, fallback)` in `@zeno-lib/forms/lib/empty-value`
  for custom fields.

Re-add the fields with the shadcn CLI to pick this up.
