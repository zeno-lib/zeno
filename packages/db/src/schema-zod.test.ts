import { defineTableSchema } from "@zeno-lib/schema"
import { text } from "drizzle-orm/pg-core"
import { describe, expect, it } from "vitest"

import {
  authUserId,
  createdBy,
  sequentialPrimaryId,
  table,
  timestamps,
  updatedBy,
} from "./schema.ts"

// The helpers mark their own columns, so `@zeno-lib/schema` leaves them out of
// writes under any key, and never drops a column for its name alone.
describe("schema helpers under defineTableSchema", () => {
  const notes = table("notes", {
    ...timestamps(),
    author: createdBy(),
    body: text().notNull(),
    editor: updatedBy(),
    id: sequentialPrimaryId(),
    ownerId: authUserId({ defaultToCurrentUser: true, notNull: true }),
  })
  const schemas = defineTableSchema(notes)

  it("keeps the audit and owner columns out of insert and update", () => {
    const forged = {
      author: "00000000-0000-4000-8000-000000000000",
      body: "Hello",
      createdAt: new Date(),
      editor: "00000000-0000-4000-8000-000000000000",
      ownerId: "00000000-0000-4000-8000-000000000000",
      updatedAt: new Date(),
    }

    expect(schemas.insert.parse(forged)).toEqual({ body: "Hello" })
    expect(schemas.update.parse(forged)).toEqual({ body: "Hello" })
  })

  it("keeps sequential ids out of insert, and positive in select", () => {
    expect(schemas.insert.parse({ body: "x", id: 1 })).toEqual({ body: "x" })
    expect(schemas.select.shape.id.safeParse(0).success).toBe(false)
  })
})
