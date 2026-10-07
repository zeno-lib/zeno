---
name: update-deps
description: Update every dependency in the monorepo to its latest version and fix what breaks, as one PR batching the trivial updates plus one PR per update that needs a reviewer's attention. Use for the weekly dependency update, or when asked to bump, upgrade or refresh dependencies.
---

# Update dependencies

One PR batches every trivial update; each update that needs a reviewer's attention gets its own.
Every PR is green on `pnpm ci`. A bump that breaks the build is yours to fix: read the changelog,
migrate the code, then open its PR.

## Trivial or needs attention

An update is one package, or a group that moves together (see Traps). It is **trivial** when it
stays on its current major, needs no code change, changes no peer range, and passes `pnpm ci`
alongside the other trivial ones. A GitHub Actions bump is trivial unless its release notes break
an input our workflows use.

Everything else **needs attention**:

- a new major;
- an update that needed any code change to go green;
- a changed `peerDependencies` range, which consumers see;
- a `drizzle-orm` / `drizzle-kit` prerelease bump, or a Supabase CLI bump.

## Steps

1. **Set up.** Fetch `origin/main`, run `pnpm install`, and start Supabase with
   `pnpm --filter @zeno-lib/db dev` (Docker must be running).
2. **Survey and sort.** `pnpm outdated -r` lists the npm updates and `pnpm audit` the advisories.
   For GitHub Actions, compare every `uses:` ref in `.github/workflows/*.yml` with
   `gh api repos/<owner>/<action>/releases/latest --jq .tag_name`. Sort each update as trivial or
   needs attention.
3. **The trivial PR.** On `deps/<YYYY-MM-DD>` off `origin/main`, apply every trivial update in one
   go: `pnpm update -r --latest <pkg>...` (it keeps each specifier's style: an exact pin stays
   exact, a caret stays a caret), plus the Actions bumps. Then run `pnpm registry:build` (it
   re-infers the registry items' npm dependencies), `pnpm lint:fix` and `pnpm ci`. If `pnpm ci`
   fails, bisect the batch, move the culprit to the attention list, and rerun.
4. **One PR per attention update.** Branch each off `origin/main`, not off the trivial branch, so
   the PRs merge in any order: `deps/<package>-<version>`. Read the release notes or migration
   guide, and the `AGENTS.md` of every package that uses it (several record upgrade traps). Bump it,
   migrate the code, then `pnpm registry:build`, `pnpm lint:fix`, and get `pnpm ci` green. If it
   won't go green, open the PR as a draft that says what fails and what you tried.
5. **Changesets, per PR.** A publishable package needs one when its `dependencies` or
   `peerDependencies` change: a patch for a bumped dependency, more if a peer range now excludes
   versions consumers may have. `devDependencies`-only changes need none. Each PR adds its own
   changeset file rather than editing a pending one, so the PRs never conflict over it.
6. **Open the PRs** against `main`, labelled `dependencies`. Start each body with
   `**Next:** review <files>. About <n> minutes.` and a word on the changeset, like the repo's
   other PRs.
   - Trivial: `Update dependencies (<YYYY-MM-DD>)`. The body has one table (package, from, to,
     where), the Actions bumps, and the `pnpm audit` findings fixed and left open.
   - Attention: `Update <package> to <version>`. The body says what changed upstream that
     matters here, what the migration changed and why, and what the reviewer has to decide.
7. **Supersede the last run.** Close the open `dependencies` PRs that the new ones replace (the
   previous trivial batch, and older PRs for the same package), with a comment linking the
   replacement. Leave alone a PR that someone else has pushed commits to.

`pnpm e2e` (part of `pnpm ci`) needs Playwright's browsers; see the root `AGENTS.md`.

## Traps

- **Some packages are one update:**
  - Packages released together, from one upstream repo at one version (`fumadocs-core` and
    `fumadocs-ui`, `react` and `react-dom`), go in the same PR.
  - `drizzle-orm` and `drizzle-kit` are exact prerelease pins, repeated as exact peers in
    `@zeno-lib/db` and `@zeno-lib/schema`. Their `latest` dist-tag can trail the prerelease line, so
    check `npm view drizzle-orm dist-tags` and never step back to an older stable. A bump changes
    the peers, so both packages get a changeset.
  - The Supabase CLI is pinned twice: the `supabase` devDependency of `@zeno-lib/db` and the
    `version` of `supabase/setup-cli` in `.github/workflows/turbo.yml`. After a bump, restart the
    stack on the new CLI (`pnpm exec supabase stop`, then `start`, in `packages/db`) and regenerate
    `src/auth-schema.ts` as `packages/db/AGENTS.md` describes.
  - `@tanstack/react-form` and `@tanstack/react-form-nextjs` stay on the same version.
- **Every PR touches `pnpm-lock.yaml`,** so once one merges, the others conflict. Rebase on
  `main` and run `pnpm install` to regenerate it; never hand-merge the lockfile.
- **A package that dev-depends on its own peer must keep the peer range covering that version**
  (`@zeno-lib/test` peers `vite` and `vitest`). Otherwise, peer ranges are deliberately loose
  (`>=`): never raise a floor just because the dev version moved.
- **Leave alone:** `workspace:` specifiers, `engines.node`, and `@typescript/typescript6`, which
  stays on 6.x because `scripts/build-registry.ts` imports the TypeScript 6 API from it.
- **pnpm itself:** bump `packageManager` in the root `package.json`, then `pnpm install`.
- **Fresh releases are skipped on purpose.** pnpm's `minimumReleaseAge` hides versions younger
  than the threshold. Don't work around it; the update lands next week.
