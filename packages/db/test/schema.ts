import {
  authenticatedOwnerInsertPolicy,
  authenticatedOwnerSelectPolicy,
  authUserId,
  primaryId,
  table,
  timestamps,
} from "@zeno-lib/db/schema"
import { text } from "drizzle-orm/pg-core"

export const posts = table(
  "posts",
  {
    id: primaryId("uuid"),
    title: text("title").notNull(),
    userId: authUserId(),
    ...timestamps,
  },
  (t) => [
    authenticatedOwnerSelectPolicy("posts_owner_select", t.userId),
    authenticatedOwnerInsertPolicy("posts_owner_insert", t.userId),
  ]
)
