import { defineServerTableSchema, defineTableSchema } from "@zeno-lib/schema"
import { generateDrizzleJson } from "drizzle-kit/api-postgres"
import { sql } from "drizzle-orm"
import {
  bigint,
  type ExtraConfigColumn,
  index,
  primaryKey,
  text,
  unique,
} from "drizzle-orm/pg-core"
import { snakeCase } from "drizzle-orm/pg-core/casing"
import { describe, expect, it } from "vitest"
import {
  authUserId,
  createdBy,
  email,
  functionPolicies,
  percentage,
  schema,
  sequentialId,
  serverOwned,
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
  ownerId: serverOwned(authUserId({ notNull: true }).default(sql`auth.uid()`)),
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
  title: "Loft",
  updatedAt: "2000-01-01 00:00:00+00",
}

describe("column rules", () => {
  it("drops identities, server-owned and audit columns from insert and update", () => {
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
      ownerId: serverOwned(t.uuid().notNull().default(sql`auth.uid()`)),
    }))
    const billing = schema("billing")
    const invoices = billing.table("invoices", {
      issuedBy: serverOwned(authUserId()),
      label: text().notNull(),
    })

    for (const built of [tags, invoices]) {
      expect(
        defineTableSchema(built).insert.parse({ label: "x", ownerId: "y" })
      ).toEqual({ label: "x" })
    }
  })

  it("keeps server-owned columns for server code, and audit columns from everyone", () => {
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
  expect(() => serverOwned(createdBy() as never)).toThrow(TypeError)
})
