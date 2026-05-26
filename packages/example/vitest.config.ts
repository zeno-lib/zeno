import sharedConfig from "@zeno-lib/vitest/configs/default"
import { defineConfig, mergeConfig } from "vitest/config"

// Local Supabase exposes Postgres on port 54322 via `pnpm dev`
// (which runs `npx supabase start`). A `.env.test` at this package's root
// can override or add other test-only vars — loaded via the shared default.
export default mergeConfig(
  sharedConfig,
  defineConfig({
    test: {
      env: {
        DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
      },
    },
  })
)
