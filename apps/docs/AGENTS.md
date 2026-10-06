# `@zeno-lib/docs`

The public Fumadocs site, on port 5002. Content is MDX under `content/docs/`, one folder per section,
each with a `meta.json`.

## Build and content rules

- **Run `pnpm types:check`, never plain `tsc`.** It chains `next typegen && fumadocs-mdx && tsc
  --noEmit`, in that order, because `next typegen` can leave `.source` empty. Errors about missing
  `.source` or `.next/types` modules mean a skipped or reordered step.
- **Never commit `.source/`.** `fumadocs-mdx` regenerates it, including on every `pnpm install`.
- **Read content through `src/lib/source.tsx`**, never from `content/docs/` directly, or search and
  the LLM routes break.
- **`meta.json` is authoritative.** A `pages` array that disagrees with the file names silently drops
  pages from the sidebar.
- **Keep the Fumadocs MDX pipeline.** The `llms.mdx` and search routes assume its source contract.
- **`src/mdx-components.tsx` stays at the app root**, by Fumadocs convention.
- **Form previews import from `@zeno-lib/forms/create-form`**, not the headless `@zeno-lib/forms`.
- **Port 5002 is also hardcoded in `packages/e2e/playwright.config.ts`.** Change both together.

## Component traps

- **A `Button` whose `render` is a link needs `nativeButton={false}`**, or Base UI logs a
  button-semantics error.
- **`DocsLayoutHeaderTabs` must stay controlled.** The triggers are links, so the active `value`
  comes from the pathname. Without it no tab is active, the underline disappears and every trigger
  drops to `tabindex="-1"`.
- **`.zeno-label` is deliberately unlayered** to beat the `text-sm` that `Button` and `TabsTrigger`
  set, so its size can't be overridden. Never pair it with a font-size utility. Every other
  `.zeno-*` surface class sits in `@layer components`.
- **The search pill and search field rules in `src/app/design-system.css` match Fumadocs' hardcoded
  class tokens** (`rounded-full`, `bg-fd-secondary/50`). Check them first after a Fumadocs upgrade.

## Landing page traps

- **Colour exists only on the `PackageIndex` domain icons** (`.zeno-ink` and `.zeno-d`/`u`/`i`/`q`
  in `src/app/(home)/home.css`). Never add a brand hue to `@zeno-lib/ui`'s registry theme.
- **`src/components/layout/zeno-logo.tsx` and `src/app/icon.svg` draw the same mark**, so redraw
  both together, and rasterise `apple-icon.png` from the SVG. The wordmark is pinned with
  `textLength`, or a fallback font pushes its last glyph past the clip edge.
- **The last `RuleJunction` on the page needs `TodoBlock`'s `closesPage`**, or its 68px tick adds
  scroll below the final block. `RuleDot` is only safe inside a single surface, and call sites
  offset by half a pixel (`-top-[0.5px]`).
- **Grid edge rules use `nth-child(Nn)` against the first cell of the last row**, never a literal
  index, because the arrays grow. When columns change at several breakpoints, scope each rule to its
  range (`md:max-lg:[&:nth-child(3n)]`, then `lg:[&:nth-child(5n)]`); `ruleJunctionVisibility` in
  `rule-dot.tsx` follows the same ranges.
- **Technology marks in `public/tech/` paint as `--zeno-mark` background images**, not `<img>`
  tags, because a hidden image still downloads. Marks come from gilbarbara/logos (CC0); only
  `nextjs` and `turborepo` need a `-dark.svg` twin. Don't go back to TechIcons, whose marks are
  base64 PNGs.
