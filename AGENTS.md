# AGENTS.md

## Project Overview

Zeno is a Turborepo monorepo containing shared packages and applications for building modern web applications with React, Next.js, and TypeScript.

## Workspace

This file is the **root of an [Intent Layer](https://intent-systems.com/blog/intent-layer)** — a hierarchy of small `AGENTS.md` files placed at semantic boundaries so agents load high-signal local context (purpose, contracts, anti-patterns, sharp edges) before touching code. This file holds workspace-wide conventions and inherits *down* into every package; per-package nodes hold their own invariants and inherit conventions *up* from here. Don't duplicate facts across nodes — put them at the shallowest node that covers all relevant paths.

Linked entries below have a leaf node — open it before working in that area. Each leaf uses the same six sections (Purpose & Scope, Entry Points & Contracts, Usage Patterns, Anti-patterns, Dependencies & Edges, Pitfalls) so you can pattern-match across the workspace; copy that template when adding a new package with non-trivial invariants. Config-only packages (`typescript/`, `tailwind/`, `vitest/`) deliberately have no node — their config files are self-documenting and a node would only repeat them.

- `apps/`
  - [`docs/`](apps/docs/AGENTS.md) — Documentation site (Next.js + Fumadocs) on port 5002
- `packages/`
  - [`ui/`](packages/ui/AGENTS.md) — `@zeno-lib/ui` component primitives (Base UI + Tailwind)
  - [`authentication/`](packages/authentication/AGENTS.md) — `@zeno-lib/authentication` Supabase auth flows (read before touching `verify/` or `email-sent/`)
  - [`supabase/`](packages/supabase/AGENTS.md) — `@zeno-lib/supabase` SSR client + middleware
  - [`e2e/`](packages/e2e/AGENTS.md) — `@zeno-lib/e2e` Playwright suite
  - `typescript/` — shared `tsconfig` presets
  - `tailwind/` — shared Tailwind globals
  - `vitest/` — shared Vitest config

### Keeping the Intent Layer current

Update the relevant `AGENTS.md` in the same change as the code when you:

- add, remove, or rename a public export, route, env var, or workspace dep that the node documents
- change an invariant, contract, or anti-pattern (e.g. relax a guard, alter a redirect path, change a hook's behaviour)
- discover a pitfall the node doesn't yet capture
- add a package with non-trivial invariants → create a new leaf using the six-section template and add a downlink to the tree above
- delete or merge a package → remove its node and its downlink

Don't update the node for mechanical refactors, formatting, or implementation details that don't affect contracts. If you're unsure whether a change crosses the line, err on the side of updating — stale nodes are worse than verbose ones. A node entry that names a specific file path, export, or flag is a *claim* that it exists; if you broke that claim, fix the node.

## Commands

| Command | What it does |
|---|---|
| `pnpm install` | Install workspace deps. Triggers `fumadocs-mdx` codegen via `apps/docs` postinstall. |
| `pnpm dev` | Run every package's dev task in parallel (docs serves on port 5002). |
| `pnpm build` | Build everything (`turbo build`). |
| `pnpm changeset:pr` | Generate or update the PR-scoped auto changeset from GitHub Actions metadata and the changed publishable packages under `packages/`. |
| `pnpm types:check` | Run `tsc --noEmit` across the graph (the docs app runs `fumadocs-mdx` + `next typegen` first). |
| `pnpm test` / `pnpm test:watch` | Run / watch Vitest unit tests. `test` depends on `build` and `lint`. |
| `pnpm changeset` | Create a release note for publishable packages under `packages/`. |
| `pnpm e2e` / `pnpm e2e:watch` | Run / watch Playwright. Requires `pnpm exec playwright install --with-deps` once in `packages/e2e/`. |
| `pnpm lint` / `pnpm lint:fix` | Ultracite check / autofix. |
| `pnpm prerelease:beta:enter` / `pnpm prerelease:beta:exit` | Enter or leave Changesets beta prerelease mode for test publishes. |
| `pnpm version-packages` | Apply pending Changesets and update package versions/changelogs (with commit links via `@changesets/changelog-git`). |
| `pnpm release` | Publish the pending package releases to npm. |
| `pnpm ci` | Full pre-PR pipeline: `lint → types:check → build → test → e2e`. |

Scope a command to one package with `pnpm turbo run <task> --filter <pkg-name>` (e.g. `--filter @zeno-lib/docs`).

## Formatting

Ultracite (Biome under the hood) enforces formatting and most lint rules. **Don't hand-format** — `pnpm lint:fix` autofixes. In Cursor, `.cursor/hooks.json` runs `pnpm dlx ultracite fix` automatically after every file edit, so file content visible right after a write may already differ from what was written.

## Security

Use `.env` files for local overrides. Never commit secrets.
