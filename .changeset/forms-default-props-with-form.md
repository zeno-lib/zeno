---
"@zeno-lib/forms": minor
---

Set an app's defaults for the kit once, rather than wrapping fields or editing
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
