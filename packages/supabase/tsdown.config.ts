import { defineConfig } from "tsdown"

export default defineConfig({
  clean: true,
  dts: true,
  entry: {
    client: "src/client.ts",
    "image-loader": "src/image-loader.ts",
    "next-middleware": "src/next-middleware.ts",
    server: "src/server.ts",
    "supabase-middleware": "src/supabase-middleware.ts",
  },
  // Keep peer imports as bare specifiers. `next` ships no exports map, so without
  // this tsdown resolves `next/headers` to a file and emits `next/headers.js`,
  // which breaks on any consumer whose `next` adds a strict exports map.
  external: [/^@supabase\//, /^next(\/|$)/],
})
