import { defineConfig } from "tsdown"

export default defineConfig({
  clean: true,
  dts: true,
  entry: {
    "configs/index": "src/configs/index.ts",
    supabase: "src/supabase.ts",
    "testing-library": "src/testing-library.ts",
    "user-event": "src/user-event.ts",
  },
  // Optional peer, type-only today; keep it a bare specifier if that changes.
  external: [/^@supabase\//],
})
