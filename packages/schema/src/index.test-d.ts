import { sql } from "drizzle-orm"
import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { expectTypeOf, test } from "vitest"
import { z } from "zod"

import { defineTableSchema } from "./index"

type StandardSchema<T> = {
  readonly "~standard": {
    readonly types?: { readonly input: T; readonly output: T }
    readonly validate: (value: unknown) => unknown
  }
}

declare function acceptsFormsSchema<TFormData>(
  _schema: StandardSchema<TFormData>
): void

const posts = pgTable("posts", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
})

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

test("defaulted audit columns leave the insert and update types", () => {
  const notes = pgTable("notes", {
    body: text("body").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    createdBy: uuid("created_by").notNull().default(sql`auth.uid()`),
    updatedAt: timestamp("updated_at").notNull(),
  })
  const schemas = defineTableSchema(notes)

  expectTypeOf<z.infer<typeof schemas.insert>>().toEqualTypeOf<{
    body: string
    updatedAt: Date
  }>()
  expectTypeOf<z.infer<typeof schemas.update>>().toEqualTypeOf<{
    body?: string | undefined
    updatedAt?: Date | undefined
  }>()
  expectTypeOf<keyof z.infer<typeof schemas.select>>().toEqualTypeOf<
    "body" | "createdAt" | "createdBy" | "updatedAt"
  >()

  defineTableSchema(notes, {
    // @ts-expect-error: an omitted audit column has nothing to refine.
    insert: { createdBy: (schema) => schema },
  })
})

test("a function refinement keeps a nullable or defaulted insert column optional", () => {
  const drafts = pgTable("drafts", {
    note: text("note"),
    status: text("status").notNull().default("open"),
    title: text("title").notNull(),
  })
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
