import { defineRelations } from "drizzle-orm"
import type { PgAsyncDatabase, PgAsyncTransaction } from "drizzle-orm/pg-core"
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js"
import { expectTypeOf, test } from "vitest"
import type { DrizzleClient } from "./clients.ts"
import { primaryId, table } from "./schema.ts"
import { rollBackAfter } from "./testing.ts"

const posts = table("posts", { id: primaryId("sequential") })
const relations = defineRelations({ posts })

declare const db: DrizzleClient<typeof relations>

type Db = PgAsyncDatabase<PostgresJsQueryResultHKT, typeof relations>

test("rollBackAfter hands run the caller's own transaction, relations included", () => {
  expectTypeOf(
    rollBackAfter(db, (tx) => {
      expectTypeOf(tx).toEqualTypeOf<
        PgAsyncTransaction<PostgresJsQueryResultHKT, typeof relations>
      >()
      return tx.query.posts.findFirst()
    })
  ).resolves.toEqualTypeOf<typeof posts.$inferSelect | undefined>()
})

test("rollBackAfter takes a run typed to the database, and a transaction", () => {
  const countPosts = (handle: Db) => handle.$count(posts)

  expectTypeOf(rollBackAfter(db, countPosts)).resolves.toBeNumber()
  rollBackAfter(db, (tx) => rollBackAfter(tx, countPosts))
})
