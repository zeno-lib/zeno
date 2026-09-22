# `@zeno-lib/docs`: Intent

Public Fumadocs documentation site. Inherits root conventions; this file covers what's specific to the app.

## Purpose & Scope

Next.js 16 App Router site that renders MDX content from `content/docs/`, exposes a search API, an OG image route, and LLM-friendly content dumps. Runs on **port 5002** in dev (`next dev -p 5002`).

**Owns:** the site's routes, layouts, marketing pages under `(home)/`, the docs route at `/docs/[[...slug]]`, MDX component overrides (`mdx-components.tsx`), the layout shell.

**Does NOT own:** UI primitives (use `@zeno-lib/ui`), the documentation content's authoritative source: content is just MDX in `content/docs/`, organised by area.

## Entry Points & Contracts

Routes:

| Path | File | Purpose |
|---|---|---|
| `/` | `src/app/(home)/page.tsx` | Landing |
| `/about`, `/blog`, `/changelog`, `/showcase` | `src/app/(home)/<slug>/page.tsx` | Marketing pages |
| `/docs/<slug>` | `src/app/docs/[[...slug]]/page.tsx` | Fumadocs-rendered MDX |
| `/api/search` | `src/app/api/search/route.ts` | Fumadocs search backend |
| `/llms-full.txt` | `src/app/llms-full.txt/route.ts` | Whole-site context dump for LLMs |
| `/llms.mdx/docs/<slug>` | `src/app/llms.mdx/docs/[[...slug]]/route.ts` | Per-page MDX source for LLMs |
| `/og/docs/<slug>` | `src/app/og/docs/[...slug]/route.tsx` | Per-page OG image |

Content lives at `content/docs/` and is organised into top-level sections: `foundation/`, `core-framework/`, `feature-modules/`, `production/`, `reference/`. Each section has a `meta.json` (Fumadocs section metadata) plus `*.mdx` pages. The Fumadocs source loader is in `src/lib/source.tsx`.

Build pipeline:

```
pnpm types:check  →  next typegen && fumadocs-mdx && tsc --noEmit
pnpm postinstall  →  fumadocs-mdx
```

`fumadocs-mdx` generates a `.source` directory the rest of the codebase imports from. **Plain `tsc --noEmit` will fail without the codegen step**, so always go through the script; don't run `tsc` directly to "skip overhead". Run Fumadocs after `next typegen`; Next's type generation can leave `.source` empty, and the final `fumadocs-mdx` pass restores the collection modules before TypeScript reads them.

## Usage Patterns

Adding a docs page:

1. Create `content/docs/<section>/<slug>.mdx` with Fumadocs frontmatter (`title`, `description`).
2. Update the section's `meta.json` if the page should appear in the sidebar in a specific position.
3. `pnpm dev --filter @zeno-lib/docs` (or `pnpm turbo run dev --filter @zeno-lib/docs`); the codegen runs on save.

Importing a UI primitive inside an MDX page:

```mdx
import { Button } from "@zeno-lib/ui/button"

<Button>Try it</Button>
```

Composing the landing page:

The `/` route is built in a Swiss editorial register: near-monochrome type on a faint 10px square
texture, hairline rules, and a wide centred column (`Shell` in `src/components/home/section.tsx`).
Every section below the fold uses `SectionHeader`: heading left with a mono all-caps label tucked
underneath it, justified body right.

Its signature is `PixelCanvas`, a `<canvas>` pixel field drawn from smooth value noise. It appears
three times at different `seed` values so no two waves repeat. **Colour exists only inside those
canvases and their legend swatches**; every other surface stays on the shared monochrome tokens, so
the landing page never introduces a brand hue into `@zeno-lib/ui`'s registry-distributed theme. The
`--zeno-*` colours and `.zeno-*` classes live in `src/app/(home)/home.css`, imported by the page.

The canvases are interactive. `PixelFieldProvider` holds the highlighted domain; `PixelLegend` and
the rows of `PackageIndex` set it on hover and focus, and every canvas dims the other three colours
in response. Because the painter reads that value through a ref, a context change alone will not
repaint: `PixelCanvas` keeps a `repaintRef` and an effect keyed on `active` to request the frame. If
you refactor the painter, keep that link or hovering will silently stop working.

Brand assets: `src/components/layout/zeno-mark.tsx` is the Zeno mark, a Z drawn on the same square
module as the canvas, filled with `currentColor` so it works in both themes. It sits in the navbar
through `baseOptions().nav.title`. The favicon is `src/app/icon.svg` and the touch icon
`src/app/apple-icon.png` (rasterised from it); Next injects both from the App Router file
conventions, so there is no `<link rel="icon">` to maintain.

Site-wide type lives in `src/app/design-system.css`, imported by `global.css`: `.zeno-label` (the
mono all-caps label used for nav items, section labels and docs wayfinding) and the heading tracking.
Nav items get it through Fumadocs' `links` API in `src/lib/layout.shared.tsx`, not CSS selectors
against Fumadocs' generated class names, which would not survive an upgrade.

The 10px grid texture (`.zeno-page`) backs the canvases only, never type: behind hairline rules it
fought the borders and greyed off the white.

Technology marks live in `public/tech/` (TechIcons, MIT). The folder names describe the BACKGROUND
they are drawn for, not the mark: `on-light/` holds dark tiles for the light theme, `on-dark/` holds
light tiles for the dark theme. They are rasterised to 96px PNGs because the upstream SVGs embed
raster images and run to ~1.2MB for ten marks; see `public/tech/README.md` before re-adding any.

A `Button` whose `render` is a link needs `nativeButton={false}`, otherwise Base UI logs a
button-semantics error at runtime.

`mdx-components.tsx` is the central place to override default MDX renderers. The `Preview` wrapper (`src/components/preview.tsx`) is registered globally and used in the UI primitive pages to host live component examples: drop a `<Preview>...</Preview>` block in any MDX page.

## Anti-patterns

- **Do not commit generated `.source/` output.** It's regenerated by `fumadocs-mdx`.
- **Do not import from `content/docs/` directly**: go through `src/lib/source.tsx` so the loader can build its index. Bypassing it breaks search and the LLM routes.
- **Do not hand-write `meta.json` orderings against autogenerated indices.** Fumadocs treats `meta.json` as authoritative; conflicting `pages` arrays vs. file names lead to silent omissions in the sidebar.
- **Do not introduce a non-Fumadocs MDX pipeline.** The `llms.mdx` and search routes assume Fumadocs's source contract.
- **Form previews import from `@zeno-lib/forms/create-form`, not `@zeno-lib/forms`.** The bare entry is headless (no `useForm`/fields); the batteries-included `create-form` entry re-exports the wired hook + field wrappers the previews (`src/components/forms/*`) need. Field wrappers require an explicit `name` prop (no auto-default).

## Dependencies & Edges

Workspace: `@zeno-lib/ui`, `@zeno-lib/typescript`. Stack: `next@16.2.4`, `react@19.2.5`, `fumadocs-core@16.8.5`, `fumadocs-ui@16.8.5`, `fumadocs-mdx@14.3.2`, `tailwindcss@4`, `zod@4`.

Consumed by: `@zeno-lib/e2e` lists this app as a workspace dep so `turbo run e2e` can build it before booting Playwright (see `packages/e2e/AGENTS.md`).

## Pitfalls

- **Port 5002 is hardcoded** in the dev script and assumed by `packages/e2e/playwright.config.ts` (`webServer.command` runs `npm run start -- -p 5002`). Changing the port here also requires updating the e2e config.
- **`postinstall` runs `fumadocs-mdx`**: every fresh `pnpm install` triggers codegen. If you see stale `.source` issues after pulling, re-run `pnpm install` or `pnpm exec fumadocs-mdx`.
- **`types:check` chains three commands** (`next typegen && fumadocs-mdx && tsc --noEmit`). If type errors look like missing modules from `.source` or `.next/types`, you skipped one of the codegen steps or ran them in the wrong order.
- **The TanStack devtools must stay browser-only.** `@tanstack/devtools-ui` imports `use` from
  `solid-js/web`, and only the browser builds export it; Next's app-ssr layer resolves the node build
  and the dev compile dies with `Export use doesn't exist in target module`. `src/components/devtools.tsx`
  therefore pulls `src/components/devtools-panel.tsx` through `next/dynamic` with `ssr: false`. Do not
  collapse those two files back into a static import; all three `@tanstack/devtools*` packages are
  already at their latest versions, so there is no upgrade that fixes it.
- **MDX components live in `src/mdx-components.tsx`** at the app root, not under `src/components/`: Fumadocs convention. Don't move it.
