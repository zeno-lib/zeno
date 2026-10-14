---
"@zeno-lib/forms": minor
---

A control the field kit has no field for (a phone input, a star rating, a
color picker) binds in one line, with the kit's layout and wiring, instead of
a copy of a kit field's internals.

- `ControlField`, a new field (`const { ControlField } = form`), renders any
  controlled component through `render`:
  `<ControlField label="Rating" name="rating" render={(control) => <StarRating {...control} />} />`.
  The control gets `id`, `name`, `value`, `onChange(value)`, `onBlur`,
  `disabled`, `aria-labelledby`, `aria-describedby`, `aria-invalid` and
  `aria-required`, typed with the value at `name`. `onChange` stores the
  field's empty value when given an empty one (`null`, `undefined`, `""`,
  `NaN` or `[]`), throws on a change event rather than storing it, and keeps
  its identity across renders. `onBlur` marks the field touched. The field renders the label
  with its `*`, the description, the error and `data-field`, like the others.
- `useFieldControl` (`@zeno-lib/forms/lib/use-field-control`, also exported
  from `@zeno-lib/forms`) is the headless hook behind it. It returns those
  props as `controlProps`, and what a field's layout needs: the control,
  label, description and error ids, `isInvalid`, `isRequired`,
  `showRequiredIndicator` and the errors to show.
- `FieldShell`, a new file in the `create-form` item (also exported from
  `@zeno-lib/forms/create-form`), renders that layout around a control from
  the hook's result, for a field component of your own. `InputField` and
  `TextAreaField` now use both, and render the same markup as before.

Update `@zeno-lib/forms` first, then re-add the `create-form` item with the
shadcn CLI: the new and updated fields import `useFieldControl`, which older
versions don't have.
