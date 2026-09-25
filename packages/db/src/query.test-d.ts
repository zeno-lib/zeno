import { defineRelations } from "drizzle-orm"
import type { PgAsyncDatabase, PgAsyncTransaction } from "drizzle-orm/pg-core"
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js"
import { expectTypeOf, test } from "vitest"
import type { DrizzleClient } from "./clients.ts"
import type { QueryExecutor } from "./query.ts"
import { primaryId, table } from "./schema.ts"

const posts = table("posts", { id: primaryId("sequential") })
const relations = defineRelations({ posts })

test("selectFunctionPermissions takes every client and transaction shape", () => {
  expectTypeOf<DrizzleClient<typeof relations>>().toExtend<QueryExecutor>()
  expectTypeOf<
    PgAsyncDatabase<PostgresJsQueryResultHKT, typeof relations>
  >().toExtend<QueryExecutor>()
  expectTypeOf<
    PgAsyncTransaction<PostgresJsQueryResultHKT, typeof relations>
  >().toExtend<QueryExecutor>()
})
