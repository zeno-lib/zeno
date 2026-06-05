// https://orm.drizzle.team/docs/drizzle-config-file
// https://orm.drizzle.team/docs/rls#migrations  (entities.roles.provider: "supabase")
import { type Config, defineConfig } from "drizzle-kit"

export function defineDrizzleConfig(
  overrides: Partial<Config> = {}
): ReturnType<typeof defineConfig> {
  const { casing = "snake_case", entities, ...configOverrides } = overrides
  const roleOverrides =
    typeof entities?.roles === "object" ? entities.roles : {}

  return defineConfig({
    casing,
    dbCredentials: { url: process.env.DATABASE_URL ?? "" },
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
