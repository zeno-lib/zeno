# `@zeno-lib/ui` — Intent

Headless React primitives styled with Tailwind. Inherits all root conventions (TypeScript, React 19+, Ultracite). This file covers what's specific to this package.

## Purpose & Scope

A shared component library of ~57 unstyled-but-themed primitives (Button, Dialog, Combobox, Table, Chart, …) consumable by every app and feature package in the workspace.

**Owns:** visual primitives, their variants (`class-variance-authority`), accessibility wiring, theme tokens (`src/styles/theme.css`), `cn` utility, the `useMobile` hook, the `lucide-react`-backed icon set.

**Does NOT own:** business logic, data fetching, auth flows, route layouts, page-level composition. Anything that knows about a domain belongs in a feature package (e.g. `@zeno-lib/authentication`) or an app.

## Entry Points & Contracts

Subpath exports map directly to `src/`:

| Import | Resolves to |
|---|---|
| `@zeno-lib/ui/<name>` | `src/components/<name>.tsx` |
| `@zeno-lib/ui/hooks/<name>` | `src/hooks/<name>.ts` or `.tsx` |
| `@zeno-lib/ui/icons` | `src/icons/index.tsx` |
| `@zeno-lib/ui/icons/<name>` | `src/icons/<name>.tsx` |
| `@zeno-lib/ui/lib/<name>` | `src/lib/<name>.ts` |
| `@zeno-lib/ui/styles/<name>.css` | `src/styles/<name>.css` |

There is **no barrel** — `import { Button } from "@zeno-lib/ui"` will not work, and a barrel must not be added (root convention forbids it for tree-shaking). Always import from the leaf.

Components are built on `@base-ui/react` (not Radix). They follow a predictable shape:
- `data-slot="<component-name>"` attribute on the root element for styling/testing hooks
- Variants via `class-variance-authority` (`cva`) exported alongside the component (e.g. `buttonVariants`)
- `className` composition via `cn` from `./lib/utils` — Tailwind merge-aware
- Render-prop pattern via `render={...}` (Base UI convention) for composing primitives — see `Button` use inside `Dialog`'s close button

Peer deps assumed by consumers: `next >=16`, `react >=19`, `react-dom >=19`, `tailwindcss >=4`, `zod >=4`.

## Usage Patterns

Standard import + variant:

```tsx
import { Button } from "@zeno-lib/ui/button"
import { Dialog, DialogContent, DialogTrigger } from "@zeno-lib/ui/dialog"

<Button size="sm" variant="outline">Action</Button>
```

Composition via Base UI's `render` prop (e.g. button styled as a link):

```tsx
import Link from "next/link"
import { Button } from "@zeno-lib/ui/button"

<Button render={<Link href="/recover-password">Recover password</Link>} variant="link" />
```

Tailwind theme tokens come from the consumer's CSS:

```css
@import "@zeno-lib/ui/styles/theme.css";
```

## Anti-patterns

- **Don't add barrel `index.ts`** — exports are intentionally granular for tree-shaking.
- **Don't move imports inside this package back to `@/...` aliases.** All internal imports are relative (`../lib/utils`, `./button`). The package has no `tsconfig` path aliases by design.
- **Don't add domain logic.** A `LoginForm` component does not belong here; a `Form` primitive might.
- **Don't manually re-order Tailwind classes.** `useSortedClasses` (Biome `nursery`) enforces the order — let the formatter handle it. The rule also recognises `clsx` as a class-string function.

## Dependencies & Edges

Workspace: `@zeno-lib/typescript`, `@zeno-lib/tailwind` (dev only — for the shared globals.css used by consuming apps).

Notable runtime deps: `@base-ui/react` (primitives), `class-variance-authority` (variants), `tailwind-merge` + `clsx` (class composition), `lucide-react` (icons), `recharts` (chart), `embla-carousel-react`, `react-hook-form`, `react-day-picker`, `cmdk`, `vaul`, `sonner`, `next-themes`.

Consumed by: `@zeno-lib/authentication`, `@zeno-lib/docs`, and any future feature package or app.

## Pitfalls

- **`packages/ui/src/**` has Biome rules deliberately relaxed** (see `biome.jsonc` overrides): a11y rules like `useFocusableInteractive`, `useKeyWithClickEvents`, `noNestedComponentDefinitions`, `noDangerouslySetInnerHtml`, etc. are off. This is *intentional* — Base UI / shadcn-style primitives legitimately violate these rules (composed `render` props, prop-spread patterns, slot-based composition). Don't try to "fix" lint silence by changing the rule levels; if a new rule fires, check whether it's a primitive-pattern false positive before refactoring the code.
- **`useExhaustiveDependencies` is off** for the same reason — primitives often capture stable callbacks where the hook lints would force noise.
- **`src/types.ts` is excluded from Biome** at the root (`files.includes`) — if you add a generated/large types file, prefer that name.
- The `Button` component's variant `default` translates `[a]:hover:bg-primary/80` — meaning hover styles are scoped to the case where Button is rendered as an anchor via `render={<Link/>}`. Don't be surprised that `<Button variant="default">` (a real `<button>`) doesn't darken on hover.
