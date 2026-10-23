import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { expectTypeOf, test } from "vitest"
import { z } from "zod"

import { defineTableSchema } from "./index"
import { zenoTable } from "./test-table"

type StandardSchema<T> = {
  readonly "~standard": {
    readonly types?: { readonly input: T; readonly output: T }
    readonly validate: (value: unknown) => unknown
  }
}

declare function acceptsFormsSchema<TFormData>(
  _schema: StandardSchema<TFormData>
): void

const posts = zenoTable(
  pgTable("posts", {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
  })
)

test("insert and update schemas infer form-compatible Standard Schema data", () => {
  const schemas = defineTableSchema(posts)

  acceptsFormsSchema(schemas.insert)
  acceptsFormsSchema(schemas.update)

  expectTypeOf<z.infer<typeof schemas.insert>>().toEqualTypeOf<{
    slug: string
    title: string
  }>()

  expectTypeOf<z.infer<typeof schemas.update>>().toEqualTypeOf<{
    slug?: string | undefined
    title?: string | undefined
  }>()
})

test("refined schemas preserve refinement-specific output types", () => {
  const schemas = defineTableSchema(posts, {
    insert: {
      title: z.literal("fixed"),
    },
  })

  expectTypeOf<z.infer<typeof schemas.insert>>().toEqualTypeOf<{
    slug: string
    title: "fixed"
  }>()
})

test("a column named like an audit column stays in the insert type", () => {
  const events = zenoTable(
    pgTable("events", {
      createdAt: timestamp("created_at").notNull().defaultNow(),
      label: text("label").notNull(),
    })
  )
  const schemas = defineTableSchema(events)

  expectTypeOf<z.infer<typeof schemas.insert>>().toEqualTypeOf<{
    createdAt?: Date | undefined
    label: string
  }>()
})

test("a function refinement keeps a nullable or defaulted insert column optional", () => {
  const drafts = zenoTable(
    pgTable("drafts", {
      note: text("note"),
      status: text("status").notNull().default("open"),
      title: text("title").notNull(),
    })
  )
  const schemas = defineTableSchema(drafts, {
    insert: {
      note: (schema) => schema.min(1),
      status: (schema) => schema.min(1),
      title: (schema) => schema.min(1),
    },
  })

  expectTypeOf<z.infer<typeof schemas.insert>>().toEqualTypeOf<{
    note?: string | null | undefined
    status?: string | undefined
    title: string
  }>()
  expectTypeOf<z.input<typeof schemas.insert>>().toEqualTypeOf<{
    note?: string | null | undefined
    status?: string | undefined
    title: string
  }>()
})
