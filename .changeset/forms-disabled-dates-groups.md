---
"@zeno-lib/forms": minor
---

A form disables as a whole, `DatePickerField` stores ISO strings, and the
combobox fields take grouped options and object values.

- **One disabled state for the form.** `useForm({ disabled })`,
  `<FormProvider disabled>` and `FormDialog`'s `disabled` turn off every kit
  field, and `SubmitButton` and `ResetButton`; `<Form disabled>` does it for
  what it wraps. That now includes the checkbox, switch and radio fields,
  which Base UI draws as spans a `<fieldset disabled>` doesn't reach, so they
  no longer need `disabled` passed one by one. `<Form disabled>` ignores a
  submit, and `useForm({ disabled })` turns off `FormDialog`'s Save as its
  prop does. A field's own `disabled` still applies, and `disabled={false}`
  doesn't enable a field in a disabled form. Each form keeps its own state,
  so a form rendered inside a disabled one stays enabled.
  `useIsFormDisabled()` reads the state for a control of your own;
  `useFieldControl` folds it into `disabled` and returns `isDisabled`. A
  disabled field sets `data-disabled` on its root, which dims its label.
- **`DatePickerField` stores a string with `valueType`.** `"iso-date"` stores
  the day as `YYYY-MM-DD`, for a `date` column; `"iso-datetime"` stores the
  day's local midnight as an ISO 8601 timestamp. The default, `"date"`, still
  stores a `Date`. The field reads a `Date` or either string, whatever
  `valueType` says, and reads `YYYY-MM-DD` as that day in local time, not as
  UTC midnight, which is the day before west of UTC. The calendar opens on the
  selected date's month. The helpers are in `@zeno-lib/forms/lib/date-value`.
- **`ComboboxField` and `MultiSelectField` take groups and object values.**
  Pass `{ label, items }` groups as `items` to show the options under
  headings; plain items beside them show under no heading. For values that
  are objects (`{ kind, id }`), pass `isItemEqualToValue`, as on Base UI's
  Combobox, so a stored value still finds its item once a refetch rebuilds
  the objects. Rebuilt items no longer overwrite what the user types in
  `ComboboxField`, and picking in `MultiSelectField` keeps a stored value
  whose item hasn't loaded yet.
- **A `.nullable()` object field no longer counts as required**, so it loses
  its `*` and `aria-required`, and a combobox over one offers to clear. An
  object the schema lets be absent starts at its empty value (`null` for
  `.nullable()`) when the schema's defaults would only partly fill it, so an
  untouched form no longer fails on a path no field shows.

Update `@zeno-lib/forms` first, then re-add the `create-form` and
`form-dialog` items with the shadcn CLI
(`pnpm dlx shadcn@latest add zeno-lib/zeno/create-form zeno-lib/zeno/form-dialog`):
the updated fields import `@zeno-lib/forms/lib/form-disabled`,
`@zeno-lib/forms/lib/date-value` and `@zeno-lib/forms/lib/item-options`,
which older versions don't have.
