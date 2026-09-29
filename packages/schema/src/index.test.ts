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

const posts = pgTable("posts", {
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  slug: text("slug").notNull(),
  summary: text("summary"),
  title: text("title").notNull(),
})

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

  it("omits defaulted audit columns from insert and update, not select", () => {
    const notes = pgTable("notes", {
      body: text("body").notNull(),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      createdBy: uuid("created_by").notNull().default(sql`auth.uid()`),
      id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
      updatedAt: timestamp("updated_at").notNull().defaultNow(),
      updatedBy: uuid("updated_by").default(sql`auth.uid()`),
    })
    const schemas = defineTableSchema(notes)
    const forged = {
      body: "Hello",
      createdAt: new Date("2000-01-01T00:00:00.000Z"),
      createdBy: "00000000-0000-4000-8000-000000000000",
      updatedAt: new Date("2000-01-01T00:00:00.000Z"),
      updatedBy: "00000000-0000-4000-8000-000000000000",
    }

    expect(schemas.insert.parse(forged)).toEqual({ body: "Hello" })
    expect(schemas.update.parse(forged)).toEqual({ body: "Hello" })
    expect(Object.keys(schemas.select.shape)).toEqual(
      expect.arrayContaining([
        "createdAt",
        "createdBy",
        "updatedAt",
        "updatedBy",
      ])
    )
  })

  it("keeps an audit-named column the database does not fill", () => {
    const events = pgTable("events", {
      createdAt: timestamp("created_at").notNull(),
      id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    })

    expect(defineTableSchema(events).insert.safeParse({}).success).toBe(false)
  })

  it("rejects non-positive identity ids in every variant", () => {
    const items = pgTable("items", {
      id: bigint("id", { mode: "number" })
        .primaryKey()
        .generatedByDefaultAsIdentity(),
      label: text("label").notNull(),
    })
    const schemas = defineTableSchema(items)

    for (const id of [0, -1]) {
      expect(schemas.insert.safeParse({ id, label: "x" }).success).toBe(false)
      expect(schemas.update.safeParse({ id }).success).toBe(false)
      expect(schemas.select.safeParse({ id, label: "x" }).success).toBe(false)
    }

    expect(schemas.insert.parse({ id: 1, label: "x" })).toEqual({
      id: 1,
      label: "x",
    })
    expect(schemas.insert.parse({ label: "x" })).toEqual({ label: "x" })
  })

  it("leaves identities configured to go below one unconstrained", () => {
    const ledger = pgTable("ledger", {
      id: integer("id")
        .primaryKey()
        .generatedByDefaultAsIdentity({ increment: -1, startWith: -1 }),
    })

    expect(defineTableSchema(ledger).select.parse({ id: -5 })).toEqual({
      id: -5,
    })
  })

  it("runs a function refinement on top of the positive identity check", () => {
    const items = pgTable("items", {
      id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    })
    const schemas = defineTableSchema(items, {
      insert: { id: (schema) => schema.max(10) },
    })

    expect(schemas.insert.safeParse({ id: 0 }).success).toBe(false)
    expect(schemas.insert.safeParse({ id: 11 }).success).toBe(false)
    expect(schemas.insert.safeParse({ id: 5 }).success).toBe(true)
  })
})
