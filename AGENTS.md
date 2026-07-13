# AGENTS.md

## Project Overview

Zeno is a Turborepo monorepo containing shared packages and applications for building modern web applications with React, Next.js, and TypeScript.

## Workspace

This file is the **root of an [Intent Layer](https://intent-systems.com/blog/intent-layer)**: a hierarchy of small `AGENTS.md` files placed at semantic boundaries so agents load high-signal local context (purpose, contracts, anti-patterns, sharp edges) before touching code. This file holds workspace-wide conventions and inherits *down* into every package; per-package nodes hold their own invariants and inherit conventions *up* from here. Don't duplicate facts across nodes: put them at the shallowest node that covers all relevant paths.

Linked entries below have a leaf node: open it before working in that area. Each leaf uses the same six sections (Purpose & Scope, Entry Points & Contracts, Usage Patterns, Anti-patterns, Dependencies & Edges, Pitfalls) so you can pattern-match across the workspace; copy that template when adding a new package with non-trivial invariants. Config-only packages (`typescript/`, `test/`) deliberately have no node; their config files are self-documenting and a node would only repeat them.

- `apps/`
  - [`docs/`](apps/docs/AGENTS.md): Documentation site (Next.js + Fumadocs) on port 5002
- `packages/`
  - [`ui/`](packages/ui/AGENTS.md): `@zeno-lib/ui` **private** workspace mirror of shadcn `base-nova` primitives (end users get these from shadcn directly)
  - [`schema/`](packages/schema/AGENTS.md): `@zeno-lib/schema` pure Drizzle table → Zod schema helpers
  - [`authentication/`](packages/authentication/AGENTS.md): `@zeno-lib/authentication` npm `confirm` handler + registry-distributed Supabase auth flows (read before touching `verify/` or `email-sent/`)
  - [`forms/`](packages/forms/AGENTS.md): `@zeno-lib/forms` headless form factory (npm) + registry-distributed field kit + `create-form`
  - [`supabase/`](packages/supabase/AGENTS.md): `@zeno-lib/supabase` SSR client + middleware
  - [`db/`](packages/db/AGENTS.md): `@zeno-lib/db` Drizzle ORM client + schema + migrations + RLS
  - [`e2e/`](packages/e2e/AGENTS.md): `@zeno-lib/e2e` Playwright suite
  - `typescript/`: shared `tsconfig` presets
  - `test/`: shared Vitest config

### Keeping the Intent Layer current

Update the relevant `AGENTS.md` in the same change as the code when you:

- add, remove, or rename a public export, route, env var, or workspace dep that the node documents
- change an invariant, contract, or anti-pattern (e.g. relax a guard, alter a redirect path, change a hook's behaviour)
- discover a pitfall the node doesn't yet capture
- add a package with non-trivial invariants → create a new leaf using the six-section template and add a downlink to the tree above
- delete or merge a package → remove its node and its downlink

Don't update the node for mechanical refactors, formatting, or implementation details that don't affect contracts. If you're unsure whether a change crosses the line, err on the side of updating; stale nodes are worse than verbose ones. A node entry that names a specific file path, export, or flag is a *claim* that it exists; if you broke that claim, fix the node.

## Distribution

Zeno ships UI two ways, split by a single rule: **a source file that renders shadcn primitives (imports `@/components/ui/*`) is UI-coupled and ships via the shadcn registry; UI-free code stays on npm.**

- **Primitives** come from **shadcn directly**; Zeno does not re-publish them. `@zeno-lib/ui` is a private workspace mirror for internal use + tests, and the alias target the registry-source packages resolve `@/components/ui/*` / `@/lib/utils` to (via tsconfig `paths`).
- **Registry** (`shadcn add zeno-lib/zeno/<item>`, no namespace, direct GitHub addresses): the `theme`, the auth flows, and the forms field kit + `create-form`. The registry-distributed source under `packages/*/src/**` is authored in the shadcn consumer dialect (`@/components/ui/*`, `@/lib/utils`, `@zeno-lib/forms/lib/*`, `sonner`) and served **verbatim** (GitHub serves each file straight from `src/`). `pnpm registry:build` only regenerates the manifests: `registry.json` (root) + `packages/*/registry.json`, which are excluded from Biome. There are no generated file copies.
- **npm**: `@zeno-lib/supabase` (whole), `@zeno-lib/authentication` (`confirm` only), `@zeno-lib/forms` (headless factory + `lib/*` logic; `./create-form` is a batteries-included opt-in entry).

See [`apps/docs/.../building-ui/installation`](apps/docs/content/docs/core-framework/building-ui/installation.mdx) for the consumer-facing guide.

## Commands

| Command | What it does |
|---|---|
| `pnpm install` | Install workspace deps. Triggers `fumadocs-mdx` codegen via `apps/docs` postinstall. |
| `pnpm dev` | Run every package's dev task in parallel (docs serves on port 5002). |
| `pnpm build` | Build everything (`turbo build`). |
| `pnpm types:check` | Run `tsc --noEmit` across the graph (the docs app runs `next typegen` + `fumadocs-mdx` first). |
| `pnpm test` / `pnpm test:watch` | Run / watch Vitest. `test` depends on `build` and `lint`. Some specs (e.g. `@zeno-lib/db`'s RLS integration test) connect to a real local Supabase, so start it first (`pnpm --filter @zeno-lib/db dev`). |
| `pnpm e2e` / `pnpm e2e:watch` | Run / watch Playwright. Requires `pnpm exec playwright install --with-deps` once in `packages/e2e/`. |
| `pnpm lint` / `pnpm lint:fix` | Ultracite check / autofix. |
| `pnpm changeset` | Create a release note for publishable packages under `packages/`. |
| `pnpm registry:build` | Regenerate the shadcn registry manifests (`registry.json` + `packages/*/registry.json`) from source via `scripts/build-registry.ts`. Run after editing any registry-distributed source; CI checks it's in sync. |
| `pnpm prerelease:beta:enter` / `pnpm prerelease:beta:exit` | Enter or leave Changesets beta prerelease mode for test publishes. |
| `pnpm version-packages` | Apply pending Changesets and update package versions/changelogs (with commit links via `@changesets/changelog-git`). |
| `pnpm release` | Publish the pending package releases to npm. |
| `pnpm ci` | Full pre-PR pipeline: `lint → types:check → build → test → e2e` (CI starts local Supabase before running, since `test` includes DB-backed specs). |

Scope a command to one package with `pnpm turbo run <task> --filter <pkg-name>` (e.g. `--filter @zeno-lib/docs`).

## Formatting

Ultracite (Biome under the hood) enforces formatting and most lint rules. **Don't hand-format**; `pnpm lint:fix` autofixes. In Cursor, `.cursor/hooks.json` runs `pnpm dlx ultracite fix` automatically after every file edit, so file content visible right after a write may already differ from what was written.

## Security

Use `.env` files for local overrides. Never commit secrets.
