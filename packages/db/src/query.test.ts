import { defineRelations, type SQL } from "drizzle-orm"
import { PgDialect, text } from "drizzle-orm/pg-core"
import { drizzle } from "drizzle-orm/postgres-js"
import { describe, expect, it } from "vitest"
import {
  definedValues,
  excludedSet,
  functionPermissionTables,
  maybeOne,
  one,
  type QueryExecutor,
  selectFunctionPermissions,
} from "./query.ts"
import { primaryId, schema, table, view } from "./schema.ts"

// No connection anywhere: `drizzle.mock()` builds statements for `.toSQL()`,
// and `PgDialect` renders a bare `SQL` the way the driver would receive it.
const db = drizzle.mock()
const dialect = new PgDialect()
const render = (query: SQL) => dialect.sqlToQuery(query)

const contacts = table("contacts", {
  displayName: text(),
  email: text(),
  id: primaryId("sequential"),
})

const dealsProperties = table("deals_properties", {
  dealId: text().notNull(),
  propertyId: text().notNull(),
})

describe("one", () => {
  it("returns the only row", () => {
    expect(one([{ id: 1 }])).toEqual({ id: 1 })
  })

  it("throws on none and on several", () => {
    expect(() => one([])).toThrow("Expected exactly one row, received 0")
    expect(() => one([1, 2])).toThrow("Expected exactly one row, received 2")
  })
})

describe("maybeOne", () => {
  it("returns the row, or undefined for none", () => {
    expect(maybeOne([{ id: 1 }])).toEqual({ id: 1 })
    expect(maybeOne([])).toBeUndefined()
  })

  it("throws on several", () => {
    expect(() => maybeOne([1, 2])).toThrow(
      "Expected at most one row, received 2"
    )
  })
})

describe("definedValues", () => {
  it("drops undefined keys and keeps null", () => {
    expect(definedValues({ a: 1, b: undefined, c: null })).toEqual({
      a: 1,
      c: null,
    })
  })
})

describe("excludedSet", () => {
  const upsert = (values: Record<string, unknown>, set: Record<string, SQL>) =>
    db
      .insert(contacts)
      .values({ id: 1, ...values })
      .onConflictDoUpdate({ set, target: contacts.id })
      .toSQL().sql

  it("writes back every supplied column by its database name, never the target", () => {
    const values = { displayName: "Ada", email: "ada@example.com", id: 1 }

    expect(upsert(values, excludedSet(contacts, values))).toContain(
      'do update set "display_name" = excluded."display_name", "email" = excluded."email"'
    )
  })

  it("skips a key carrying undefined", () => {
    const values = { displayName: undefined, email: "ada@example.com" }
    const set = excludedSet(contacts, values)

    expect(Object.keys(set)).toEqual(["email"])
  })

  it("falls back to id = excluded.id when nothing else is supplied", () => {
    const set = excludedSet(contacts, { displayName: undefined, id: 1 })

    expect(upsert({}, set)).toContain('do update set "id" = excluded."id"')
  })

  it("takes another conflict target", () => {
    const values = { displayName: "Ada", email: "ada@example.com" }
    const set = excludedSet(contacts, values, { target: "email" })

    expect(Object.keys(set)).toEqual(["displayName"])
    expect(render(one(Object.values(set))).sql).toBe('excluded."display_name"')
  })

  it("falls back to the first target column that exists", () => {
    const set = excludedSet(
      dealsProperties,
      { dealId: "d", propertyId: "p" },
      { target: ["dealId", "propertyId"] }
    )

    expect(Object.keys(set)).toEqual(["dealId"])
    expect(render(one(Object.values(set))).sql).toBe('excluded."deal_id"')
  })

  it("stays empty for a table without the default id target", () => {
    expect(excludedSet(dealsProperties, {})).toEqual({})
  })
})

const billing = schema("billing")
const invoices = billing.table("invoices", { id: primaryId("sequential") })
const privateNotes = schema("private").table("notes", {
  id: primaryId("sequential"),
})
const contactNames = view("contact_names").as((qb) =>
  qb.select({ displayName: contacts.displayName }).from(contacts)
)

describe("functionPermissionTables", () => {
  const schemaObject = {
    billing,
    contactNames,
    contacts,
    invoices,
    privateNotes,
    relationsHelper: () => undefined,
  }

  it("includes only public tables by default", () => {
    expect([...functionPermissionTables(schemaObject)]).toEqual([
      ["contacts", "public"],
    ])
  })

  it("maps each table to its own schema", () => {
    expect(
      new Map(
        functionPermissionTables(schemaObject, {
          schemas: ["public", "billing"],
        })
      )
    ).toEqual(
      new Map([
        ["contacts", "public"],
        ["invoices", "billing"],
      ])
    )
  })

  it("accepts the result of defineRelations", () => {
    const relations = defineRelations({ contacts, invoices })

    expect([
      ...functionPermissionTables(relations, { schemas: ["billing"] }),
    ]).toEqual([["invoices", "billing"]])
  })

  it("rejects a bare name that two included schemas share", () => {
    const publicInvoices = table("invoices", { id: primaryId("sequential") })

    expect(() =>
      functionPermissionTables(
        { invoices, publicInvoices },
        { schemas: ["public", "billing"] }
      )
    ).toThrow('Table "invoices" exists in both')
  })
})

describe("selectFunctionPermissions", () => {
  const tables = functionPermissionTables(
    { contacts, invoices },
    { schemas: ["public", "billing"] }
  )

  // Records the statement and answers with a canned row: no database.
  const fakeDb = (row: Record<string, boolean | null>) => {
    const queries: SQL[] = []
    const executor: QueryExecutor = {
      execute: (query) => {
        queries.push(query)
        return Promise.resolve([row])
      },
    }
    return { executor, queries }
  }

  it("calls all four functions in one statement, id to all but insert", async () => {
    const { executor, queries } = fakeDb({
      delete: false,
      insert: true,
      select: true,
      update: null,
    })

    const permissions = await selectFunctionPermissions(executor, {
      id: 7,
      table: "invoices",
      tables,
    })

    expect(permissions).toEqual({
      delete: false,
      insert: true,
      select: true,
      update: false,
    })
    const query = render(one(queries))
    expect(query.sql).toBe(
      'select "billing"."can_select_invoices"("id" => $1) as "select", "billing"."can_insert_invoices"() as "insert", "billing"."can_update_invoices"("id" => $2) as "update", "billing"."can_delete_invoices"("id" => $3) as "delete"'
    )
    expect(query.params).toEqual([7, 7, 7])
  })

  it("calls every function bare without an id, honouring prefix and schema", async () => {
    const { executor, queries } = fakeDb({
      delete: true,
      insert: true,
      select: true,
      update: true,
    })

    await selectFunctionPermissions(executor, {
      functionSchema: "private",
      prefix: "may",
      table: "contacts",
      tables,
    })

    expect(render(one(queries)).sql).toBe(
      'select "private"."may_select_contacts"() as "select", "private"."may_insert_contacts"() as "insert", "private"."may_update_contacts"() as "update", "private"."may_delete_contacts"() as "delete"'
    )
  })

  it("rejects a table outside the allowlist before building anything", async () => {
    const { executor, queries } = fakeDb({})

    await expect(
      selectFunctionPermissions(executor, {
        table: 'contacts"; drop table contacts; --',
        tables,
      })
    ).rejects.toThrow("No permission functions for table")
    expect(queries).toHaveLength(0)
  })

  it("accepts a real Drizzle client", () => {
    // Compile-time only: the structural type fits a postgres-js database.
    const executor: QueryExecutor = db
    expect(executor.execute).toBeTypeOf("function")
  })
})
