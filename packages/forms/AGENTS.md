# `@zeno-lib/forms`

A typed layer over [TanStack Form](https://tanstack.com/form) and Zod. The user guide is in
[`components/forms`](../../apps/docs/content/docs/feature-modules/components/forms/index.mdx).

## Distribution rules

- **The npm `.` entry must stay UI-free.** The headless core (`createZenoForm`, `lib/*`, `Form`,
  `FormProvider`) is on npm; the shadcn-based fields, `create-form` and `form-dialog` ship through
  the registry. Importing a field into `index.ts` drags the primitives into the headless bundle.
- **Registry sources ship verbatim, so their imports are the consumer's**: `@/components/ui/*`,
  `@/lib/utils`, and `@zeno-lib/forms/lib/*` for the headless core. Keep new fields in that
  dialect.
- **The import style decides what gets bundled.** `lib/required-indicator.tsx` is visual, so the
  fields import it relatively and the generator bundles it into the block; headless `lib/*.ts`
  modules are imported as `@zeno-lib/forms/lib/*` and stay on npm.
- **`create-form.tsx` and the fields import the public entry** (`@zeno-lib/forms`,
  `@zeno-lib/forms/lib/*`), never relative paths into the factory or `lib/`. `tsc` and Vitest
  resolve them to `src/` through tsconfig `paths`; consumers get `dist/`.
- **Never point an npm entry in `exports` back at `src/`.** The docs app still works, but an
  installed copy fails the consumer's Next build with "Unknown module type".
- **The docs app reads `dist/`, not `src/`.** `pnpm dev` keeps it fresh with `tsdown --watch`;
  outside `pnpm dev`, rebuild after editing an npm entry.
- **Keep `"jsx": "react-jsx"` in `tsconfig.json`.** The shared preset's `preserve` leaves raw JSX in
  the `.mjs` files, and Turbopack fails to parse the client chunk.
- **`@zeno-lib/ui` is a devDependency, never a peer.** It is private, so a `workspace:^` peer would
  publish as an unresolvable range.
- **Subscribe with `useSelector`** (`useStore` is deprecated).
- **Never import `zod` from an npm entry.** It is an optional peer: schemas are read through
  Standard Schema and `_zod` duck typing, and a value import would break apps without zod.

## Contracts every field keeps

- **Every registry field puts `data-field={field.name}` and `data-invalid` on its `<Field>` root, and
  `aria-invalid={isInvalid || undefined}` on its focusable control** (or on the group root, whose
  first focusable child then gets focus). Submit-invalid focus depends on it.
- **Submit-invalid focus is `focusFirstInvalid`** (`lib/focus-first-invalid.ts`), which `<Form>`
  and `FormDialog` call right after `await form.handleSubmit()`. It relies on
  `useSyncExternalStore` flushing `aria-invalid`, `submitAction`'s field errors included, before
  that continuation. Don't add a timer.
- **What a required field does follows `useIsFieldRequiredBySchema`; only the `*` follows
  `useIsFieldRequired`**, and the field's `required` prop overrides both. `useIsFieldRequired`
  is `false` under `requiredIndicator: false`, so using it for `aria-required` or the clear
  button would drop them along with the `*`.
- **A field that can be emptied stores `getEmptyValue(field, fallback)`**
  (`lib/empty-value.ts`), never a hard-coded `undefined` or `null`. The schema
  decides it, as it decides the `*`.
- **Field names use TanStack's syntax** (`members[0].name`). Required paths are stored with indices
  normalised to `[0]`, so one entry covers every array row.
- **Type tests (`*.test-d.ts`) pin the field DX.** Update them with any factory type change.

## Traps

- **`reset(values)` is undone on the next render when `useForm` still gets other
  `defaultValues`.** TanStack re-applies deep-different option defaults on every render while the
  form is untouched. `lib/use-rebased-default-values.ts` handles the plain case; to change a
  mounted form's baseline, change the `defaultValues` you pass (as `useFormDialog` does).
- **`FormDialog` detects unsaved changes with `!state.isDefaultValue`, never `isDirty`**, which stays
  true after an edit is reverted. It resets in `onOpenChangeComplete`, after the exit animation;
  don't `reset` inside the consumer's `onSubmit` either.
- **Never write server errors to `errorMap.onServer`.** `blurThenChangeLogic` never clears it.
  `applyValidationError` writes `errorMap.onChange` and subscribes to the store to clear each entry
  when that field's value first moves.
- **A server message keyed by a name no mounted field registered goes to the form-level error.**
  Otherwise it would render nowhere and still block submit.
- **Don't import `@zeno-lib/db` for `ActionResult`.** It is declared in `lib/action-result.ts` and
  matched structurally by `defineFormAction`; `lib/submit-action.test-d.ts` pins the
  assignability. Change both sides together.
- **The formatted number fields keep their own text state** (`lib/use-formatted-number.ts`), so
  `"12."` survives typing. Their value is `number | null`, unlike `NumberField`'s `undefined`. Tests
  read the Swiss grouping character from `getNumberSeparators("de-CH")`, because the code point
  depends on the runtime's CLDR data.
