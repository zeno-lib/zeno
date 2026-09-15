import { generateDrizzleJson } from "drizzle-kit/api-postgres"
import { getTableColumns, getTableName } from "drizzle-orm"
import { getTableConfig } from "drizzle-orm/pg-core"
import { describe, expect, it } from "vitest"
import { authSchema, authUsers } from "./auth-schema.ts"
// biome-ignore lint/performance/noNamespaceImport: the point is what the whole barrel exports
import * as schema from "./schema.ts"

type DdlEntity = { entityType: string; schema?: string; name: string }

const ddlFor = async (exports: Record<string, unknown>) =>
  ((await generateDrizzleJson(exports)).ddl ?? []) as DdlEntity[]

describe("auth.users", () => {
  it("ships every column Supabase has, so schemaFilter can include auth", () => {
    // Pinned to Supabase CLI 2.84.1 / GoTrue v2.188.1. A bump that adds or
    // removes a column should fail here, not silently drift: regenerate with
    // the procedure in AGENTS.md.
    expect(Object.keys(getTableColumns(authUsers))).toHaveLength(35)
    expect(getTableName(authUsers)).toBe("users")
    expect(getTableConfig(authUsers).schema).toBe("auth")
  })

  it("marks the schema existing so nothing emits CREATE SCHEMA", async () => {
    expect(authSchema.isExisting).toBe(true)
    expect(
      (await ddlFor({ authSchema, authUsers })).filter(
        (entity) => entity.entityType === "schemas"
      )
    ).toEqual([])
  })

  it("stays out of the schema barrel, which is the only real protection", async () => {
    // drizzle-kit `generate` applies no entity filter, so a table reachable
    // from the files a consumer's `schema` glob reads becomes DDL regardless of
    // `.existing()` or `schemaFilter`. `@zeno-lib/db/schema` is what a consumer
    // re-exports, so auth.users must not be in it.
    expect(schema).not.toHaveProperty("authUsers")
    expect(schema).not.toHaveProperty("authSchema")

    const authEntities = (await ddlFor(schema)).filter(
      (entity) => entity.schema === "auth"
    )

    expect(authEntities).toEqual([])
    // Scoped to `auth` on purpose: `realtimeMessages` is still re-exported from
    // the barrel and still emits `CREATE TABLE "realtime"."messages"`, the same
    // bug for a different table. Widen this to every Supabase-owned schema when
    // #152 lands.
  })

  it("resolves author column foreign keys against this table", () => {
    const posts = schema.table("posts", { ownerId: schema.authUserId() })
    const [foreignKey] = getTableConfig(posts).foreignKeys

    // One auth.users object, not two with the same name.
    expect(foreignKey?.reference().foreignTable).toBe(authUsers)
  })
})
