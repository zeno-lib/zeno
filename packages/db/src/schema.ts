// https://orm.drizzle.team/docs/rls#using-with-supabase  (re-exported roles, authUsers, authUid, realtimeMessages)
import { timestamp } from "drizzle-orm/pg-core"
import { snakeCase } from "drizzle-orm/pg-core/casing"

// Curated Supabase primitives from drizzle-orm/supabase so consumers can import
// roles, the auth.users table, and helpers from one Zeno-owned schema entrypoint.
// biome-ignore lint/performance/noBarrelFile: intentional public re-export surface
export {
  anonRole,
  authenticatedRole,
  authUid,
  authUsers,
  postgresRole,
  realtimeMessages,
  realtimeTopic,
  serviceRole,
  supabaseAuthAdminRole,
} from "drizzle-orm/supabase"

// Reusable created_at / updated_at columns — spread into a pgTable column map.
export const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}

// Default table helper for application-owned tables: TypeScript columns stay
// camelCase, database identifiers become snake_case, and RLS is enabled.
export const dbTable = snakeCase.table.withRLS

// Escape hatch for intentionally non-RLS tables such as seed/reference data.
export const unsecureDbTable = snakeCase.table
