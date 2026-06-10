// https://orm.drizzle.team/docs/rls#using-with-supabase  (re-exported roles, authUsers, authUid, realtimeMessages)
import { timestamp } from "drizzle-orm/pg-core"
import { snakeCase } from "drizzle-orm/pg-core/casing"

// Curated pg-core aliases for schema primitives that otherwise repeat the pg
// prefix at every call site. `table` is Zeno's RLS-by-default helper below.
// biome-ignore lint/performance/noBarrelFile: intentional public re-export surface
export {
  isPgEnum as isEnum,
  isPgMaterializedView as isMaterializedView,
  isPgSchema as isSchema,
  isPgSequence as isSequence,
  isPgView as isView,
  pgEnum as enum,
  pgMaterializedView as materializedView,
  pgPolicy as policy,
  pgRole as role,
  pgSchema as schema,
  pgSequence as sequence,
  pgTableCreator as tableCreator,
  pgView as view,
} from "drizzle-orm/pg-core"

// Curated Supabase primitives from drizzle-orm/supabase so consumers can import
// roles, the auth.users table, and helpers from one Zeno-owned schema entrypoint.
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
export const table = snakeCase.table.withRLS

// Escape hatch for intentionally non-RLS tables such as seed/reference data.
export const unsecureTable = snakeCase.table
