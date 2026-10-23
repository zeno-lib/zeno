import { sql } from "drizzle-orm"
import {
  bigint,
  date,
  integer,
  pgEnum,
  pgSchema,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"
import { describe, expect, it } from "vitest"

import { defineTableSchema, writableColumns } from "./index"
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

describe("string-mode dates and timestamps", () => {
  const events = zenoTable(
    pgTable("events", {
      at: timestamp("at", { mode: "string", withTimezone: true }),
      day: date("day", { mode: "string" }),
      days: date("days", { mode: "string" }).array(),
      localAt: timestamp("local_at", { mode: "string" }),
    })
  )
  const { insert, update } = defineTableSchema(events)
  const accepts = (value: Record<string, unknown>) =>
    insert.safeParse(value).success && update.safeParse(value).success

  it("takes a calendar date", () => {
    expect(accepts({ day: "2026-09-17" })).toBe(true)
    expect(accepts({ day: null })).toBe(true)
    expect(accepts({ day: "2026-02-30" })).toBe(false)
    expect(accepts({ day: "17.09.2026" })).toBe(false)
    expect(accepts({ day: "infinity" })).toBe(true)
    expect(accepts({ days: ["2026-09-17", "2026-09-18"] })).toBe(true)
  })

  it("takes ISO 8601 and the text Postgres returns, with the offset a time zone needs", () => {
    for (const at of [
      "2026-09-17T07:53:56.357127+00:00",
      "2026-09-17 07:53:56.357127+00",
      "2026-09-17T07:53Z",
    ]) {
      expect(accepts({ at }), at).toBe(true)
    }
    expect(accepts({ at: "2026-09-17T07:53:56" })).toBe(false)
    expect(accepts({ at: "yesterday" })).toBe(false)
    expect(accepts({ at: "-infinity" })).toBe(true)
    expect(accepts({ localAt: "2026-09-17 07:53:56.357127" })).toBe(true)
    expect(accepts({ localAt: "yesterday" })).toBe(false)
  })

  it("refuses a time Postgres would reject or shift", () => {
    expect(accepts({ at: "2026-02-30 07:00+00" })).toBe(false)
    expect(accepts({ at: "2026-09-17T24:00Z" })).toBe(false)
    expect(accepts({ at: "2026-09-17T07:00+16:00" })).toBe(false)
    // Postgres drops an offset on a column without a time zone.
    expect(accepts({ localAt: "2026-09-16T22:00:00.000Z" })).toBe(false)
  })

  it("lets an object refinement report next to a bad timestamp", () => {
    const result = insert
      .refine(() => false, { message: "cross-field" })
      .safeParse({ at: "yesterday" })

    expect(result.error?.issues.map((issue) => issue.message)).toContain(
      "cross-field"
    )
  })
})

describe("writableColumns", () => {
  it("lists each Zeno table's writable columns, and skips everything else", () => {
    const status = pgEnum("status", ["open", "closed"])
    const billing = pgSchema("billing")
    const invoices = zenoTable(
      billing.table("invoices", {
        id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
        total: integer("total").notNull(),
      })
    )
    const raw = pgTable("raw", { label: text("label") })

    expect(writableColumns({ invoices, posts, raw, status })).toEqual({
      "billing.invoices": ["total"],
      posts: ["createdAt", "slug", "summary", "title"],
    })
  })
})
