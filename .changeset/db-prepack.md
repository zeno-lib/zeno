---
"@zeno-lib/db": patch
---

Rebuild on `prepack`, so the published tarball actually contains its `dist`.

**0.3.1 is broken and should not be used.** It carries the `exports` map pointing
at `./dist/*.mjs` but no `dist` directory, so every import of it fails with
`ERR_MODULE_NOT_FOUND`.

`release` is a bare `changeset publish` on a runner that never runs `build`, and
`dist` is gitignored, so nothing put it in the tarball. `prepack` is npm's hook
for exactly this and runs before the tarball is created —
`@zeno-lib/e2e` already does the same.

Verified by deleting `dist` and running `npm pack`: the archive comes back with
all ten `dist` files.
