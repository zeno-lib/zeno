// App-level Drizzle client, bound to this package's schema. The reusable engine
// lives in @zeno-lib/db; this file is where the schema + env are known, so the
// pools can be module-level singletons.
// In a Next.js app, add `import "server-only"` at the top of this file.
import { createSupabaseDrizzle } from "@zeno-lib/db"
// biome-ignore lint/performance/noNamespaceImport: drizzle schema needs every table
import * as schema from "./schema.ts"

export const db = createSupabaseDrizzle({ schema })
