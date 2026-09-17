import { text } from "drizzle-orm/pg-core"
import {
  auditColumns,
  authenticatedOwnerInsertPolicy,
  authenticatedOwnerSelectPolicy,
  authenticatedOwnerUpdatePolicy,
  authUserId,
  primaryId,
  table,
} from "../src/schema"

export const posts = table(
  "posts",
  {
    id: primaryId("uuid"),
    title: text("title").notNull(),
    userId: authUserId({ notNull: true }),
    // The full audit set, so both update triggers have real coverage.
    ...auditColumns(),
  },
  (t) => [
    authenticatedOwnerSelectPolicy("posts_owner_select", t.userId),
    authenticatedOwnerInsertPolicy("posts_owner_insert", t.userId),
    authenticatedOwnerUpdatePolicy("posts_owner_update", t.userId),
  ]
)
