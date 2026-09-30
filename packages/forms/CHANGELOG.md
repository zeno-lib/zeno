# @zeno-lib/forms

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
