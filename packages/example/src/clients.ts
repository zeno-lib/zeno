// App-level Drizzle clients, bound to this package's schema. The reusable
// engine lives in @zeno-lib/db; this file is where the schema + env are known,
// so the getters can be module-level singletons.
// In a Next.js app, add `import "server-only"` at the top of this file.
import { createDrizzleClients } from "@zeno-lib/db/clients"
// biome-ignore lint/performance/noNamespaceImport: drizzle schema needs every table
import * as schema from "./schema.ts"

export const { getDrizzleSupabaseAdminClient, getDrizzleSupabaseClient } =
  createDrizzleClients({ schema })
