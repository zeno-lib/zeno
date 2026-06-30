import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core"
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
})
