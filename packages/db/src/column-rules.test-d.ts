import { defineTableSchema } from "@zeno-lib/schema"
import { sql } from "drizzle-orm"
import {
  bigint,
  numeric,
  primaryKey,
  smallint,
  text,
  unique,
} from "drizzle-orm/pg-core"
import { expectTypeOf, test } from "vitest"
import { z } from "zod"
import { authUsers } from "./auth-schema.ts"
import {
  assignedPrimaryId,
  authUserId,
  percentage,
  sequentialPrimaryId,
  serverOwned,
  table,
  timestamps,
  uuidPrimaryId,
  withRule,
  year,
} from "./schema.ts"

const listings = table(
  "listings",
  {
    ...timestamps({ mode: "string" }),
    builtIn: year(),
    id: bigint({ mode: "number" }).generatedByDefaultAsIdentity(),
    occupancy: percentage(),
    ownerId: authUserId({ defaultToCurrentUser: true, notNull: true }),
    summary: text(),
    title: text().notNull(),
  },
  (t) => [primaryKey({ columns: [t.id, t.ownerId] }), unique().on(t.id)]
)

test("insert and update hold only what a client writes", () => {
  const schemas = defineTableSchema(listings)

  expectTypeOf<z.infer<typeof schemas.insert>>().toEqualTypeOf<{
    builtIn?: number | null | undefined
    occupancy?: number | null | undefined
    summary?: string | null | undefined
    title: string
  }>()
  expectTypeOf<z.infer<typeof schemas.update>>().toEqualTypeOf<{
    builtIn?: number | null | undefined
    occupancy?: number | null | undefined
    summary?: string | null | undefined
    title?: string | undefined
  }>()
  expectTypeOf<keyof z.infer<typeof schemas.select>>().toEqualTypeOf<
    | "builtIn"
    | "createdAt"
    | "id"
    | "occupancy"
    | "ownerId"
    | "summary"
    | "title"
    | "updatedAt"
  >()

  defineTableSchema(listings, {
    // @ts-expect-error: a server-owned column has nothing to refine.
    insert: { ownerId: (schema) => schema },
  })
  defineTableSchema(listings, {
    // @ts-expect-error: neither has an identity id.
    update: { id: (schema) => schema },
  })
})

test("a marker survives the builder calls chained after it", () => {
  const notes = table("notes", {
    authorId: serverOwned(authUserId({ notNull: true })).default(
      sql`auth.uid()`
    ),
    body: text().notNull(),
  })

  const { insert } = defineTableSchema(notes)

  expectTypeOf<keyof z.infer<typeof insert>>().toEqualTypeOf<"body">()
})

test("a key a client supplies stays in insert", () => {
  const rooms = table("listing_rooms", {
    id: sequentialPrimaryId(),
    label: text().notNull(),
    listingId: bigint({ mode: "number" })
      .notNull()
      .references(() => listings.id),
  })
  const accounts = table("accounts", {
    id: assignedPrimaryId(),
    name: text().notNull(),
  })
  const members = table("members", {
    displayName: text(),
    id: uuidPrimaryId({ defaultRandom: false }).references(() => authUsers.id),
  })
  const roomSchemas = defineTableSchema(rooms)
  const accountSchemas = defineTableSchema(accounts)
  const memberSchemas = defineTableSchema(members)

  expectTypeOf<z.infer<(typeof roomSchemas)["insert"]>>().toEqualTypeOf<{
    label: string
    listingId: number
  }>()
  expectTypeOf<z.infer<(typeof accountSchemas)["insert"]>>().toEqualTypeOf<{
    id: string
    name: string
  }>()
  expectTypeOf<z.infer<(typeof memberSchemas)["insert"]>>().toEqualTypeOf<{
    displayName?: string | null | undefined
    id: string
  }>()
})

test("the callback form records the same rules", () => {
  const tags = table("tags", (t) => ({
    label: t.text().notNull(),
    ownerId: serverOwned(t.uuid().notNull().default(sql`auth.uid()`)),
  }))

  const { insert } = defineTableSchema(tags)

  expectTypeOf<keyof z.infer<typeof insert>>().toEqualTypeOf<"label">()
})

test("a rule's refinement is typed from its column", () => {
  withRule(numeric({ mode: "number" }), (schema) => {
    expectTypeOf(schema).toEqualTypeOf<z.ZodNumber>()
    return schema
  })
  withRule(smallint(), (schema) => {
    expectTypeOf(schema).toEqualTypeOf<z.ZodInt>()
    return schema
  })
  withRule(text(), (schema) => {
    expectTypeOf(schema).toEqualTypeOf<z.ZodString>()
    return schema
  })
  withRule(text().notNull(), z.literal("fixed"))

  // @ts-expect-error: a numeric column's schema is no string schema.
  withRule(numeric({ mode: "number" }), (schema: z.ZodString) => schema.min(1))
  // @ts-expect-error: a refinement returns a schema.
  withRule(text(), () => "fixed")
})
