# `@zeno-lib/forms`: Intent

A thin, type-safe layer over [TanStack Form](https://tanstack.com/form) + Zod. Inherits root conventions; this file documents the npm/registry split and the invariants you can't infer from one file.

## Purpose & Scope

Typed form composition: a `schema` prop drives validation, default values, and the required
indicator; field wrappers give type-safe `name`s; a submit button wires loading state.

**Distribution split (the key invariant).** The package is cut by the workspace rule "renders
shadcn primitives (`@/components/ui/*`) → registry; UI-free → npm":

- **npm (`.` + `./lib/*` + `./tanstack`)**: the headless core: `createZenoForm` (the factory),
  the `lib/*` logic (validation, schema, contexts, aria, `use-is-invalid`, `form-dom`),
  `Form`/`FormProvider`.
  None import shadcn primitives.
- **Registry (`shadcn add zeno-lib/zeno/create-form`)**: the 15 shadcn-based field components,
  the button fields, `validation-spinner`, `required-indicator`, and the `create-form` composition
  root. These drop into the user's repo under `@/components/form/*`.

**Owns:** the form factory + validation logic (npm), the field components + `create-form` wiring
(registry). **Does NOT own:** the primitives the fields render (shadcn), the app's routes/layout.

## Entry Points & Contracts

| Import | Provides |
|---|---|
| `@zeno-lib/forms` | `createZenoForm`, `Form`, `FormProvider`, `useFieldContext`/`useFormContext`, `useIsInvalid`, `ValidationError`, `applyValidationError`, `blurThenChangeLogic`: all UI-free |
| `@zeno-lib/forms/lib/*` | the individual headless modules (fields resolve `contexts`/`aria`/`use-is-invalid` here) |
| `@zeno-lib/forms/tanstack` | re-export of `@tanstack/react-form` |
| `@zeno-lib/forms/create-form` | **batteries-included opt-in**: the pre-wired `useForm`/`useAppForm`/`withForm`/fields. Its source is registry-shaped: it imports primitives as `@/components/ui/*` (not `@zeno-lib/ui`), so a consumer needs those aliases + local shadcn primitives. The docs app imports from here (backed by tsconfig `paths`); end users normally own this file via the registry. |

`createZenoForm({ fieldComponents, formComponents })` runs `createFormHook` + builds a **generic**
`useAppFields` (per-field prop types are inferred from the injected components) + the schema-aware
`useForm`, and returns them. `create-form.tsx` is the composition root: it injects the dropped-in
fields and is what the registry ships.

Behavioural contracts the factory and fields share:

- **Field-name syntax is TanStack's** (`members[0].name`). `lib/schema-required.ts` records
  required paths in that syntax with indices normalised to `[0]`, and `isFieldRequired` normalises
  the looked-up name via `toRequiredPathKey`, so one entry covers every array row. The probe
  descends into required objects/arrays using `issue.expected` (`"object"`/`"array"`).
- **Submit-invalid focus** (`focusOnSubmitInvalid`, default `true`): the factory chains after any
  user `onSubmitInvalid` and focuses the first `[aria-invalid="true"]` inside the form's own DOM
  node. `<Form>` registers that node (`lib/form-dom.ts`, keyed by `form.store`); without `<Form>`
  nothing is focused. Focus is deferred a macrotask so fields have re-rendered.
- **Every registry field** puts `data-field={field.name}` + `data-invalid` on its `<Field>` root and
  `aria-invalid={isInvalid || undefined}` on its focusable control (or the group root, whose first
  focusable child then gets focus). Keep both on any new field.

## Usage Patterns

```tsx
"use client"
import { Form, FormProvider, useForm } from "@zeno-lib/forms/create-form" // or your ejected copy
import { z } from "zod"

const form = useForm({ schema: z.object({ email: z.email() }), onSubmit })
const { EmailField, SubmitButton } = form
// <EmailField name="email" /> (see Anti-patterns re: name)
```

## Anti-patterns

- **`name` is required on every field wrapper**, including `EmailField`/`PasswordField`. The old
  auto-default (`name` defaulting to `"email"`/`"password"`) was dropped when the factory became
  generic; the generic `useAppFields` can't know per-field default names. Always pass `name`.
- **The registry-source fields ship verbatim**, so their imports are the consumer's:
  `@/components/ui/*` for primitives, `@/lib/utils`, and `@zeno-lib/forms/lib/*` for the headless
  core (which stays on npm). `pnpm registry:build` only regenerates the `registry.json` manifest,
  not file copies. Keep new field imports in this dialect; `@/*` resolves in-workspace via tsconfig
  `paths` to `packages/ui/src`.
- **Don't import field impls into the npm `.` entry.** It must stay UI-free: pulling a field (which
  imports `@zeno-lib/ui`) into `index.ts` would drag the primitives into the headless bundle.

## Dependencies & Edges

npm deps: `@tanstack/react-form`, `@tanstack/react-form-nextjs` (pinned to the same 1.33.x; subscribe
with `useSelector`, `useStore` is deprecated). Peers: `next`, `react`, `react-dom`, `zod`, plus the
devtools pair (`@tanstack/react-devtools`, `@tanstack/react-form-devtools`) marked optional in
`peerDependenciesMeta`: no source imports them, the docs just suggest them. `@zeno-lib/ui` is a
devDependency only (never a peer: it's private, so a `workspace:^` peer would publish as a bogus
unresolvable range) (the `@/components/ui/*` / `@/lib/utils` alias target that
tsconfig `paths` resolve to `packages/ui/src` for in-workspace typecheck/tests); no published entry
imports it directly anymore. Consumers of `./create-form` (npm) or the registry drop-in supply their
own `@/components/ui/*` primitives instead.

Consumed by: `@zeno-lib/docs` (via `./create-form`); end users via the registry.

## Pitfalls

- **`lib/required-indicator.tsx` (visual) is bundled into the registry block**, so the fields import
  it with a *relative* path (`../lib/required-indicator`), whereas the headless `lib/*.ts` modules
  are imported as `@zeno-lib/forms/lib/*` to keep them on npm. That relative-vs-bare split in the
  source is what decides bundled-vs-npm; the generator just follows the relative imports.
- **`create-form.tsx` self-imports `@zeno-lib/forms`** (for `createZenoForm`) and the fields
  self-import `@zeno-lib/forms/lib/*` (for the headless core). In-workspace these resolve via the
  package `exports` map to `src/**`; in the registry drop-in they're the npm package. Keep them
  importing the public entry, not relative paths into the factory/lib.
- **Type tests (`*.test-d.ts`) pin the field DX** (name required, per-field prop inference). Update
  them in lockstep with any factory type change.
