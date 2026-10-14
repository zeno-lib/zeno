import { defineRelations } from "drizzle-orm"
import {
  bigint,
  type PgAsyncDatabase,
  type PgAsyncTransaction,
  text,
} from "drizzle-orm/pg-core"
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js"
import { expectTypeOf, test } from "vitest"
import type { DrizzleClient } from "./clients.ts"
import { type QueryExecutor, syncRows } from "./query.ts"
import { primaryId, table } from "./schema.ts"

const posts = table("posts", { id: primaryId("sequential") })
const relations = defineRelations({ posts })

const lines = table("lines", {
  id: primaryId("sequential"),
  note: text(),
  orderId: bigint({ mode: "number" }).notNull(),
  product: text().notNull(),
})
const members = table("members", {
  personId: text(),
  teamId: bigint({ mode: "number" }).notNull(),
})

declare const db: DrizzleClient<typeof relations>

test("selectFunctionPermissions takes every client and transaction shape", () => {
  expectTypeOf<DrizzleClient<typeof relations>>().toExtend<QueryExecutor>()
  expectTypeOf<
    PgAsyncDatabase<PostgresJsQueryResultHKT, typeof relations>
  >().toExtend<QueryExecutor>()
  expectTypeOf<
    PgAsyncTransaction<PostgresJsQueryResultHKT, typeof relations>
  >().toExtend<QueryExecutor>()
})

test("syncRows takes rows without the parent's columns, and nothing less", () => {
  expectTypeOf(
    syncRows(db, lines, {
      parent: { orderId: 1 },
      rows: [{ product: "fig" }, { id: 1, product: "pear" }],
    })
  ).resolves.toEqualTypeOf<(typeof lines.$inferSelect)[]>()

  syncRows(db, lines, {
    parent: { orderId: 1 },
    // @ts-expect-error a row needs every required column but the parent's
    rows: [{ id: 1, note: "gift wrap" }],
  })

  // @ts-expect-error the parent names columns of the table
  syncRows(db, lines, { parent: { ordrId: 1 }, rows: [] })

  syncRows(db, members, {
    key: ["personId"],
    parent: { teamId: 1 },
    rows: [{ personId: null }],
  })
  // @ts-expect-error a row carries its key, even a nullable one
  syncRows(db, members, {
    key: ["personId"],
    parent: { teamId: 1 },
    rows: [{}],
  })
})

test("syncRows hands remove a transaction of the same client", () => {
  syncRows(db, lines, {
    parent: { orderId: 1 },
    remove: async (tx, rows) => {
      expectTypeOf(tx).toEqualTypeOf<
        PgAsyncDatabase<PostgresJsQueryResultHKT, typeof relations>
      >()
      expectTypeOf(rows).toEqualTypeOf<(typeof lines.$inferSelect)[]>()
      await Promise.resolve()
    },
    rows: [],
  })
})
