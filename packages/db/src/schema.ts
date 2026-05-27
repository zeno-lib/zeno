// https://orm.drizzle.team/docs/rls#using-with-supabase  (re-exported roles, authUsers, authUid, realtimeMessages)
import { timestamp } from "drizzle-orm/pg-core"

// Re-export Supabase primitives from drizzle-orm/supabase so consumers can
// import roles, the auth.users table, and helpers from one place. Keeps the
// dep ownership in this package (same pattern @zeno-lib/supabase uses to
// re-export supabase-js types).
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
