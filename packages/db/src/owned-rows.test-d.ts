import { defineTableSchema, ownedRows } from "@zeno-lib/schema"
import type { PgAsyncDatabase } from "drizzle-orm/pg-core"
import { bigint, integer, text } from "drizzle-orm/pg-core"
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js"
import { expectTypeOf, test } from "vitest"
import type { z } from "zod"
import { syncRows } from "./query.ts"
import { sequentialPrimaryId, table, timestamps } from "./schema.ts"

const lines = table("lines", {
  ...timestamps(),
  id: sequentialPrimaryId(),
  note: text(),
  orderId: bigint({ mode: "number" }).notNull(),
  product: text().notNull(),
  quantity: integer().notNull().default(1),
})
const orderLines = ownedRows(defineTableSchema(lines), { parent: "orderId" })

declare const db: PgAsyncDatabase<PostgresJsQueryResultHKT>

test("a row holds what a client writes of a line, and the id of a stored one", () => {
  expectTypeOf<z.infer<typeof orderLines.row>>().toEqualTypeOf<{
    id?: number | undefined
    note?: string | null | undefined
    product: string
    quantity?: number | undefined
  }>()
})

test("syncRows takes the rows a form validated, under the parent they name", () => {
  const rows: z.infer<typeof orderLines.row>[] = []

  syncRows(db, orderLines, { parent: { orderId: 1 }, rows })

  // @ts-expect-error: the parent column is `orderId`.
  syncRows(db, orderLines, { parent: { product: "x" }, rows })
  // @ts-expect-error: a parent the descriptor doesn't name.
  ownedRows(defineTableSchema(lines), { parent: "customerId" })
})
