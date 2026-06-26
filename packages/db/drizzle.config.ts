// Local Supabase exposes its Postgres on 54322 — set this in .env:
//   SUPABASE_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
// The schema lives under test/ (a fixture for the integration suite), not in
// src/ which holds the package's own helper exports.
import "dotenv/config"
import { defineDrizzleConfig } from "@zeno-lib/db/config"

export default defineDrizzleConfig({ schema: "./test/schema.ts" })
