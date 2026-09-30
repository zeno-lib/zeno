---
"@zeno-lib/forms": minor
---

First release of the headless split. `@zeno-lib/forms` on npm is now the UI-free core: `createZenoForm` (the factory that returns `useForm`, `useAppForm`, `useAppFields`, `withForm` and `withFieldGroup` around the field components you inject), `Form`/`FormProvider`, and the `lib/*` modules (validation modes, schema defaults, required-field detection, contexts, `useIsInvalid`, `ValidationError`). The shadcn-based fields, buttons and the `create-form` composition root move to the registry (`shadcn add zeno-lib/zeno/create-form`); `@zeno-lib/forms/create-form` stays as a batteries-included entry that expects local `@/components/ui/*` primitives. `name` is now required on every field, including `EmailField` and `PasswordField`.

Also in this release:

- The required-field indicator now works on nested objects and array rows. Required paths use TanStack Form's field-name syntax (`members[0].name`, not `members.0.name`) and match every row index.
- After a failed submit, focus moves to the first `[aria-invalid="true"]` control inside the form's own `<Form>` element (never document-wide). A user `onSubmitInvalid` is still called; pass `focusOnSubmitInvalid: false` to opt out.
- Every registry field renders `data-field={name}` on its `<Field>` root, a stable hook for end-to-end tests. Re-add the fields from the registry to pick it up.
- `@tanstack/react-form` and `@tanstack/react-form-nextjs` bumped to 1.33.5; internal subscriptions use `useSelector` instead of the deprecated `useStore`.
- The devtools peers (`@tanstack/react-devtools`, `@tanstack/react-form-devtools`) are optional, and the private `@zeno-lib/ui` workspace package is no longer declared as a peer, so installs don't report bogus peer warnings.
