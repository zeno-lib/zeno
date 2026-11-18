# `@zeno-lib/fallow`

The fallow preset, `fallow.jsonc`, which an app extends with `"extends": "npm:@zeno-lib/fallow"`.
The user guide is in
[`dead-code`](../../apps/docs/content/docs/foundation/getting-started/dead-code.mdx).

## Rules

- **Never add an array that an app also writes**, such as `entry`, `ignoreExports`,
  `ignoreDependencies`, `ignorePatterns`, `ignoreFindings`, `overrides`, `duplicates.ignore`,
  `health.ignore` or `boundaries`. fallow's `extends` replaces the preset's array with the app's, so
  the app would drop the preset's entries without a warning. A credit goes in a `framework` plugin,
  and a setting in an object such as `health`, `duplicates` or `rules`, which merge key by key.
- **Credit a file's exports with `usedExports`.** `entryPoints` only makes a file reachable. Under
  `includeEntryExports`, fallow still reports the exports of an entry.
- **Prefix every plugin name with `zeno-`.** fallow keeps one plugin per name, so a preset plugin
  that shares its name with a built-in or with an app's plugin can be dropped.
- **Point apps at root `fallow-plugin-<name>.jsonc` files for their own plugins**, never at
  `.fallow/plugins/`. fallow writes a `.gitignore` of `*` into `.fallow/`, its cache folder, so a
  plugin there never reaches git.
- **Raise `minimumVersion` when a credit or a rule needs a newer fallow.** It is the only version
  guard. Before you drop a credit, check that the minimum version credits the file itself.

## Traps

- **`pnpm fallow` at the root loads your change.** The root `.fallowrc.jsonc` extends this package
  through `npm:`, as an app does. Zeno has no next-intl or image loader, so check those credits in a
  scratch repo: `fallow config` prints the merged config, and `fallow list --plugins` shows which
  `zeno-*` plugins are active.
- **Don't add a `fallow` peer dependency.** `minimumVersion` is the version guard, and pnpm would
  install even an optional peer into this package.
- **`toolingDependencies` doesn't reach the root `package.json`.** fallow applies an external
  plugin's tooling credit to workspace manifests only, so a root devDependency such as
  `@zeno-lib/fallow` itself needs the app's `ignoreDependencies`.
