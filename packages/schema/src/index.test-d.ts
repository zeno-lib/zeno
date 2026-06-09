import { expectTypeOf, test } from "@zeno-lib/test"
import { integer, pgTable, text } from "drizzle-orm/pg-core"
import type { z } from "zod"

import { defineTableSchema } from "./index"

type StandardSchema<T> = {
  readonly "~standard": {
    readonly types?: { readonly input: T; readonly output: T }
    readonly validate: (value: unknown) => unknown
  }
}

function acceptsFormsSchema<TFormData>(
  _schema: StandardSchema<TFormData>
): void {
  return
}

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
