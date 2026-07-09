/**
 * Generates the per-package `registry.json` files consumed by the shadcn GitHub registry
 * (`pnpm dlx shadcn@latest add zeno-lib/zeno/<item>`).
 *
 * Zeno ships only value-add via the registry — the shadcn primitives themselves are installed
 * by the end user from shadcn directly. See `AGENTS.md` and the building-ui docs.
 *
 * For every registry item the generator follows the entry file's relative imports to collect a
 * self-contained file set, writes transformed copies under `packages/<pkg>/registry/**` (intra
 * imports stay relative; `@zeno-lib/ui/*` and workspace imports are rewritten to shadcn-canonical
 * aliases / npm packages), and records npm `dependencies` + bare shadcn `registryDependencies`.
 *
 * Run with: `pnpm registry:build`. Output is deterministic so `git diff --exit-code` in CI fails
 * when source changes without regenerating.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"
import ts from "typescript"
import {
  ASSUMED_PRESENT,
  DEP_OVERRIDES,
  SHADCN_COMPONENTS,
  SKIP,
} from "./registry.overrides"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const REGISTRY_ITEM_SCHEMA = "https://ui.shadcn.com/schema/registry.json"

type CssVars = Record<string, string>

type RegistryFile = {
  path: string
  type: string
  target?: string
}

type RegistryItem = {
  name: string
  type: string
  title?: string
  description?: string
  dependencies?: string[]
  devDependencies?: string[]
  registryDependencies?: string[]
  files?: RegistryFile[]
  cssVars?: { theme?: CssVars; light?: CssVars; dark?: CssVars }
  css?: Record<string, unknown>
}

// --------------------------------------------------------------------------- theme

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
  return {
    cssVars: {
      dark: sortKeys(declarations(block(css, ".dark"))),
      light: sortKeys(declarations(block(css, ":root"))),
      theme: sortKeys(theme),
    },
    description:
      "Zeno's design tokens (emerald primary, stone gray scale) and radius scale. Add this after `shadcn init`, then follow the setup docs to wire up `tw-animate-css` and the responsive base styles.",
    devDependencies: ["tw-animate-css"],
    name: "theme",
    title: "Zeno theme",
    type: "registry:theme",
  }
}

// ------------------------------------------------------------------- source blocks

/** Resolve a relative import specifier from a source file to an on-disk `.ts`/`.tsx` file. */
function resolveRelative(fromFile: string, spec: string): string | null {
  const base = join(dirname(fromFile), spec)
  for (const candidate of [
    `${base}.tsx`,
    `${base}.ts`,
    join(base, "index.tsx"),
    join(base, "index.ts"),
  ]) {
    if (existsSync(candidate)) {
      return candidate
    }
  }
  return null
}

/** Top-level package name of a bare specifier (handles `@scope/pkg/deep`). */
function topLevelPackage(spec: string): string {
  const parts = spec.split("/")
  return spec.startsWith("@") ? `${parts[0]}/${parts[1]}` : parts[0]
}

type Transformed = {
  text: string
  deps: Set<string>
  registryDeps: Set<string>
  relativeImports: string[]
}

type SpecAction = {
  relative?: boolean
  replaceTo?: string
  dep?: string
  registryDep?: string
}

/**
 * Classify one import specifier for registry distribution. Intra-package (relative) imports are
 * preserved; `@zeno-lib/ui/*` maps to shadcn-canonical aliases (with a bare shadcn registry dep);
 * `@zeno-lib/*` workspace + third-party packages become npm dependencies (kept verbatim).
 */
function classifySpec(spec: string): SpecAction {
  if (spec.startsWith(".")) {
    return { relative: true }
  }
  if (spec === "@zeno-lib/ui/lib/utils") {
    return { replaceTo: "@/lib/utils" }
  }
  if (spec === "@zeno-lib/ui/sonner") {
    // Zeno's sonner re-exports `toast`; shadcn's base-nova sonner exports only `Toaster`.
    // Import `toast` from the `sonner` package; keep the `sonner` registry dep for `<Toaster />`.
    return { dep: "sonner", registryDep: "sonner", replaceTo: "sonner" }
  }
  if (spec === "@zeno-lib/ui/icons" || spec.startsWith("@zeno-lib/ui/icons/")) {
    return { dep: "lucide-react", replaceTo: "lucide-react" }
  }
  if (spec.startsWith("@zeno-lib/ui/hooks/")) {
    return { replaceTo: `@/hooks/${spec.slice("@zeno-lib/ui/hooks/".length)}` }
  }
  if (spec.startsWith("@zeno-lib/ui/")) {
    const name = spec.slice("@zeno-lib/ui/".length)
    const shadcn = SHADCN_COMPONENTS.has(name)
    return {
      registryDep: shadcn ? name : `zeno-lib/zeno/${name}`,
      replaceTo: `@/components/ui/${name}`,
    }
  }
  if (spec.startsWith("@zeno-lib/")) {
    return { dep: topLevelPackage(spec) } // @zeno-lib/supabase, @zeno-lib/forms — kept verbatim
  }
  const pkg = topLevelPackage(spec)
  if (ASSUMED_PRESENT.has(pkg) || pkg.startsWith("node:")) {
    return {}
  }
  return { dep: pkg }
}

/** Rewrite one source file's imports for registry distribution and collect its dependencies. */
function transformFile(absPath: string): Transformed {
  let text = readFileSync(absPath, "utf8")
  const deps = new Set<string>()
  const registryDeps = new Set<string>()
  const relativeImports: string[] = []

  const specs = ts
    .preProcessFile(text, true, true)
    .importedFiles.map((f) => f.fileName)
  for (const spec of specs) {
    const action = classifySpec(spec)
    if (action.relative) {
      relativeImports.push(spec)
    }
    if (action.replaceTo) {
      text = text
        .split(`"${spec}"`)
        .join(`"${action.replaceTo}"`)
        .split(`'${spec}'`)
        .join(`'${action.replaceTo}'`)
    }
    if (action.dep) {
      deps.add(action.dep)
    }
    if (action.registryDep) {
      registryDeps.add(action.registryDep)
    }
  }
  return { deps, registryDeps, relativeImports, text }
}

type BlockConfig = {
  name: string
  entry: string // path relative to package src, e.g. "sign-in/index.tsx"
  type?: string
  title?: string
  description?: string
  targetPrefix: string // consumer subdir under the components alias, e.g. "auth"
}

type BlockAcc = {
  deps: Set<string>
  registryDeps: Set<string>
  files: RegistryFile[]
  queue: string[]
}

/** Transform one file, write its registry copy, and fold its contributions into the accumulator. */
function collectFile(
  abs: string,
  srcDir: string,
  outDir: string,
  targetPrefix: string,
  acc: BlockAcc
): void {
  const result = transformFile(abs)
  for (const d of result.deps) {
    acc.deps.add(d)
  }
  for (const r of result.registryDeps) {
    acc.registryDeps.add(r)
  }

  const rel = relative(srcDir, abs)
  const outPath = join(outDir, rel)
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, result.text)
  acc.files.push({
    path: join("registry", rel),
    target: `@components/${targetPrefix}/${rel}`,
    type: "registry:component",
  })

  for (const spec of result.relativeImports) {
    const resolved = resolveRelative(abs, spec)
    if (resolved) {
      acc.queue.push(resolved)
    }
  }
}

/**
 * Build one self-contained block: BFS the entry's relative-import graph, transform each reachable
 * file, and emit transformed copies under `packages/<pkg>/registry/**` preserving structure so the
 * preserved relative imports keep resolving in the consumer.
 */
function buildBlock(pkgDir: string, config: BlockConfig): RegistryItem {
  const srcDir = join(ROOT, pkgDir, "src")
  const outDir = join(ROOT, pkgDir, "registry")
  const acc: BlockAcc = {
    deps: new Set(),
    files: [],
    queue: [join(srcDir, config.entry)],
    registryDeps: new Set(),
  }
  const seen = new Set<string>()

  while (acc.queue.length > 0) {
    const abs = acc.queue.shift() as string
    if (seen.has(abs)) {
      continue
    }
    seen.add(abs)
    collectFile(abs, srcDir, outDir, config.targetPrefix, acc)
  }

  for (const extra of DEP_OVERRIDES[config.name] ?? []) {
    acc.deps.add(extra)
  }

  return {
    dependencies: [...acc.deps].sort(),
    description: config.description,
    files: acc.files.sort((a, b) => a.path.localeCompare(b.path)),
    name: config.name,
    registryDependencies: [...acc.registryDeps].sort(),
    title: config.title,
    type: config.type ?? "registry:block",
  }
}

// --------------------------------------------------------------------------- output

function prune(item: RegistryItem): RegistryItem {
  const out = item as Record<string, unknown>
  for (const key of [
    "dependencies",
    "devDependencies",
    "registryDependencies",
  ]) {
    if (Array.isArray(out[key]) && (out[key] as unknown[]).length === 0) {
      delete out[key]
    }
  }
  return item
}

function writeRegistry(pkgDir: string, items: RegistryItem[]): void {
  const sorted = items
    .filter((i) => !SKIP.has(i.name))
    .map(prune)
    .sort((a, b) => a.name.localeCompare(b.name))
  const out = { $schema: REGISTRY_ITEM_SCHEMA, items: sorted }
  writeFileSync(
    join(ROOT, pkgDir, "registry.json"),
    `${JSON.stringify(out, null, 2)}\n`
  )
  process.stdout.write(
    `wrote ${pkgDir}/registry.json (${sorted.length} items)\n`
  )
}

const AUTH_FLOWS: BlockConfig[] = [
  {
    description: "Magic-link and password sign-in flow.",
    entry: "sign-in/index.tsx",
    name: "sign-in",
    targetPrefix: "auth",
    title: "Sign in",
  },
  {
    description: "Sign-up flow.",
    entry: "sign-up/index.tsx",
    name: "sign-up",
    targetPrefix: "auth",
    title: "Sign up",
  },
  {
    description: "Confirmation screen shown after a magic link is sent.",
    entry: "email-sent/index.tsx",
    name: "email-sent",
    targetPrefix: "auth",
    title: "Email sent",
  },
  {
    description: "OTP / magic-link verification screen.",
    entry: "verify/index.tsx",
    name: "verify",
    targetPrefix: "auth",
    title: "Verify",
  },
  {
    description: "Auth error screen.",
    entry: "error/index.tsx",
    name: "error",
    targetPrefix: "auth",
    title: "Auth error",
  },
  {
    description: "Request a password recovery email.",
    entry: "recover-password/index.tsx",
    name: "recover-password",
    targetPrefix: "auth",
    title: "Recover password",
  },
  {
    description: "Set a new password from a recovery link.",
    entry: "reset-password/index.tsx",
    name: "reset-password",
    targetPrefix: "auth",
    title: "Reset password",
  },
  {
    description: "Sign-out control.",
    entry: "sign-out/index.tsx",
    name: "sign-out",
    targetPrefix: "auth",
    title: "Sign out",
  },
  {
    description: "Auth layout shell + AuthProvider.",
    entry: "layout.tsx",
    name: "auth-layout",
    targetPrefix: "auth",
    title: "Auth layout",
  },
]

function main(): void {
  // packages/ui: no primitives (all vanilla shadcn — installed from shadcn directly). Ships the theme.
  writeRegistry("packages/ui", [buildThemeItem()])

  // packages/authentication: flow blocks (UI). The server-only confirm handler stays on npm.
  rmSync(join(ROOT, "packages/authentication/registry"), {
    force: true,
    recursive: true,
  })
  writeRegistry(
    "packages/authentication",
    AUTH_FLOWS.map((c) => buildBlock("packages/authentication", c))
  )
}

main()
