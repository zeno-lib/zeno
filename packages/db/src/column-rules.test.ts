import {
  columnDescription,
  defineServerTableSchema,
  defineTableSchema,
} from "@zeno-lib/schema"
import { generateDrizzleJson } from "drizzle-kit/api-postgres"
import { sql } from "drizzle-orm"
import {
  bigint,
  type ExtraConfigColumn,
  index,
  pgEnum,
  primaryKey,
  text,
  unique,
} from "drizzle-orm/pg-core"
import { snakeCase } from "drizzle-orm/pg-core/casing"
import { describe, expect, it } from "vitest"
import { z } from "zod"
import {
  authUserId,
  createdBy,
  databaseManaged,
  described,
  email,
  functionPolicies,
  percentage,
  schema,
  sequentialId,
  serverManaged,
  table,
  timestamps,
  year,
} from "./schema.ts"

// A factory, because drizzle builders mutate: one set of builders can't make
// two tables.
const listingColumns = () => ({
  ...timestamps({ mode: "string" }),
  builtIn: year(),
  id: bigint({ mode: "number" }).generatedByDefaultAsIdentity(),
  occupancy: percentage(),
  ownerId: serverManaged(
    authUserId({ notNull: true }).default(sql`auth.uid()`)
  ),
  // A trigger derives it from the title.
  slug: databaseManaged(text()),
  summary: text(),
  title: text().notNull(),
})

const listingConfig = (
  t: Record<keyof ReturnType<typeof listingColumns>, ExtraConfigColumn>
) => [
  primaryKey({ columns: [t.id, t.ownerId] }),
  unique().on(t.id),
  index().on(t.ownerId),
  ...functionPolicies(t, { argument: { delete: t.id, update: t.id } }),
]

const listings = table("listings", listingColumns(), listingConfig)
const listingSchemas = defineTableSchema(listings)

const forged = {
  createdAt: "2000-01-01 00:00:00+00",
  id: 5000,
  ownerId: "00000000-0000-4000-8000-000000000000",
  slug: "forged",
  title: "Loft",
  updatedAt: "2000-01-01 00:00:00+00",
}

describe("column rules", () => {
  it("drops identities and managed columns from insert and update", () => {
    expect(listingSchemas.insert.parse(forged)).toEqual({ title: "Loft" })
    expect(listingSchemas.update.parse(forged)).toEqual({ title: "Loft" })
    // The inferred keys (`column-rules.test-d.ts`) are these, so the type
    // never offers a key the runtime strips.
    expect(Object.keys(listingSchemas.insert.shape).sort()).toEqual([
      "builtIn",
      "occupancy",
      "summary",
      "title",
    ])
    expect(Object.keys(listingSchemas.update.shape).sort()).toEqual([
      "builtIn",
      "occupancy",
      "summary",
      "title",
    ])
  })

  it("applies each column's rule in insert and update", () => {
    for (const variant of [listingSchemas.insert, listingSchemas.update]) {
      expect(variant.safeParse({ occupancy: 1.5, title: "x" }).success).toBe(
        false
      )
      expect(variant.safeParse({ builtIn: 10_000, title: "x" }).success).toBe(
        false
      )
      expect(
        variant.safeParse({ builtIn: 1990, occupancy: 0.5, title: "x" }).success
      ).toBe(true)
    }

    // A nullable ruled column stays optional and nullable on insert.
    expect(
      listingSchemas.insert.parse({ occupancy: null, title: "x" })
    ).toEqual({ occupancy: null, title: "x" })
  })

  it("leaves select describing the stored row", () => {
    const stored = listingSchemas.select.parse({
      ...forged,
      builtIn: 10_000,
      occupancy: 50,
      summary: null,
    })

    expect(stored).toMatchObject({ id: 5000, occupancy: 50 })
    expect(
      listingSchemas.select.shape.id.safeParse(0).success,
      "select keeps identity ids positive"
    ).toBe(false)
  })

  it("runs a caller's refinement on top of the column rule", () => {
    const { insert } = defineTableSchema(listings, {
      insert: { occupancy: (base) => base.max(0.5) },
    })

    expect(insert.safeParse({ occupancy: 0.75, title: "x" }).success).toBe(
      false
    )
    expect(insert.safeParse({ occupancy: -1, title: "x" }).success).toBe(false)
    expect(insert.safeParse({ occupancy: 0.25, title: "x" }).success).toBe(true)
  })

  it("records the rules from the callback form and a second schema", () => {
    const tags = table("tags", (t) => ({
      label: t.text().notNull(),
      ownerId: serverManaged(t.uuid().notNull().default(sql`auth.uid()`)),
    }))
    const billing = schema("billing")
    const invoices = billing.table("invoices", {
      issuedBy: serverManaged(authUserId()),
      label: text().notNull(),
    })

    for (const built of [tags, invoices]) {
      expect(
        defineTableSchema(built).insert.parse({ label: "x", ownerId: "y" })
      ).toEqual({ label: "x" })
    }
  })

  it("keeps server-managed columns for server code, and database-managed ones from everyone", () => {
    const server = defineServerTableSchema(listings)
    const expected = { ownerId: forged.ownerId, title: "Loft" }

    expect(server.insert.parse(forged)).toEqual(expected)
    expect(server.update.parse(forged)).toEqual(expected)
    expect(server.insert.safeParse({ ...expected, occupancy: 2 }).success).toBe(
      false
    )
  })

  it("changes no DDL", async () => {
    const ddl = async (exports: Record<string, unknown>) =>
      (await generateDrizzleJson(exports)).ddl
    const raw = snakeCase.table.withRLS(
      "listings",
      listingColumns(),
      listingConfig
    )
    const callback = table("listings", () => listingColumns(), listingConfig)

    const expected = await ddl({ listings: raw })

    expect(await ddl({ listings })).toEqual(expected)
    expect(await ddl({ listings: callback })).toEqual(expected)
  })
})

describe("ruled columns", () => {
  const measures = table("measures", {
    builtIn: year(),
    contact: email(),
    discount: percentage({ min: -1 }),
    id: sequentialId(),
    occupancy: percentage(),
    share: percentage({ scale: "percent" }),
  })
  const { insert } = defineTableSchema(measures)
  const accepts = (value: Record<string, unknown>) =>
    insert.safeParse(value).success

  it("bounds a percentage in the scale it stores", () => {
    expect(accepts({ occupancy: 0.25, share: 25 })).toBe(true)
    expect(accepts({ occupancy: 1.5 })).toBe(false)
    expect(accepts({ occupancy: -0.5 })).toBe(false)
    expect(accepts({ share: 101 })).toBe(false)
    expect(accepts({ discount: -0.5 })).toBe(true)
  })

  it("takes a year as a whole number of four digits at most", () => {
    expect(accepts({ builtIn: 1990 })).toBe(true)
    expect(accepts({ builtIn: 1990.5 })).toBe(false)
    expect(accepts({ builtIn: 10_000 })).toBe(false)
  })

  it("hints a form field the scale of a percentage, and keeps it out of JSON Schema", () => {
    // Where `@zeno-lib/forms` reads it: the registry under this symbol, on
    // the column's own schema inside a nullable column's wrappers.
    const hints = (globalThis as Record<symbol, z.core.$ZodRegistry>)[
      Symbol.for("@zeno-lib/field-hints")
    ]
    const hint = (key: "builtIn" | "discount" | "share") =>
      hints?.get(insert.shape[key].unwrap().unwrap())

    expect(hint("discount")).toEqual({ field: "percentage", scale: "fraction" })
    expect(hint("share")).toEqual({ field: "percentage", scale: "percent" })
    expect(hint("builtIn")).toEqual({ field: "year" })
    expect(JSON.stringify(z.toJSONSchema(insert))).not.toContain('"field"')
  })

  it("checks an email address, and keeps a nullable one optional", () => {
    expect(accepts({ contact: "jane@example.com" })).toBe(true)
    expect(accepts({ contact: "jane@" })).toBe(false)
    expect(accepts({ contact: null })).toBe(true)
  })

  it("refuses an array made of a ruled column, whose rule checks one value", () => {
    expect(() => (percentage() as { array: () => unknown }).array()).toThrow(
      TypeError
    )
  })
})

it("refuses a second writer for an audit column", () => {
  expect(() => serverManaged(createdBy() as never)).toThrow(TypeError)
})

describe("described columns", () => {
  const taskStatus = pgEnum("task_status", ["todo", "doing", "done"])
  const tasks = table("tasks", {
    id: sequentialId(),
    note: described(text(), "A free note on the task"),
    progress: described(percentage(), "How much of the task is done"),
    status: described(taskStatus().notNull(), "The stage the task is at"),
    tags: described(text().array(), "Labels for search"),
    title: text().notNull(),
  })
  const schemas = defineTableSchema(tasks)
  const properties = (object: z.ZodType) =>
    (z.toJSONSchema(object) as { properties: Record<string, object> })
      .properties

  it("describes the column in every variant and in its JSON Schema", () => {
    for (const variant of [schemas.insert, schemas.update, schemas.select]) {
      expect(variant.shape.status.description).toBe("The stage the task is at")
      expect(properties(variant)).toMatchObject({
        note: { description: "A free note on the task" },
        progress: { description: "How much of the task is done" },
        status: { description: "The stage the task is at" },
        tags: { description: "Labels for search" },
      })
      expect(properties(variant).title).not.toHaveProperty("description")
    }

    // What an AI tool reads: the schema's Standard JSON Schema.
    expect(
      schemas.insert["~standard"].jsonSchema.input({ target: "draft-2020-12" })
    ).toMatchObject({
      properties: { status: { description: "The stage the task is at" } },
    })
  })

  it("keeps the description through .pick and .partial", () => {
    const filters = schemas.select.pick({ note: true, status: true }).partial()

    expect(properties(filters)).toMatchObject({
      note: { description: "A free note on the task" },
      status: { description: "The stage the task is at" },
    })
  })

  it("keeps the column's rule and form hint", () => {
    const hints = (globalThis as Record<symbol, z.core.$ZodRegistry>)[
      Symbol.for("@zeno-lib/field-hints")
    ]

    expect(
      schemas.insert.safeParse({ progress: 2, status: "todo", title: "x" })
        .success
    ).toBe(false)
    expect(hints?.get(schemas.insert.shape.progress.unwrap().unwrap())).toEqual(
      { field: "percentage", scale: "fraction" }
    )
  })

  it("lets a caller's description win, inside drizzle's wrappers too", () => {
    const { insert, select, update } = defineTableSchema(tasks, {
      insert: { note: (base) => base.describe("A note for the reviewer") },
      select: { note: (base) => base.describe("A note for the reviewer") },
      update: { status: (base) => base.describe("Where the task stands") },
    })

    // An optional status in update, a nullable note in insert and select.
    expect(update.shape.status.description).toBe("Where the task stands")
    for (const variant of [insert, select]) {
      expect(variant.shape.note.description).toBe("A note for the reviewer")
      expect(JSON.stringify(properties(variant).note)).not.toContain(
        "A free note on the task"
      )
    }
    // A function refinement that doesn't describe keeps the column's.
    expect(
      defineTableSchema(tasks, { insert: { note: (base) => base.min(1) } })
        .insert.shape.note.description
    ).toBe("A free note on the task")
  })

  it("reads the description back for a schema built anew", () => {
    const filters = z.object({
      statuses: z
        .array(z.enum(tasks.status.enumValues))
        .describe(columnDescription(tasks, "status")),
    })

    expect(properties(filters).statuses).toMatchObject({
      description: "The stage the task is at",
    })
    expect(() => columnDescription(tasks, "title" as never)).toThrow(TypeError)
    expect(() =>
      columnDescription(
        snakeCase.table("raw", { label: text() }) as never,
        "label" as never
      )
    ).toThrow("reads the column rules of a table from table()")
  })

  it("changes no DDL", async () => {
    const undescribed = table("tasks", {
      id: sequentialId(),
      note: text(),
      progress: percentage(),
      status: taskStatus().notNull(),
      tags: text().array(),
      title: text().notNull(),
    })

    expect((await generateDrizzleJson({ taskStatus, tasks })).ddl).toEqual(
      (await generateDrizzleJson({ taskStatus, tasks: undescribed })).ddl
    )
  })
})
