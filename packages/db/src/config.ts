// https://orm.drizzle.team/docs/drizzle-config-file
// https://orm.drizzle.team/docs/rls#migrations  (entities.roles.provider: "supabase")
import { type Config, defineConfig } from "drizzle-kit"
import { moveGeneratedSqlAfterGenerate } from "./move-generated-sql.ts"

/**
 * Roles a Supabase project ships that drizzle-kit's `provider: "supabase"` does
 * not already exclude. That provider covers eight names (`anon`,
 * `authenticator`, `authenticated`, `service_role`, `supabase_auth_admin`,
 * `supabase_storage_admin`, `dashboard_user`, `supabase_admin`); a real
 * instance has these too, and drizzle-kit manages every role it finds but
 * cannot see declared, which means a `DROP ROLE` for each.
 *
 * The alternative is every consumer keeping a generated `roles.ts` nobody
 * reads, or its own copy of this list, which rots as Supabase adds roles. That
 * is the argument for it living in a versioned dependency.
 *
 * Verified against Supabase CLI 2.84.1 / Postgres 17.
 */
export const supabaseManagedRoles = [
  "pg_checkpoint",
  "pg_database_owner",
  "pg_execute_server_program",
  "pg_monitor",
  "pg_read_all_data",
  "pg_read_all_settings",
  "pg_read_all_stats",
  "pg_read_server_files",
  "pg_signal_backend",
  "pg_stat_scan_tables",
  "pg_write_all_data",
  "pg_write_server_files",
  "pgbouncer",
  "postgres",
  "supabase_functions_admin",
  "supabase_read_only_user",
  "supabase_realtime_admin",
  "supabase_replication_admin",
] as const

/**
 * Schemas drizzle-kit is allowed to diff. Supabase owns `auth`, `storage`,
 * `realtime` and the rest, and changes them on upgrades, so migrating them is
 * never right. Add your own schemas here rather than dropping the filter.
 */
const DEFAULT_SCHEMA_FILTER = ["public"]

/**
 * Drizzle Kit config for migrations the Supabase CLI applies.
 * Moves each generated `<name>/migration.sql` to `<name>.sql` when `drizzle-kit generate` exits.
 * Set `moveGeneratedSql: false` if `drizzle-kit migrate` applies them instead.
 */
export function defineDrizzleConfig(
  overrides: Partial<Config> & { moveGeneratedSql?: boolean } = {}
): ReturnType<typeof defineConfig> {
  const { entities, moveGeneratedSql = true, ...configOverrides } = overrides
  // `entities.roles` may be a boolean (`true`) in drizzle-kit config; in that
  // form there are no role options to preserve, so we only merge the object
  // form. The `provider: "supabase"` flag below is always enforced regardless.
  const roleOverrides =
    typeof entities?.roles === "object" ? entities.roles : {}

  const config = defineConfig({
    dbCredentials: { url: process.env.SUPABASE_DATABASE_URL ?? "" },
    dialect: "postgresql",
    // Tells drizzle-kit that Supabase's built-in roles (anon, authenticated,
    // service_role, ...) already exist, so it neither creates nor drops them.
    // `provider` covers eight of them; `supabaseManagedRoles` covers the rest.
    // A caller's own excludes are kept.
    entities: {
      ...entities,
      roles: {
        ...roleOverrides,
        exclude: [...(roleOverrides.exclude ?? []), ...supabaseManagedRoles],
        provider: "supabase",
      },
    },
    out: "./supabase/migrations",
    schema: "./src/schema.ts",
    schemaFilter: DEFAULT_SCHEMA_FILTER,
    ...configOverrides,
  } as Config)

  if (moveGeneratedSql && config.out) {
    moveGeneratedSqlAfterGenerate({ migrationsDir: config.out })
  }

  return config
}
