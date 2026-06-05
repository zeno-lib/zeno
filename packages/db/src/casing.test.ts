import { pgTable, text, uuid } from "@zeno-lib/db/pg-core"
import { describe, expect, it } from "@zeno-lib/test"
import { createSupabaseDrizzle } from "./clients.ts"
import { defineDrizzleConfig } from "./config.ts"

const LOCAL_DB_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"

describe("default casing", () => {
  it("uses snake_case in the Drizzle Kit config by default", () => {
    expect(defineDrizzleConfig()).toMatchObject({
      casing: "snake_case",
    })
  })

  it("uses snake_case in runtime queries by default", async () => {
    const posts = pgTable("posts", {
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

  it("allows callers to override runtime casing", async () => {
    const posts = pgTable("posts", {
      displayName: text(),
    })
    const db = createSupabaseDrizzle({
      casing: "camelCase",
      connectionString: LOCAL_DB_URL,
      schema: { posts },
    })

    expect(db.admin.select().from(posts).toSQL().sql).toContain('"displayName"')

    await db.close({ timeout: 0 })
  })
})
