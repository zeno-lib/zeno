import { defineConfig } from "tsdown"

export default defineConfig({
  clean: true,
  dts: true,
  // The npm entries only. `create-form`, `form-dialog`, the fields and `lib/required-indicator`
  // are registry source in the consumer dialect (`@/components/ui/*`) and are not built.
  entry: [
    "src/index.ts",
    "src/tanstack.ts",
    "src/lib/*.ts",
    "!src/lib/*.test.ts",
    "!src/lib/*.test-d.ts",
  ],
  // Peers and TanStack stay bare specifiers: a bundled second copy of React or TanStack Form would
  // give the form and field contexts a different identity from the app's.
  external: [
    /^@tanstack\//,
    /^next(\/|$)/,
    /^react(\/|$)/,
    /^react-dom(\/|$)/,
    /^zod(\/|$)/,
  ],
  tsconfig: "tsconfig.build.json",
  // One output file per source module, so each keeps its own `"use client"` directive and
  // `lib/contexts` exists once, however many entries reach it.
  unbundle: true,
})
