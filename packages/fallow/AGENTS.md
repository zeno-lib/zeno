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
- **Raise `minimumVersion` when a credit or a rule needs a newer fallow.** It is the only version
  guard. Before you drop a credit, check that the minimum version credits the file itself.

## Traps

- **Zeno doesn't install or run fallow**, so nothing in CI loads the preset. Check a change in a
  scratch repo that extends `fallow.jsonc` by a relative path: `fallow config` prints the merged
  config, and `fallow list --plugins` shows which `zeno-*` plugins are active.
- **Never declare `fallow` as a peer dependency, even an optional one.** pnpm installs it, so Zeno
  would install fallow. `minimumVersion` stops an older fallow at load instead.
- **`toolingDependencies` doesn't reach the root `package.json`.** fallow applies an external
  plugin's tooling credit to workspace manifests only, so a root devDependency such as
  `@zeno-lib/fallow` itself needs the app's `ignoreDependencies`.
