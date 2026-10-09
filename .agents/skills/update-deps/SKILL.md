---
name: update-deps
description: Update every dependency in the monorepo to its latest version and fix what breaks, as one batch PR for every routine update plus one PR per update that needs attention (a maintainer decision or a large migration), however many that is. Use for the weekly dependency update, or when asked to bump, upgrade or refresh dependencies.
---

# Update dependencies

One batch PR carries every routine update. Each update that needs attention gets its own PR, one
per update, so a run opens the batch plus as many PRs as there are attention updates (often
none). An update needs attention only when the reviewer has a real decision to make or the
migration is too big to review inside the batch. Every PR is green on `pnpm run ci`. A bump that
breaks the build is yours to fix: read the changelog, migrate the code, and keep it in the batch
unless the fix makes it an attention update.

## Batch or own PR

An update is one package, or a group that moves together (see Traps). **It goes in the batch**,
even when it is a new major, a prerelease, a widened peer range, a Supabase CLI or pnpm bump, or
needs a small migration: a renamed config key or option, a one-line type fix, a config file
following an upstream rename.

**It needs attention, and gets its own PR,** only when:

- the migration is a sweep: it changes code across many files, or rewrites shipped code (npm
  entries or registry sources) beyond a few lines, such as a linter preset that enables new rules;
- it needs a decision only the maintainer can make: turning lint rules off or on, a change to a
  published package's API or types, a peer range narrowed so it excludes versions consumers may
  have, or dropping a supported runtime;
- it can't go green, in which case it opens as a draft that says what fails and what you tried.

## Steps

1. **Set up.** Fetch `origin/main`, run `pnpm install`, and start Supabase with
   `pnpm --filter @zeno-lib/db dev` (Docker must be running). Export
   `SUPABASE_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres`, which CI sets.
2. **Survey and sort.** `pnpm outdated -r` lists the npm updates and `pnpm audit` the advisories.
   For GitHub Actions, compare every `uses:` ref in `.github/workflows/*.yml` with
   `gh api repos/<owner>/<action>/releases/latest --jq .tag_name`. For every major or prerelease,
   read the release notes or migration guide, and the `AGENTS.md` of every package that uses it
   (several record upgrade traps). Sort each update into the batch or its own PR.
3. **The batch.** On `deps/<YYYY-MM-DD>` off `origin/main`, apply every batch update:
   `pnpm update -r --latest <pkg>...`, plus the Actions bumps. Migrate what the release notes
   require. Then run `pnpm registry:build` (it re-infers the registry items' npm dependencies),
   `pnpm lint:fix` and `pnpm run ci`. If it fails, bisect to the culprit and fix it in the batch;
   move it to its own PR only if the fix makes it an attention update.
4. **One PR per attention update.** Branch each off `origin/main`, not off the batch, so the PRs
   merge in any order: `deps/<package>-<version>`. Bump, migrate, `pnpm registry:build`,
   `pnpm lint:fix`, and get `pnpm run ci` green.
5. **Check the lockfile like CI does.** Before pushing, check out each branch's `package.json`
   files, `pnpm-workspace.yaml` and `pnpm-lock.yaml` into an empty directory and run
   `CI=true pnpm install --frozen-lockfile --lockfile-only --ignore-scripts` there.
6. **Changesets.** A publishable package needs one when its `dependencies` or `peerDependencies`
   change, or its shipped code does: a patch for a bumped dependency, more if a peer range now
   excludes versions consumers may have. `devDependencies`-only changes need none. Each PR adds
   its own changeset files rather than editing a pending one, so the PRs never conflict over them.
7. **Open the PRs** against `main`, labelled `dependencies`. Start each body with
   `**Next:** review <files>. About <n> minutes.` and a word on the changesets, like the repo's
   other PRs.
   - Batch: `Update dependencies (<YYYY-MM-DD>)`. The body has one table (package, from, to,
     where), then a short note for each update that needed more than a version bump (a major, a
     prerelease, a migration, a peer range): what changed upstream that matters here and what you
     changed. Then the Actions bumps, and the `pnpm audit` findings fixed and left open.
   - Each attention update: `Update <package> to <version>`. The body says what changed upstream
     that matters here, what the migration changed and why, and what the reviewer has to decide.
8. **Supersede the last run.** Close the open `dependencies` PRs that the new ones replace (the
   previous batch, and older PRs for the same package), with a comment linking the replacement.
   Leave alone a PR that someone else has pushed commits to.

`pnpm e2e` (part of `pnpm run ci`) needs Playwright's browsers; see the root `AGENTS.md`.

## Traps

- **Some packages are one update:**
  - Packages released together, from one upstream repo at one version (`fumadocs-core` and
    `fumadocs-ui`, `react` and `react-dom`), move together.
  - `drizzle-orm` and `drizzle-kit` are exact prerelease pins, repeated as exact peers in
    `@zeno-lib/db` and `@zeno-lib/schema`. Their `latest` dist-tag can trail the prerelease line, so
    check `npm view drizzle-orm dist-tags` and never step back to an older stable. A bump changes
    the peers, so both packages get a changeset.
  - The Supabase CLI is pinned twice: the `supabase` devDependency of `@zeno-lib/db` and the
    `version` of `supabase/setup-cli` in `.github/workflows/turbo.yml`. After a bump, restart the
    stack on the new CLI (`pnpm exec supabase stop`, then `start`, in `packages/db`) and regenerate
    `src/auth-schema.ts` as `packages/db/AGENTS.md` describes.
- **`pnpm ci` is not the pipeline.** It is pnpm's built-in clean install. Run `pnpm run ci`.
- **A green local run can still fail CI's install.** pnpm skips verifying a lockfile that matches
  `node_modules`, so only step 5 catches a lockfile GitHub's frozen install rejects. A
  `pnpm update -r <transitive>` broke an auto-installed peer this way.
- **`pnpm update -r` re-resolves the peers pnpm auto-installs,** such as the `@supabase/supabase-js`
  of `@zeno-lib/authentication`. A latent type error can surface in packages you didn't bump; fix
  it in the batch.
- **`pnpm update -r --latest` can turn an exact pin into a caret** when the package also has a peer
  entry. Recheck the pins it touched.
- **Every PR touches `pnpm-lock.yaml`,** so once one merges, the others conflict. Rebase on
  `main` and run `pnpm install` to regenerate it; never hand-merge the lockfile.
- **A package that dev-depends on its own peer must keep the peer range covering that version**
  (`@zeno-lib/test` peers `vite` and `vitest`). Otherwise, peer ranges are deliberately loose
  (`>=`): never raise a floor just because the dev version moved.
- **turbo owns a block in the root `AGENTS.md`** and rewrites it when an agent runs it. After a
  turbo bump, commit whatever block turbo writes; never opt out with `agentGuidance`.
- **An esbuild postinstall that reports "Expected X but got Y"** means a stale pnpm metadata cache
  dropped its platform binaries: `pnpm cache delete esbuild`, then update again.
- **Leave alone:** `workspace:` specifiers, `engines.node`, and `@typescript/typescript6`, which
  stays on 6.x because `scripts/build-registry.ts` imports the TypeScript 6 API from it.
- **pnpm itself:** bump `packageManager` in the root `package.json`, then `pnpm install`.
- **Fresh releases are skipped on purpose.** pnpm's `minimumReleaseAge` hides versions younger
  than the threshold. Don't work around it; the update lands next week.
