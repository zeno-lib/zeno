import { defineConfig } from "tsdown"

export default defineConfig({
  clean: true,
  dts: true,
  entry: {
    "auth-schema": "src/auth-schema.ts",
    config: "src/config.ts",
    errors: "src/errors.ts",
    index: "src/index.ts",
    next: "src/next.ts",
    query: "src/query.ts",
    schema: "src/schema.ts",
    triggers: "src/triggers.ts",
  },
  // Every one of these is a peer dependency, so it must stay a bare specifier:
  // the consumer owns the installation, and bundling a second copy of
  // `drizzle-orm` would give schema entities a different identity from the ones
  // the consumer's own Drizzle Kit sees.
  external: [
    /^@supabase\//,
    /^drizzle-kit(\/|$)/,
    /^drizzle-orm(\/|$)/,
    /^postgres(\/|$)/,
    /^react(\/|$)/,
  ],
})
