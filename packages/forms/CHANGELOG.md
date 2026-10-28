# @zeno-lib/forms

## 0.10.1

### Patch Changes

- 8b5653b: Lint fixes for Biome 2.6 and Ultracite 8, with no change in behavior: regular expressions
  take the `u` flag and a capture group nothing reads is gone.

## 0.10.0

### Minor Changes

- e0df074: Field hints. `withRule(builder, refinement, hint)` takes a hint for the form field that edits the column, and `percentage()` and `year()` give one: `{ field: "percentage", scale }` and `{ field: "year" }`. `defineTableSchema` registers it on the schema the rule returns, in a registry of its own rather than `.meta()`, so `z.toJSONSchema` leaves it out. The kit's `PercentageField` and `YearField` read it from the form's schema, through its wrappers (`.optional()`, `.nullable()`, `.describe()`, `.catch()`, `z.preprocess`), and take `min` and `max` from the schema's own `.min()` and `.max()`, so a refinement that narrows them narrows the field too.
  
  A field bound to such a column needs no `scale`, `min` or `max`. A prop passed to the field wins, and so does one from `defaultProps`: remove `scale`, `min` and `max` from the app-wide `PercentageField` and `YearField` defaults, or they override every column. `PercentageField`'s `allowNegative` now defaults to whether `min` is below 0, and `YearField` takes a negative year when `min` is below 0.
  
  `getFieldHints(field, kind)` in `@zeno-lib/forms/lib/field-hints` reads the hints for a field of your own.
  
  Update `@zeno-lib/forms` first, then re-add the `create-form` item with the shadcn CLI, or carry the change into your own `percentage-field.tsx` and `year-field.tsx`.
- a2429db: A nullable text field holds `null` for no text. `useForm` starts a `z.string().nullable()` field at `null` instead of `""`, and the kit's `InputField` and `TextAreaField` store `null` when such a field is emptied, so a blank field saves as none, as a nullable column stores it, with no `""` to `null` transform. A plain or optional string field still holds `""`. A form that seeds a nullable text field with `row.note ?? ""` should pass `row.note` as it is, or a field typed in and cleared counts as changed.
  
  `getNoTextValue(field)` from `@zeno-lib/forms/lib/empty-value` gives what a text control of your own stores once cleared.
  
  Update `@zeno-lib/forms` first, then re-add the `create-form` item with the shadcn CLI, or carry the change into your own `input-field.tsx` and `textarea-field.tsx`.

## 0.9.1

### Patch Changes

- 4eaf257: `useForm` now keeps the new `defaultValues` its caller passes when React Strict Mode renders twice.
  Before, a `FormDialog` opened with `open({ defaultValues })` in development showed empty fields and saved empty values.

## 0.9.0

### Minor Changes

- 5283db9: A `withForm` section's `form` and a `withFieldGroup`'s `group` carry the
  typed fields, as `useForm`'s form does, so every form writes a field the same
  way:
  
  ```tsx
  const AddressFields = withFieldGroup({
    defaultValues: { city: "", street: "" },
    render: ({ group }) => (
      <>
        <group.InputField label="Street" name="street" />
        <group.InputField label="City" name="city" />
      </>
    ),
  })
  ```
  
  - A group's fields are named relative to the group and typed by its own
    values, so `name` takes `"street"`, never the form's `"billing.street"`.
    Before, each field needed `<group.AppField name="street">{(field) =>
    <field.InputField />}</group.AppField>`.
  - A section needs no `useAppFields(form)` any more. `useAppFields` stays for a
    form typed some other way.
  - A form from `useAppForm`, which has no named fields, gets them when a
    section renders it. A form from `useForm` keeps its own, so its fields never
    change component.
  - A group passed on as another group's `form` still infers its values.

## 0.8.0

### Minor Changes

- 746e8f3: With a Zod `schema`, a form keeps only the values its schema describes, so an
  edit form can open with a record as read. Before, a row's extra keys (`id`,
  `createdAt`, …) stayed in the form's values, and a `.strict()` schema rejected
  them on every submit with "Unrecognized key", so each form needed a mapper that
  picked the schema's keys.
  
  - `useForm({ defaultValues })` drops the keys the schema doesn't describe, at
    every depth and in every array row, before the schema's own defaults fill
    the keys left out. A `FormDialog` session opened with
    `open({ defaultValues: row })` goes through the same path.
  - `submitAction`'s `reset: true`, or a `reset` function, rebases the form on
    the returned data kept to the form's schema the same way, so a saved row's
    `updatedAt` doesn't fail the next save. `reset: "values"` already had the
    form's shape.
  - An object keeps the keys in its shape, an array maps its element over every
    row, and `optional`, `nullable`, `default`, `prefault`, `nonoptional`,
    `readonly` and a pipe's input (a `.transform`) unwrap. Where the schema
    doesn't say which keys belong (a union, a record, a loose or catchall object,
    `any`, `unknown`) or the value doesn't fit it (`null`, a string where an
    object is expected), the value is kept as is. A key the value lacks stays
    absent.
  - `onSubmit`'s `value` no longer carries keys outside the schema. Its type
    never had them; code that read one anyway (a row's `id`) should read it from
    the record.
  
  Without a schema, or with a non-Zod one, `defaultValues` are used as they are.

### Patch Changes

- 468034d: A submit that throws now shows its `FormError` message even when the user
  edited the form while it ran. Before, `useForm` dropped the failure as stale,
  so the submit button came back with no message, as after a success, though
  nothing was saved. A reset or a newer submit while it runs still drops it,
  now also when a later submit brings the attempt count back to the same number.

## 0.7.1

### Patch Changes

- 92b207c: `FormDialog`'s unsaved-changes prompt no longer outlives its dialog or a
  successful save, and no longer offers a Save that can't work:
  
  - The prompt now closes whenever the dialog does. Before, a dialog closed
    while the prompt was open (a footer Save that succeeded, `dialog.close()`)
    left the prompt over the closed dialog, asking to save or discard changes
    that were already saved, and it showed again on the next open.
  - Cancel, ×, Escape or an outside press while a footer Save is still running
    opens the prompt, as before. If that save succeeds and no field changed
    since, the leave now goes through and the dialog closes, `closeOnSubmit` or
    not. After an edit made during the save, the prompt stays until the user
    answers. If the save fails, the first invalid field gets focus once the
    prompt closes, as with the prompt's own Save.
  - A dialog disabled by its `disabled` or by `useForm({ disabled })` still
    asks before discarding changes, but the prompt it opens is the discard
    one, without Save. A prompt that opened before the dialog became disabled
    keeps its Save, turned off.
  
  Re-add the `form-dialog` item with the shadcn CLI to pick this up.

## 0.7.0

### Minor Changes

- c1943eb: Set an app's defaults for the kit once, rather than wrapping fields or editing
  registry files, and split a large form with `withForm`.
  
  - `createZenoForm({ defaultProps })` sets default props per field or form
    component, keyed by name:
    `defaultProps: { MoneyField: { currency: "CHF", locale: "de-CH" }, PercentageField: { scale: "fraction" } }`.
    A prop passed at the call site wins, and one passed as `undefined` keeps the
    default. Each component's defaults take only its own optional props. They
    apply however the component renders: destructured from `useForm`, from
    `useAppFields`, or as `field.X` inside `form.AppField`. The `create-form`
    item passes an empty `defaultProps` to fill in.
  - `FormDialogProvider`, a new export of the `form-dialog` item, sets the
    default props of every `FormDialog` below it: its copy, `saveFromPrompt`,
    `guard`, `closeOnSubmit` and so on. A prop passed to a dialog wins, and
    `discardPrompt` merges key by key. `FormDialog` now renders the form's own
    `FormError`, so a `FormError` default reaches dialogs too.
  - `discardPrompt` takes `saveTitle` and `saveDescription`, the prompt's copy
    with `saveFromPrompt`, so one provider can word both prompts. They default
    to `title` and `description`.
  - `withForm` accepts the form `useForm` returns, with or without a `schema`.
    Its unset generics now default to what TanStack's own `useForm` infers. As a
    result, without `onSubmitMeta`, `onSubmit`'s `meta` is `unknown` rather than
    `never`.
  - `create-form` exports `useAppFields`, which gives a `withForm` section the
    same typed fields as `useForm`: `const { InputField } = useAppFields(form)`.
  - `DatePickerField`'s calendar icon no longer shows an English "Calendar"
    tooltip.
  
  Update `@zeno-lib/forms` first, then re-add the `create-form` and `form-dialog`
  items with the shadcn CLI: `form-dialog` imports
  `@zeno-lib/forms/lib/default-props`, which older versions don't have.
  Re-adding `create-form` replaces `create-form.tsx`, so carry over any fields
  you added to it.
- e14d9de: A form disables as a whole, `DatePickerField` stores ISO strings, and the
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

## 0.6.0

### Minor Changes

- 8717455: A control the field kit has no field for (a phone input, a star rating, a
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
- 7bd055d: `submitAction` parses the values with the form's own `schema`, so a form that
  submits to a server action no longer passes its schema twice:
  
  ```tsx
  const form = useForm({
    defaultValues,
    onSubmit: (submit) => submitAction(submit, saveAction, { reset: true }),
    schema,
  })
  ```
  
  The action gets the schema's output (trimmed strings, coerced numbers) where it
  used to get the raw values whenever the call left `schema` out. A `schema`
  passed to `submitAction` still replaces the form's, for an action that takes a
  different schema. A form with no `schema` (`useForm` without one, or
  `useAppForm`) still sends its values as they are.

## 0.5.0

### Minor Changes

- 55e3e8c: `FormDialog` moves focus to the first invalid field when Save fails, as
  `<Form>` does, instead of leaving it on the Save button. That covers schema
  errors and the field errors a server action returns through `submitAction`.
  Each dialog session also mounts fresh fields, so state kept inside a field or
  a custom child no longer carries over when the dialog reopens before its close
  animation ends.
  
  `FormDialog` also takes three new options:
  
  - `saveFromPrompt` adds Save to the unsaved-changes prompt, next to Discard.
    It submits, and closes the dialog if the submit succeeds. If it fails, the
    prompt closes, the dialog stays open, and focus moves to the first invalid
    field. Its label is `discardPrompt.saveLabel`, which defaults to
    `submitLabel`.
  - ⌘/Ctrl+Enter submits from anywhere in the dialog, a textarea included, but
    not while the prompt is open.
  - `disabled` turns off Save and the shortcut, and wraps the `<form>` in a
    `<fieldset disabled>` that disables its native controls. Checkbox, switch,
    radio and slider fields draw their own controls, so pass them `disabled`
    too.
  
  The focus logic is now `focusFirstInvalid(formElement)` in
  `@zeno-lib/forms/lib/focus-first-invalid`, for a `<form>` of your own that
  calls `handleSubmit`.
  `useLeaveGuard` takes an `onSave` that resolves whether it saved, and returns
  `saveAndLeave()` and `isSaving`, so other editors can offer Save in their own
  confirm UI.
  
  Update `@zeno-lib/forms` first, then re-add the `form-dialog` item with the
  shadcn CLI: the new item imports `focusFirstInvalid`, which older versions
  don't have.
- 20a5991: A submit that fails without a field error is no longer silent.
  
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

## 0.4.0

### Minor Changes

- 22b64ba: One empty value per field, picked by its schema: the first it accepts of
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
- 4a88f17: `RadioGroupField` stores each item's `value` as is. It converted every value
  with `String()`, so `value={true}` or `value={2}` came back as `"true"` or
  `"2"`. String items are unchanged. With nothing picked, Base UI now gets
  `null` instead of `""`, so an item whose value is `""` no longer shows as
  picked.
- a963b88: A field's required-ness now shapes its control, not only its label. A required
  control gets `aria-required` (the `*` is `aria-hidden`), a required
  `ComboboxField` hides its clear button (an explicit `showClear` still wins),
  and a required `DatePickerField` keeps its date when the selected day is
  picked again. Required-ness comes from the schema even under
  `requiredIndicator: false`, which now hides only the `*`, and the field's
  `required` prop overrides it. Custom fields read it with the new
  `useIsFieldRequiredBySchema`. Re-add the fields with the shadcn CLI to pick
  this up.

### Patch Changes

- 1bab820: Required-field detection no longer marks a bare `z.array()`, or the rows of a
  bare `z.array(z.string())`. The form starts an array at `[]` and a string at
  `""`, and both pass, so neither can fail while untouched. `.min(1)` arrays,
  rows that reject `""` (`z.array(z.email())`) and required row fields
  (`members[0].name`) keep their `*`.
- 862197d: `ComboboxField` and `DatePickerField` take `disabled`. The combobox disables
  its input and buttons, and the date picker its trigger. Neither had a way to
  be disabled before; the date picker's `calendarProps.disabled` only disables
  days.
- 54e886b: `ComboboxField` no longer shows a stored value as raw text when `items` has
  no item for it, such as an id while its options are still loading. With
  `{ value, label }` items the input stays empty until the item arrives, then
  shows its label. A plain string or number item is still its own label.
- 50f08cd: `EmailField` turns off auto-capitalisation, autocorrect and spell check, each
  overridable. `NumberField` sets `inputMode="decimal"` instead of `"numeric"`,
  so phone keypads keep the decimal key, and takes an `inputMode` override
  (`"numeric"` for whole numbers).
- 07a4009: `SelectField` and `DatePickerField` mark the field touched when their popup
  closes, not when it opens. Opening moved focus into the popup, and the
  trigger's blur showed a required field's error while the user was still
  choosing. Leaving the closed trigger still counts, as before.

## 0.3.0

### Minor Changes

- 1729c42: Export TanStack's `useSelector` from `@zeno-lib/forms`, so a component can read
  form state in a hook, for example
  `useSelector(form.store, (state) => state.values.country)`, without depending
  on `@tanstack/react-form` itself. The registry `create-form` re-exports it.

### Patch Changes

- 1af55ea: The registry fields now take their control, description and error ids from
  `useId()` instead of the field name. Two forms on one page with the same field
  name, such as a page form and a dialog form, used to render duplicate ids, so
  the dialog's label focused the page's control and its textbox lost its
  accessible name. `useFormDialog().open({ focus })` now finds the control through
  the field's label. Re-add the fields with the shadcn CLI to pick this up.
- 5e00dac: `zod` is now an optional peer dependency, since the package reads schemas
  through Standard Schema and never imports zod. The unused
  `@tanstack/react-form-nextjs` dependency is gone, along with the
  `decode-formdata` it pulled into every install.
- 063a77a: Required-field detection no longer marks a string field whose schema accepts
  `""`, the value the form starts it at. A bare `z.string()` or
  `z.string().nullable()` can't fail while untouched, so it gets no `*`;
  `z.string().min(1)` and `z.email()` keep theirs.

## 0.2.2

### Patch Changes

- 3c37c5e: `SliderField` renders a `formatValue` readout of `0` in its readout slot. It
  tested the readout for truthiness, so a formatter returning the number `0` left
  a bare "0" without the readout's styling.
- 707eaf0: Lint fixes for Biome 2.5 and Ultracite 7.12, with no behavior change.
  `ActionSchema.parse` and the `RlsTestHarness` members are now declared as
  function-typed properties instead of methods.

## 0.2.1

### Patch Changes

- 2afb8a8: The headless entries (`@zeno-lib/forms`, `@zeno-lib/forms/lib/*` and
  `@zeno-lib/forms/tanstack`) now ship compiled `dist/*.mjs` with `.d.mts` types,
  and `exports` points at them. They used to export `src/*.ts`, which a Next.js
  build fails to load with "Unknown module type" unless the app lists
  `@zeno-lib/forms` in `transpilePackages`. That workaround is no longer needed.
  `./create-form` and `./form-dialog` still export their registry-shaped source.

## 0.2.0

### Minor Changes

- 462b2db: Add the `form-dialog` registry item and its headless hooks on npm (`@zeno-lib/forms/lib/use-form-dialog`: `useFormDialog`, `useLeaveGuard`). `useFormDialog().open({ defaultValues, focus })` starts a session with its own values and initial focus; `FormDialog` submits from a footer button outside the `<form>`, shows a spinner while submitting, closes on success, resets after closing, and asks before discarding unsaved changes (`!isDefaultValue`) on Cancel, ×, Escape or outside press, with a page-unload warning while open. Also exposed as `@zeno-lib/forms/form-dialog`.
- 16711a7: Add `MoneyField`, `PercentageField`, `YearField`, `MultiSelectField` and `CheckboxGroupField` to the `create-form` registry field kit. Money, percentage and year inputs share a new headless, locale-aware number engine on npm (`@zeno-lib/forms/lib/use-formatted-number` and `@zeno-lib/forms/lib/formatted-number`): thousands separators re-inserted while typing with a stable caret, lenient parsing of pasted text, `number | null` values, and clamping on blur. `PercentageField` takes `scale="percent"` (default, `0–100`) or `scale="fraction"` (`0–1`). Bumps `@tanstack/react-form` to 1.33.5.
- 3ee71f2: Add `submitAction(submit, action, { schema?, reset? })` and `applyActionError(formApi, error)` for server actions that return an `ActionResult`, such as `defineFormAction` from `@zeno-lib/db/next` (matched structurally, no dependency). Field errors land on their fields, array paths included; unknown paths and `formErrors` become the form-level error. `schema` parses the input values on the client and passes the output to the action; `reset` rebases the form after a success. Fix `ValidationError`/`applyValidationError`: a server message now clears when its field is edited (it previously stuck until reset), and every message for a field renders, not just the first.

## 0.1.0

### Minor Changes

- 3c117f2: First release of the headless split. `@zeno-lib/forms` on npm is now the UI-free core: `createZenoForm` (the factory that returns `useForm`, `useAppForm`, `useAppFields`, `withForm` and `withFieldGroup` around the field components you inject), `Form`/`FormProvider`, and the `lib/*` modules (validation modes, schema defaults, required-field detection, contexts, `useIsInvalid`, `ValidationError`). The shadcn-based fields, buttons and the `create-form` composition root move to the registry (`shadcn add zeno-lib/zeno/create-form`); `@zeno-lib/forms/create-form` stays as a batteries-included entry that expects local `@/components/ui/*` primitives. `name` is now required on every field, including `EmailField` and `PasswordField`.
  
  Also in this release:
  
  - The required-field indicator now works on nested objects and array rows. Required paths use TanStack Form's field-name syntax (`members[0].name`, not `members.0.name`) and match every row index.
  - `formApi.reset(values)` now sticks: it rebases the defaults until the caller passes deeply different `defaultValues`. Before, TanStack re-applied the caller's original defaults on the next render, which undid a reset-after-save whenever `defaultValues` stayed fixed.
  - After a failed submit, `<Form>` focuses the first `[aria-invalid="true"]` control inside the submitted form (never document-wide), following TanStack Form's focus-management guide.
  - Every registry field renders `data-field={name}` on its `<Field>` root, a stable hook for end-to-end tests. Re-add the fields from the registry to pick it up.
  - `@tanstack/react-form` and `@tanstack/react-form-nextjs` bumped to 1.33.5; internal subscriptions use `useSelector` instead of the deprecated `useStore`.
  - The devtools peers (`@tanstack/react-devtools`, `@tanstack/react-form-devtools`) are optional, and the private `@zeno-lib/ui` workspace package is no longer declared as a peer, so installs don't report bogus peer warnings.

## 0.0.1

### Patch Changes

- 439319c: First npm release
- Updated dependencies [439319c]
  - @zeno-lib/ui@0.0.1
