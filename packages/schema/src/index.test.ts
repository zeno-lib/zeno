import { sql } from "drizzle-orm"
import {
  bigint,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"
import { describe, expect, it } from "vitest"

import { defineTableSchema } from "./index"
import { zenoTable } from "./test-table"

const posts = zenoTable(
  pgTable("posts", {
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    slug: text("slug").notNull(),
    summary: text("summary"),
    title: text("title").notNull(),
  })
)

describe("defineTableSchema", () => {
  it("returns select, insert, and update Zod schemas for a Drizzle table", () => {
    const schemas = defineTableSchema(posts)

    expect(
      schemas.select.parse({
        createdAt: new Date("2026-06-08T00:00:00.000Z"),
        id: 1,
        slug: "hello-world",
        summary: null,
        title: "Hello world",
      })
    ).toMatchObject({
      id: 1,
      slug: "hello-world",
      summary: null,
      title: "Hello world",
    })

    expect(
      schemas.insert.parse({
        slug: "hello-world",
        title: "Hello world",
      })
    ).toEqual({
      slug: "hello-world",
      title: "Hello world",
    })

    expect(
      schemas.update.parse({
        title: "Updated title",
      })
    ).toEqual({
      title: "Updated title",
    })
  })

  it("refuses a plain drizzle table, whose column markers would be ignored", () => {
    const raw = pgTable("raw", { label: text("label") })

    // @ts-expect-error: only a table from `@zeno-lib/db/schema` records rules.
    expect(() => defineTableSchema(raw)).toThrow(TypeError)
  })

  it("omits generated columns from insert and update schemas", () => {
    const schemas = defineTableSchema(posts)

    expect(
      schemas.insert.parse({
        id: 1,
        slug: "hello-world",
        title: "Hello world",
      })
    ).toEqual({
      slug: "hello-world",
      title: "Hello world",
    })

    expect(
      schemas.update.parse({
        id: 1,
        title: "Updated title",
      })
    ).toEqual({
      title: "Updated title",
    })
  })

  it("applies per-variant refinements only to the targeted schema", () => {
    const schemas = defineTableSchema(posts, {
      insert: {
        title: (schema) => schema.min(3),
      },
      select: {
        slug: (schema) => schema.startsWith("post-"),
      },
      update: {
        title: (schema) => schema.min(10),
      },
    })

    expect(
      schemas.insert.safeParse({
        slug: "hello-world",
        title: "Hi",
      }).success
    ).toBe(false)

    expect(
      schemas.update.safeParse({
        title: "Short",
      }).success
    ).toBe(false)

    expect(
      schemas.select.safeParse({
        createdAt: new Date("2026-06-08T00:00:00.000Z"),
        id: 1,
        slug: "hello-world",
        summary: null,
        title: "Hello world",
      }).success
    ).toBe(false)

    expect(
      schemas.insert.safeParse({
        slug: "hello-world",
        title: "Okay",
      }).success
    ).toBe(true)
  })

  it("keeps a column named like an audit column, which only its marker leaves out", () => {
    const events = zenoTable(
      pgTable("events", {
        createdAt: timestamp("created_at").notNull().defaultNow(),
        createdBy: uuid("created_by").default(sql`auth.uid()`),
        label: text("label").notNull(),
      })
    )
    const imported = {
      createdAt: new Date("2000-01-01T00:00:00.000Z"),
      createdBy: "00000000-0000-4000-8000-000000000000",
      label: "x",
    }

    expect(defineTableSchema(events).insert.parse(imported)).toEqual(imported)
  })

  it("keeps identity ids out of insert and update, and positive in select", () => {
    const items = zenoTable(
      pgTable("items", {
        id: bigint("id", { mode: "number" })
          .primaryKey()
          .generatedByDefaultAsIdentity(),
        label: text("label").notNull(),
      })
    )
    const schemas = defineTableSchema(items)

    expect(schemas.insert.parse({ id: 5000, label: "x" })).toEqual({
      label: "x",
    })
    expect(schemas.update.parse({ id: 5000, label: "x" })).toEqual({
      label: "x",
    })

    for (const id of [0, -1]) {
      expect(schemas.select.safeParse({ id, label: "x" }).success).toBe(false)
    }
  })

  it("leaves identities configured to go below one unconstrained", () => {
    const ledger = zenoTable(
      pgTable("ledger", {
        id: integer("id")
          .primaryKey()
          .generatedByDefaultAsIdentity({ increment: -1, startWith: -1 }),
      })
    )

    expect(defineTableSchema(ledger).select.parse({ id: -5 })).toEqual({
      id: -5,
    })
  })

  it("runs a function refinement on top of the positive identity check", () => {
    const items = zenoTable(
      pgTable("items", {
        id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
      })
    )
    const schemas = defineTableSchema(items, {
      select: { id: (schema) => schema.max(10) },
    })

    expect(schemas.select.safeParse({ id: 0 }).success).toBe(false)
    expect(schemas.select.safeParse({ id: 11 }).success).toBe(false)
    expect(schemas.select.safeParse({ id: 5 }).success).toBe(true)
  })

  it("keeps a function-refined nullable insert column optional", () => {
    const drafts = zenoTable(
      pgTable("drafts", {
        note: text("note"),
        title: text("title").notNull(),
      })
    )
    const schemas = defineTableSchema(drafts, {
      insert: { note: (schema) => schema.min(1) },
    })

    expect(schemas.insert.parse({ title: "x" })).toEqual({ title: "x" })
    expect(schemas.insert.parse({ note: null, title: "x" })).toEqual({
      note: null,
      title: "x",
    })
    expect(schemas.insert.safeParse({ note: "", title: "x" }).success).toBe(
      false
    )
  })
})
