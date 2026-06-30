// https://orm.drizzle.team/docs/drizzle-config-file
// https://orm.drizzle.team/docs/rls#migrations  (entities.roles.provider: "supabase")
import { type Config, defineConfig } from "drizzle-kit"

export function defineDrizzleConfig(
  overrides: Partial<Config> = {}
): ReturnType<typeof defineConfig> {
  const { entities, ...configOverrides } = overrides
  // `entities.roles` may be a boolean (`true`) in drizzle-kit config; in that
  // form there are no role options to preserve, so we only merge the object
  // form. The `provider: "supabase"` flag below is always enforced regardless.
  const roleOverrides =
    typeof entities?.roles === "object" ? entities.roles : {}

  return defineConfig({
    dbCredentials: { url: process.env.SUPABASE_DATABASE_URL ?? "" },
    dialect: "postgresql",
    // Tells drizzle-kit that Supabase's built-in roles (anon, authenticated,
    // service_role, ...) already exist — don't try to CREATE or DROP them.
    entities: {
      ...entities,
      roles: { ...roleOverrides, provider: "supabase" },
    },
    out: "./supabase/migrations",
    schema: "./src/schema.ts",
    ...configOverrides,
  } as Config)
}
