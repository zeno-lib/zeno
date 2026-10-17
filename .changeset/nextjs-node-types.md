---
"@zeno-lib/typescript": minor
---

`nextjs.json` now loads Node's types (`types: ["node"]`). TypeScript 6 and
later load no `@types` package unless `types` names it, so a package that
extends `nextjs.json` without a generated `next-env.d.ts`, or an app before its
first build, couldn't see `process` or `node:*` modules. `@types/node` is now an
optional peer dependency: install it where you extend `nextjs.json` or
`node.json`. A Next.js app already has it. If you set `types` yourself, it
replaces the preset's list, so keep `"node"` in it.
