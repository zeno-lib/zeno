// Local Supabase exposes its Postgres on 54322 — set this in .env:
//   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
import "dotenv/config"
import { defineDrizzleConfig } from "@zeno-lib/db/config"

export default defineDrizzleConfig({
  schema: "./src/schema.ts",
})
