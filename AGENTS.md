# AGENTS.md

Zeno is a Turborepo monorepo of shared packages and applications for building web applications with
React, Next.js and TypeScript.

## Nodes

Each `AGENTS.md` holds the rules and traps for its folder, and nothing else. Your tool may not load
the folder nodes on its own, so **before you change code in a folder, read each `AGENTS.md` between
it and the root.** How to use each package is documented for users in the docs app, under
[`apps/docs/content/docs/`](apps/docs/content/docs/).

- `apps/`
  - [`docs/`](apps/docs/AGENTS.md): the Fumadocs documentation site, on port 5002
- `packages/`
  - [`ui/`](packages/ui/AGENTS.md): `@zeno-lib/ui`, the **private** workspace mirror of shadcn `base-nova` primitives
  - [`schema/`](packages/schema/AGENTS.md): `@zeno-lib/schema`, Drizzle table to Zod schema helpers
  - [`authentication/`](packages/authentication/AGENTS.md): `@zeno-lib/authentication`, the npm `confirm` handler and the registry auth flows
  - [`forms/`](packages/forms/AGENTS.md): `@zeno-lib/forms`, the headless form factory (npm) and the registry field kit
  - [`supabase/`](packages/supabase/AGENTS.md): `@zeno-lib/supabase`, the SSR clients and middleware
  - [`query/`](packages/query/AGENTS.md): `@zeno-lib/query`, the suspense and SSR prefetch boundaries and timing presets
  - [`db/`](packages/db/AGENTS.md): `@zeno-lib/db`, Drizzle clients, schema helpers, the config preset and RLS
  - [`e2e/`](packages/e2e/AGENTS.md): `@zeno-lib/e2e`, the Playwright preset, dependency verifier and API sign-in
  - [`test/`](packages/test/AGENTS.md): `@zeno-lib/test`, the Vitest presets and the Supabase RLS test harness
  - `typescript/`: shared `tsconfig` presets, with no node

**Edit an `AGENTS.md` only for a rule an agent would otherwise get wrong.** That means a trap, an
invariant the code can't express, or a file to copy. Never describe what the code or the docs
already show (exports, signatures, usage), and never record what changed or why a design moved: the
commit, the PR and the changeset hold that. When a change makes a line false, fix or delete the
line. A new package gets a node only once it has traps: a short intro that links its docs page, then
its rules and traps.

## Distribution

Zeno ships UI two ways, split by a single rule: **a source file that renders shadcn primitives
(imports `@/components/ui/*`) is UI-coupled and ships via the shadcn registry; UI-free code stays on
npm.**

- **Primitives** come from **shadcn directly**; Zeno does not re-publish them. `@zeno-lib/ui` is a
  private workspace mirror for internal use and tests, and the alias target the registry-source
  packages resolve `@/components/ui/*` / `@/lib/utils` to (via tsconfig `paths`).
- **Registry** (`shadcn add zeno-lib/zeno/<item>`): the `theme`, the auth flows, the forms field kit
  and `create-form`, `form-dialog`, and `query-error-fallback`. Their source under `packages/*/src/**`
  is written in the shadcn consumer dialect (`@/components/ui/*`, `@/lib/utils`,
  `@zeno-lib/forms/lib/*`, `sonner`) and served **verbatim** from `src/`. `pnpm registry:build`
  only regenerates the manifests (`registry.json` and `packages/*/registry.json`, excluded from
  Biome); there are no generated file copies.
- **npm**: `@zeno-lib/supabase`, `@zeno-lib/test`, `@zeno-lib/e2e`, `@zeno-lib/authentication`
  (`confirm` only), `@zeno-lib/forms` (headless factory and `lib/*`; `./create-form` and
  `./form-dialog` are opt-in entries), `@zeno-lib/query` (its error fallback is the registry item),
  `@zeno-lib/db` and `@zeno-lib/schema`.

**Never commit `dist/`.** Every compiled npm package gitignores it and builds it in `prepack`, which
`changeset publish` and `pnpm pack` both run. In the workspace, Turbo's `dev`, `test:watch`,
`types:check` and `build` depend on `^build`; a package script run outside Turbo
(`pnpm --filter <pkg> test`) on a fresh clone needs `pnpm build` first. `forms`, `query`,
`supabase` and `test` run `tsdown --watch --no-clean` as `dev`. Keep `--no-clean`: their configs set
`clean: true`, which empties `dist/` on every watch rebuild, so the docs app briefly can't resolve
the package.

The consumer-facing guide is
[`building-ui/installation`](apps/docs/content/docs/core-framework/building-ui/installation.mdx).

## Commands

The full list is in [package.json](package.json). The ones with a catch:

| Command | Catch |
|---|---|
| `pnpm install` | Triggers `fumadocs-mdx` codegen through the docs app's `postinstall`. |
| `pnpm test` | Depends on `build` and `lint`. Some specs (such as `@zeno-lib/db`'s RLS integration test) need a local Supabase, so start it first (`pnpm --filter @zeno-lib/db dev`). |
| `pnpm e2e` | Needs `pnpm exec playwright install --with-deps` once in `packages/e2e/`. |
| `pnpm registry:build` | Run after editing any registry-distributed source. CI checks the manifests are in sync. |
| `pnpm changeset` | Add a release note for any change to a publishable package. |
| `pnpm ci` | The full pre-PR pipeline: `lint → types:check → build → test → e2e`. |

Scope a command to one package with `pnpm turbo run <task> --filter <pkg-name>`.

## Formatting

Ultracite (Biome) enforces formatting and most lint rules. **Don't hand-format**; `pnpm lint:fix`
autofixes. In Cursor, `.cursor/hooks.json` runs `pnpm dlx ultracite fix` after every file edit, so a
file can differ from what was just written.

## Testing

**Commit only tests that would catch a regression.** Before committing, delete the ones that helped
you build but guard nothing, because they fail on every intended change and on no bug:

- A test that restates the code: an exact output copied from the implementation, or a value it
  computes from the same constants the code uses.
- A test of a dependency rather than your change: a formatter, Drizzle writing a column, Zod
  rejecting a wrong type.
- A scratch check from development: a render written to look at, or "it is where I put it".

Keep what a reviewer would miss if it broke: a rule, an edge case, a bug you hit, or an outcome the
user asked for.

## Supabase

**Verify Supabase specifics against current docs before trusting training data.** Config options,
APIs and CLI flags drift. Append `.md` to any Supabase docs URL to fetch it as markdown.

## Agent skills

A skill lives in `.agents/skills/<name>/`; `.claude/skills/<name>` is only a relative symlink to it
(`../../.agents/skills/<name>`). Never put a skill's files under `.claude/`. Add a third-party skill
with `npx skills add`, which records it in `skills-lock.json`.

## Security

Use `.env` files for local overrides. Never commit secrets.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
