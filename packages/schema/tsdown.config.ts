import { defineConfig } from "tsdown"

export default defineConfig({
  clean: true,
  dts: true,
  entry: { index: "src/index.ts" },
  // Both are peers. A bundled second copy of `drizzle-orm` would give the
  // generated schemas a different identity from the consumer's tables.
  external: [/^drizzle-orm(\/|$)/, /^zod(\/|$)/],
})
