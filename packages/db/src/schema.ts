// https://orm.drizzle.team/docs/rls#using-with-supabase  (re-exported roles, authUsers, authUid, realtimeMessages)
import { timestamp } from "drizzle-orm/pg-core"

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
