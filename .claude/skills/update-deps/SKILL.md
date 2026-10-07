---
name: update-deps
description: Update every dependency in the monorepo to its latest version, fix what breaks, and open one PR. Use for the weekly dependency update, or when asked to bump, upgrade or refresh dependencies.
---

# Update dependencies

One branch, one PR, `pnpm ci` green. A bump that breaks the build is yours to fix: read the
changelog, migrate the code, then move on. Hold an update back only when the fix is out of reach.

## Steps

1. **Set up.** Work on a branch off an up-to-date `origin/main`: create `deps/weekly-<YYYY-MM-DD>`,
   or keep the fresh branch you were started on. Run `pnpm install`, and start Supabase with
   `pnpm --filter @zeno-lib/db dev` (Docker must be running). Close any open PR titled
   `Weekly dependency update (…)`, with a comment that the new PR replaces it.
2. **Survey.** `pnpm outdated -r` lists the npm updates and `pnpm audit` the advisories. For
   GitHub Actions, compare every `uses:` ref in `.github/workflows/*.yml` with
   `gh api repos/<owner>/<action>/releases/latest --jq .tag_name`, and bump the major tags that
   moved.
3. **Non-major updates first, in one go:** `pnpm update -r --latest <pkg>...` with every package
   whose latest stays on its current major. `--latest` keeps each specifier's style (an exact pin
   stays exact, a caret stays a caret). Run `pnpm ci` once.
4. **Then each major, one at a time.** Read its release notes or migration guide, and the
   `AGENTS.md` of every package that uses it (several record upgrade traps). Bump it, apply the
   migration, and get `pnpm ci` green before the next one. If it won't go green, revert that bump
   and record it as held back, with the failure.
5. **Regenerate and format:** `pnpm registry:build` (it re-infers the registry items' npm
   dependencies), then `pnpm lint:fix`.
6. **Changesets.** A publishable package needs one when its `dependencies` or `peerDependencies`
   change: a patch for a bumped dependency, more if a peer range now excludes versions consumers
   may have. `devDependencies`-only changes need none. If `.changeset/` already holds a pending
   changeset for the package, add to it instead of creating a file.
7. **Commit and open the PR** against `main`, titled `Weekly dependency update (<YYYY-MM-DD>)`.
   The body lists, in this order: majors (with what the migration changed), minors and patches
   (one table), GitHub Actions bumps, held-back updates (with the reason), and `pnpm audit`
   findings left open.

`pnpm e2e` (part of `pnpm ci`) needs Playwright's browsers; see the root `AGENTS.md`.

## Traps

- **Some versions move in lockstep:**
  - `drizzle-orm` and `drizzle-kit` are exact prerelease pins, repeated as exact peers in
    `@zeno-lib/db` and `@zeno-lib/schema`. Their `latest` dist-tag can trail the prerelease line, so
    check `npm view drizzle-orm dist-tags` and never step back to an older stable. A bump changes
    the peers, so both packages get a changeset.
  - The Supabase CLI is pinned twice: the `supabase` devDependency of `@zeno-lib/db` and the
    `version` of `supabase/setup-cli` in `.github/workflows/turbo.yml`. After a bump, restart the
    stack on the new CLI (`pnpm exec supabase stop`, then `start`, in `packages/db`) and regenerate
    `src/auth-schema.ts` as `packages/db/AGENTS.md` describes.
  - `@tanstack/react-form` and `@tanstack/react-form-nextjs` stay on the same version.
- **A package that dev-depends on its own peer must keep the peer range covering that version**
  (`@zeno-lib/test` peers `vite` and `vitest`). Otherwise, peer ranges are deliberately loose
  (`>=`): never raise a floor just because the dev version moved.
- **Leave alone:** `workspace:` specifiers, `engines.node`, and `@typescript/typescript6`, which
  stays on 6.x because `scripts/build-registry.ts` imports the TypeScript 6 API from it.
- **pnpm itself:** bump `packageManager` in the root `package.json`, then `pnpm install`.
- **Fresh releases are skipped on purpose.** pnpm's `minimumReleaseAge` hides versions younger
  than the threshold. Don't work around it; the update lands next week.
