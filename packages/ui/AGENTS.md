# `@zeno-lib/ui`

**Private, never published.** The workspace mirror of the shadcn primitives, the
[shadcn monorepo](https://ui.shadcn.com/docs/monorepo) `packages/ui`, so Zeno's packages, the docs
app and the tests share one copy. End users add primitives from shadcn directly and the tokens with
`shadcn add zeno-lib/zeno/theme`.

## Rules

- **Always Base UI.** `components.json` pins `base-nova`, and Zeno's packages and registry items are
  written against Base UI's APIs. Never switch to the Radix or default style.
- **No barrel.** Import each file by its path (`@zeno-lib/ui/button`).
- **Imports inside the package are relative** (`../lib/utils`, `./button`). The package has no
  tsconfig path aliases by design.
- **No domain logic.** A `Form` primitive may belong here; a `LoginForm` does not.
- **`src/styles/theme.css` is the single source of the token values.** `pnpm registry:build` derives
  the `theme` registry item from it.
- **Other packages reference it through `workspace:^` in `devDependencies` or optional peers**, never
  as a published runtime dependency.

## Traps

- **The Biome rules relaxed for `packages/ui/src/**` are deliberate** (`useFocusableInteractive`,
  `useKeyWithClickEvents`, `noNestedComponentDefinitions`, `useExhaustiveDependencies` and others).
  Primitives trip them legitimately. When a new rule fires, check for a primitive-pattern false
  positive before refactoring.
- **`Button`'s `default` variant only darkens on hover when rendered as an anchor**
  (`[a]:hover:bg-primary/80`). A real `<button>` doesn't change on hover.
- **`src/types.ts` is excluded from Biome** at the root, so give a generated types file that name.
