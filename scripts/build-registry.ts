/**
 * Generates the per-package `registry.json` files consumed by the shadcn GitHub registry
 * (`pnpm dlx shadcn@latest add zeno-lib/zeno/<item>`).
 *
 * Zeno ships only value-add via the registry — the shadcn primitives themselves are installed
 * by the end user from shadcn directly. See `AGENTS.md` and the building-ui docs.
 *
 * Run with: `pnpm registry:build`
 *
 * Output is deterministic (sorted keys, sorted/deduped arrays) so `git diff --exit-code` in CI
 * fails when source changes without regenerating.
 */

import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")

const REGISTRY_ITEM_SCHEMA = "https://ui.shadcn.com/schema/registry.json"

type CssVars = Record<string, string>

type RegistryItem = {
  name: string
  type: string
  title?: string
  description?: string
  dependencies?: string[]
  devDependencies?: string[]
  registryDependencies?: string[]
  files?: { path: string; type: string; target?: string }[]
  cssVars?: { theme?: CssVars; light?: CssVars; dark?: CssVars }
  css?: Record<string, unknown>
}

/** Extract the body of the first top-level `<selector> { ... }` block, brace-balanced. */
function block(css: string, selector: string): string | null {
  const start = css.indexOf(selector)
  if (start === -1) {
    return null
  }
  const open = css.indexOf("{", start)
  if (open === -1) {
    return null
  }
  let depth = 0
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") {
      depth++
    } else if (css[i] === "}") {
      depth--
      if (depth === 0) {
        return css.slice(open + 1, i)
      }
    }
  }
  return null
}

/** Parse `--key: value;` declarations from a CSS block body into a name→value map (no `--`). */
function declarations(body: string | null): CssVars {
  const out: CssVars = {}
  if (!body) {
    return out
  }
  for (const raw of body.split(";")) {
    const line = raw.trim()
    if (!line.startsWith("--")) {
      continue
    }
    const colon = line.indexOf(":")
    if (colon === -1) {
      continue
    }
    const key = line.slice(2, colon).trim()
    const value = line.slice(colon + 1).trim()
    if (key && value) {
      out[key] = value
    }
  }
  return out
}

function sortKeys(vars: CssVars): CssVars {
  return Object.fromEntries(
    Object.entries(vars).sort(([a], [b]) => a.localeCompare(b))
  )
}

/**
 * Derive the `theme` registry item from `packages/ui/src/styles/theme.css`:
 *   `:root` → cssVars.light, `.dark` → cssVars.dark, `@theme` + `@theme inline` → cssVars.theme.
 * Carries `tw-animate-css` and Zeno's custom base rules (responsive root font-size + dark variant).
 */
function buildThemeItem(): RegistryItem {
  const css = readFileSync(
    join(ROOT, "packages/ui/src/styles/theme.css"),
    "utf8"
  )
  const theme = {
    ...declarations(block(css, "@theme inline")),
    ...declarations(block(css, "@theme ")),
  }
  const light = declarations(block(css, ":root"))
  const dark = declarations(block(css, ".dark"))

  return {
    css: {
      "@custom-variant dark": "(&:is(.dark *))",
      "@import": "tw-animate-css",
      "@layer base": {
        html: {
          "@apply":
            "text-[15px] sm:text-[15.5px] md:text-[16px] lg:text-[16.5px] xl:text-[17px]",
        },
      },
    },
    cssVars: {
      dark: sortKeys(dark),
      light: sortKeys(light),
      theme: sortKeys(theme),
    },
    description:
      "Zeno's design tokens (emerald primary, stone gray scale), radius scale, dark mode, and animations. Add this after `shadcn init` to match Zeno's look.",
    devDependencies: ["tw-animate-css"],
    name: "theme",
    title: "Zeno theme",
    type: "registry:theme",
  }
}

function writeRegistry(pkgDir: string, items: RegistryItem[]): void {
  const sorted = items
    .filter((i) => !i.name.startsWith("_"))
    .sort((a, b) => a.name.localeCompare(b.name))
  const out = { $schema: REGISTRY_ITEM_SCHEMA, items: sorted }
  const path = join(ROOT, pkgDir, "registry.json")
  writeFileSync(path, `${JSON.stringify(out, null, 2)}\n`)
  process.stdout.write(
    `wrote ${pkgDir}/registry.json (${sorted.length} items)\n`
  )
}

function main(): void {
  // packages/ui: no primitives (all are vanilla shadcn — installed from shadcn directly).
  // Ships only the theme setup item, plus any Zeno-original primitive (currently none).
  writeRegistry("packages/ui", [buildThemeItem()])
}

main()
