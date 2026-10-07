import { defineConfig } from "tsdown"

export default defineConfig({
  clean: true,
  // Both are peers. A bundled second copy of `drizzle-orm` would give the
  // generated schemas a different identity from the consumer's tables.
  deps: { neverBundle: [/^drizzle-orm(\/|$)/, /^zod(\/|$)/] },
  dts: true,
  entry: { index: "src/index.ts" },
})
