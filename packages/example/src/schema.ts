import {
  authenticatedRole,
  authUid,
  authUsers,
  timestamps,
} from "@zeno-lib/db/schema"
import { sql } from "drizzle-orm"
import { pgPolicy, pgTable, text, uuid } from "drizzle-orm/pg-core"

export const posts = pgTable(
  "posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id),
    ...timestamps,
  },
  (t) => [
    pgPolicy("posts_owner_select", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.userId} = ${authUid}`,
    }),
    pgPolicy("posts_owner_insert", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${t.userId} = ${authUid}`,
    }),
  ]
).enableRLS()

export type InsertPost = typeof posts.$inferInsert
export type SelectPost = typeof posts.$inferSelect
