import { createAdminClient } from "@zeno-lib/db"

// Shared database client for the web app.
export const db = createAdminClient({
  connectionString: "postgresql://postgres:changeme@127.0.0.1:54322/postgres",
})
