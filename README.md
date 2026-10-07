# Zeno

Zeno is a Turborepo monorepo of shared packages for building web applications with React, Next.js and TypeScript.

## What's inside?

The repo holds these apps and packages:

### Apps and packages

- `docs`: the Fumadocs documentation site, a [Next.js](https://nextjs.org/) app
- `@zeno-lib/ui`: the private workspace mirror of the shadcn `base-nova` primitives, shared by the Zeno packages, the docs app and the tests
- `@zeno-lib/typescript`: the shared `tsconfig` presets
- `@zeno-lib/supabase`: the Supabase SSR clients and middleware for Next.js
- `@zeno-lib/query`: suspense boundaries, route prefetching and timing presets for TanStack Query
- `@zeno-lib/test`: shared [Vitest](https://vitest.dev/) configs, the Supabase RLS test harness and re-exported testing utilities
- `@zeno-lib/authentication`: the npm `confirm` handler and the registry auth flows
- `@zeno-lib/forms`: the headless form factory (npm) and the registry field kit
- `@zeno-lib/db`: Drizzle clients, schema helpers, the config preset and RLS
- `@zeno-lib/schema`: Drizzle table to Zod schema helpers
- `@zeno-lib/e2e`: the Playwright preset, dependency verifier and API sign-in

Every package and app is written in [TypeScript](https://www.typescriptlang.org/).

### Utilities

The repo comes configured with:

- [TypeScript](https://www.typescriptlang.org/) for static type checking
- [Ultracite](https://www.ultracite.ai/) for linting and formatting

### Build

To build every app and package, run:

```
pnpm build
```

### Develop

To start every app and package in development mode, run:

```
pnpm dev
```

### Release packages

Zeno publishes its packages with [Changesets](https://github.com/changesets/changesets).
`@changesets/changelog-git` generates the changelogs, so each release publishes the text of its changesets with links to the commits it includes.

To publish locally, log in to npm first:

```bash
pnpm login
```

1. Run `pnpm changeset` after changing a publishable package in `packages/`.
2. Write the changeset summary as the release note you want to appear in the changelog, then merge it with your package changes.
3. When the change lands on `main`, the release workflow opens or updates a release PR.
4. The release workflow only proceeds after `pnpm run ci` passes on `main`.
5. Merging that release PR publishes the versioned `@zeno-lib/*` packages with npm [trusted publishing](https://docs.npmjs.com/trusted-publishers) via GitHub Actions OIDC.

#### Publishing a new package

Before GitHub Actions can release a brand-new package:

1. Make sure the package's `package.json` does **not** set `"private": true`.
2. Publish an initial version first, so the package exists on npm and later versions can go through the normal `pnpm release` flow. `0.0.0` is a good default.
3. In npm, open that package and add GitHub Actions [trusted publishing](https://docs.npmjs.com/trusted-publishers) for this repository, so npm accepts future releases from `release.yml`.

Configure trusted publishing in npm for **each** package this repository publishes. Whenever you add a publishable package, open it on npm and add a trusted publisher with:

- GitHub repository: `zeno-lib/zeno`
- Workflow filename: `release.yml`

Useful references:

- [npm trusted publishers](https://docs.npmjs.com/trusted-publishers)
- [Configuring a GitHub Actions trusted publisher](https://docs.npmjs.com/trusted-publishers#for-github-actions)

### Beta publish packages

For a test publish under the `@zeno-lib/*` scope, use a Changesets prerelease so npm gets a beta-tagged version instead of replacing `latest`.

1. Start beta mode with `pnpm prerelease:beta:enter`.
2. Add a changeset with `pnpm changeset` if you changed a publishable package.
3. Apply versions with `pnpm version-packages` to generate versions like `0.0.1-beta.0`.
4. Publish the prerelease with `pnpm release`.
5. When you're done with beta releases, leave prerelease mode with `pnpm prerelease:beta:exit`.

`pnpm prerelease:beta:enter` already sets the prerelease tag to `beta`, so `pnpm release` does **not** pass `--tag beta` again.

Consumers can then install the beta build with `pnpm add @zeno-lib/supabase@beta` or pin the exact prerelease version.

### Remote caching

> [!TIP]
> Vercel Remote Cache is free for all plans. Sign up at [vercel.com](https://vercel.com/signup?/signup?utm_source=remote-cache-sdk&utm_campaign=free_remote_cache).

Turborepo's [Remote Caching](https://turbo.build/repo/docs/core-concepts/remote-caching) shares cache artifacts across machines, so your team and your CI/CD pipelines reuse each other's build caches.

By default, Turborepo caches locally. Remote Caching needs a Vercel account. If you don't have one, [create one](https://vercel.com/signup?utm_source=turborepo-examples), then run:

```
pnpm turbo login
```

This authenticates the Turborepo CLI with your [Vercel account](https://vercel.com/docs/concepts/personal-accounts/overview).

Then link your Turborepo to your Remote Cache by running this from the repo root:

```
pnpm turbo link
```

## Useful links

From the Turborepo docs:

- [Tasks](https://turbo.build/repo/docs/core-concepts/monorepos/running-tasks)
- [Caching](https://turbo.build/repo/docs/core-concepts/caching)
- [Remote Caching](https://turbo.build/repo/docs/core-concepts/remote-caching)
- [Filtering](https://turbo.build/repo/docs/core-concepts/monorepos/filtering)
- [Configuration options](https://turbo.build/repo/docs/reference/configuration)
- [CLI usage](https://turbo.build/repo/docs/reference/command-line-reference)
