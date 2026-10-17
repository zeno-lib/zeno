# @zeno-lib/typescript

## 1.2.0

### Minor Changes

- 2194aec: `nextjs.json` now loads Node's types (`types: ["node"]`). TypeScript 6 and
  later load no `@types` package unless `types` names it, so a package that
  extends `nextjs.json` without a generated `next-env.d.ts`, or an app before its
  first build, couldn't see `process` or `node:*` modules. `@types/node` is now an
  optional peer dependency: install it where you extend `nextjs.json` or
  `node.json`. A Next.js app already has it. If you set `types` yourself, it
  replaces the preset's list, so keep `"node"` in it.

## 1.1.0

### Minor Changes

- 09a1579: Add `node.json` preset (extends `strictest.json` + `types: ["node"]`) for server-only Node packages that don't need DOM lib types.

## 1.0.0

### Major Changes

- 62ddc1d: First release
