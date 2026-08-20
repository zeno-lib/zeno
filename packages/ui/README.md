# @zeno-lib/ui

**Internal package: not published to npm.** This is the monorepo's shared `ui` workspace
package (the [shadcn monorepo](https://ui.shadcn.com/docs/monorepo) `packages/ui`); a Zeno app
always lives in a monorepo, just like this repo. It mirrors the shadcn primitives so Zeno's own
packages (`@zeno-lib/authentication`, `@zeno-lib/forms`), the docs app, and the tests all share
one copy during development.

**Always [Base UI](https://base-ui.com).** `components.json` pins the `base-nova` style, so every
`shadcn add` here installs the Base UI variant. Never switch to the Radix/default style; the
Zeno packages and registry items are written against Base UI's component APIs.

End users do **not** install this package. They add the primitives from shadcn directly
(`pnpm dlx shadcn@latest add button …`) and Zeno's design tokens via
`pnpm dlx shadcn@latest add zeno-lib/zeno/theme`. See the
[Building UI docs](../../apps/docs/content/docs/core-framework/building-ui) for the full setup.

The `theme` registry item is generated from `src/styles/theme.css` by the root
`pnpm registry:build` (see `scripts/build-registry.ts`).

## Prompt to manage updates

```text
In `packages/ui`, run `pnpm dlx shadcn@latest add --all --yes --overwrite` to update the
primitives to the latest version. Then:

1. Fix all import issues starting with `src/` to relative imports (usually replace `src/` with `../`).
2. Fix lint issues by running `pnpm run lint:fix`.
3. Check types with `pnpm run types:check`.
4. Regenerate the theme registry item with `pnpm registry:build` from the repo root.
```

## Issues

`components.json` aliases do not allow relative paths, so some imports need fixing after installs.
