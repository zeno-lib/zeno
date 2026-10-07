import { defineConfig } from "tsdown"

export default defineConfig({
  clean: true,
  // Keep peer imports as bare specifiers. `next` ships no exports map, so a
  // `next/headers` resolved to a file is emitted as `next/headers.js`, which
  // breaks on any consumer whose `next` adds a strict exports map.
  deps: { neverBundle: [/^@supabase\//, /^next(\/|$)/] },
  dts: true,
  entry: {
    client: "src/client.ts",
    "next-client": "src/next-client.ts",
    "next-image-loader": "src/next-image-loader.ts",
    "next-middleware": "src/next-middleware.ts",
    "next-server": "src/next-server.ts",
    "next-test-sign-in": "src/next-test-sign-in.ts",
  },
})
