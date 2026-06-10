import { getTableConfig, text, uuid } from "drizzle-orm/pg-core"
import { camelCase, snakeCase } from "drizzle-orm/pg-core/casing"
import { describe, expect, it } from "vitest"
import { createSupabaseDrizzle } from "./clients.ts"
import { defineDrizzleConfig } from "./config.ts"
import { dbTable, unsecureDbTable } from "./schema.ts"

const LOCAL_DB_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"

describe("default casing", () => {
  it("leaves casing to Drizzle table constructors", () => {
    expect(defineDrizzleConfig()).not.toHaveProperty("casing")
  })

  it("works with Drizzle's snake_case table builders", async () => {
    const posts = snakeCase.table("posts", {
      displayName: text(),
      ownerId: uuid(),
    })
    const db = createSupabaseDrizzle({
      connectionString: LOCAL_DB_URL,
      schema: { posts },
    })

    expect(db.admin.select().from(posts).toSQL().sql).toContain(
      '"display_name"'
    )
    expect(db.admin.select().from(posts).toSQL().sql).toContain('"owner_id"')

    await db.close({ timeout: 0 })
  })

  it("allows callers to opt into camelCase table builders", async () => {
    const posts = camelCase.table("posts", {
      displayName: text(),
    })
    const db = createSupabaseDrizzle({
      connectionString: LOCAL_DB_URL,
      schema: { posts },
    })

    expect(db.admin.select().from(posts).toSQL().sql).toContain('"displayName"')

    await db.close({ timeout: 0 })
  })

  it("exports an RLS-enabled snake_case table helper", async () => {
    const posts = dbTable("posts", {
      displayName: text(),
      ownerId: uuid(),
    })
    const db = createSupabaseDrizzle({
      connectionString: LOCAL_DB_URL,
      schema: { posts },
    })

    expect(db.admin.select().from(posts).toSQL().sql).toContain(
      '"display_name"'
    )
    expect(db.admin.select().from(posts).toSQL().sql).toContain('"owner_id"')
    expect(getTableConfig(posts).enableRLS).toBe(true)

    await db.close({ timeout: 0 })
  })

  it("exports an explicit non-RLS snake_case table helper", async () => {
    const auditEvents = unsecureDbTable("audit_events", {
      displayName: text(),
      ownerId: uuid(),
    })
    const db = createSupabaseDrizzle({
      connectionString: LOCAL_DB_URL,
      schema: { auditEvents },
    })

    expect(db.admin.select().from(auditEvents).toSQL().sql).toContain(
      '"display_name"'
    )
    expect(db.admin.select().from(auditEvents).toSQL().sql).toContain(
      '"owner_id"'
    )
    expect(getTableConfig(auditEvents).enableRLS).toBe(false)

    await db.close({ timeout: 0 })
  })
})
