import { defineTableSchema } from "@zeno-lib/schema"
import { text } from "drizzle-orm/pg-core"
import { describe, expect, it } from "vitest"

import { auditColumns, sequentialPrimaryId, table } from "./schema.ts"

// `@zeno-lib/schema` cannot import this package, so it recognises the audit
// columns by the keys these helpers emit. This pins that contract.
describe("schema helpers under defineTableSchema", () => {
  const notes = table("notes", {
    ...auditColumns(),
    body: text().notNull(),
    id: sequentialPrimaryId(),
  })
  const schemas = defineTableSchema(notes)

  it("keeps every audit column out of insert and update", () => {
    const forged = {
      body: "Hello",
      createdAt: new Date(),
      createdBy: "00000000-0000-4000-8000-000000000000",
      updatedAt: new Date(),
      updatedBy: "00000000-0000-4000-8000-000000000000",
    }

    expect(schemas.insert.parse(forged)).toEqual({ body: "Hello" })
    expect(schemas.update.parse(forged)).toEqual({ body: "Hello" })
  })

  it("accepts only positive sequential ids", () => {
    expect(schemas.insert.safeParse({ body: "x", id: 0 }).success).toBe(false)
    expect(schemas.insert.parse({ body: "x", id: 1 })).toEqual({
      body: "x",
      id: 1,
    })
  })
})
