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

The `/` route is built in a Swiss editorial register: near-monochrome type on hairline rules, set in a
wide centred column (`Shell` in `src/components/home/section.tsx`). Every section below the fold uses
`SectionHeader`: heading left with a mono all-caps label tucked underneath it, justified body right.

The three visual slots (hero, package diagram, closing) are `TodoBlock` placeholders
(`src/components/home/todo-block.tsx`): a labelled hatch that admits the artwork is missing, rather
than decoration that reads as finished. Whatever replaces them, the last block on the page keeps
`closesPage`; see the rule markers below.

**Colour exists only on the `PackageIndex` domain icons** (`.zeno-ink` plus one of
`.zeno-d`/`u`/`i`/`q`); every other surface stays on the shared monochrome tokens, so the landing page
never introduces a brand hue into `@zeno-lib/ui`'s registry-distributed theme. The `--zeno-*` colours
and `.zeno-*` classes live in `src/app/(home)/home.css`, imported by the page.

Brand assets: `src/components/layout/zeno-logo.tsx` is the lockup, the mark plus the wordmark, filled
with `currentColor` so it works in both themes. It is both the navbar and the sidebar title, through
`baseOptions().nav.title`. The mark is a Z on an 8x8 module (a seven-cell top bar flush left, two
two-cell steps, a seven-cell bottom bar flush right), drawn as four solid rects on 2.5-unit cells;
the same drawing fills `src/app/icon.svg`, so redraw both together. The wordmark is `ZENO` in caps on
the label's 0.14em tracking, pinned with `textLength` because set free it measures almost exactly the
width the viewBox leaves it and a fallback font would push its last glyph past the edge, where the SVG
clips. The favicon is `src/app/icon.svg` and the touch icon `src/app/apple-icon.png` (rasterised from
it at 180px); Next injects both from the App Router file conventions, so there is no `<link rel="icon">`
to maintain.

Site-wide type lives in `src/app/design-system.css`, imported by `global.css`: `.zeno-label` (the
mono all-caps label used for nav items, section labels and docs wayfinding) and the heading tracking.
Nav items get it through Fumadocs' `links` API in `src/lib/layout.shared.tsx`, not a selector against
Fumadocs' generated class names. Where Fumadocs hardcodes a class and exposes no API for it
(`rounded-full` on the search pills, `bg-fd-secondary/50` on the search fields) the CSS matches that
class token exactly; those two rules are the first to check after a Fumadocs upgrade.

`.zeno-*` classes that paint a surface sit in `@layer components`, so a utility on the same element
still wins (`hover:bg-fd-muted/60` over `.zeno-surface`). `.zeno-label` is the deliberate exception:
unlayered, because it has to beat the `text-sm` that `Button` and `TabsTrigger` set on themselves.
That also means its size cannot be overridden, so never pair it with a font-size utility.

Rule crossings are marked from `src/components/home/rule-dot.tsx`, which owns the one 3px square
marker the whole page uses. `RuleDot` masks a square of clear space around itself and is only safe
inside a single surface (a grid cell corner). `RuleJunction` is for a crossing on a seam, where no
single mask colour is right on both sides: it clears the rules themselves, one pixel each, painted in
`--zeno-dot-ring` (set by `.zeno-surface`, inherited otherwise). Two sharp edges. Call sites offset
by half a pixel (`-top-[0.5px]`, not `-top-px`) so the marker centres on the rule's middle rather
than its edge. And a junction's tick runs 68px past the rule, so the last one on the page needs
`TodoBlock`'s `closesPage`, or it adds that much scroll below the block the page should end on.

Those grids clear their own edge rules with `nth-child(Nn)` plus an index compared against the first
cell of the last row, never a literal `nth-child(N)` or `nth-last-child(-n+N)`: the arrays behind them
are meant to grow, and a literal index quietly starts marking the wrong cell one entry later.
When a grid changes column count at more than one breakpoint, scope every edge rule to its own range
(`md:max-lg:[&:nth-child(3n)]`, then `lg:[&:nth-child(5n)]`): a bare `md:` variant still fires at
`lg` and clears the wrong column. The junction dots follow the same ranges through
`ruleJunctionVisibility` in `rule-dot.tsx`.

Technology marks live in `public/tech/`, taken verbatim from [gilbarbara/logos](https://github.com/gilbarbara/logos)
(CC0-1.0, the set behind Iconify's `logos:`) and renamed after the `STACK` entry that uses them. A mark
whose black element would disappear on a dark tile ships a hand-recoloured `<stem>-dark.svg` twin
beside it, flagged by `darkIcon` in `STACK`; only `nextjs` and `turborepo` need one. They are painted
as background images through `--zeno-mark` / `--zeno-mark-dark` rather than `<img>` tags swapped with
`dark:hidden`, because a browser fetches an image element even while it is `display: none` and the
pair would download both variants for every visitor. **Don't go back to TechIcons**: seven of its
eight marks are a base64 PNG inside an `<svg>` wrapper, so they are raster whatever the extension
says, and this grid alone would carry ~0.9MB of them.

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
- **`DocsLayoutHeaderTabs` has to stay controlled.** The `line` variant draws its underline from
  `data-active`, which Base UI sets only on the tab matching `Tabs`' `value`. The triggers render as
  links, so no click ever updates that value: it comes from the pathname. Drop the `value` prop and
  no tab is active, which loses the underline *and* leaves every trigger at `tabindex="-1"`, putting
  the section tabs out of reach of the keyboard.
- **MDX components live in `src/mdx-components.tsx`** at the app root, not under `src/components/`: Fumadocs convention. Don't move it.
