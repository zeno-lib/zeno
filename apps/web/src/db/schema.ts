import {
  authenticatedOwnerInsertPolicy,
  authenticatedOwnerSelectPolicy,
  authenticatedRole,
  authUserId,
  primaryId,
  selectPolicy,
  table,
  timestamps,
} from "@zeno-lib/db/schema"
import { sql } from "drizzle-orm"
import { real, text, uuid } from "drizzle-orm/pg-core"

export const profiles = table(
  "profiles",
  {
    id: authUserId("id").primaryKey(),
    displayName: text("display_name").notNull(),
    ...timestamps,
  },
  () => [selectPolicy("profiles_select", { to: authenticatedRole, using: sql`true` })]
)

export const posts = table(
  "posts",
  {
    id: primaryId("uuid"),
    title: text().notNull(),
    body: text().notNull(),
    userId: authUserId(),
    // Denormalized counter, kept in sync whenever a comment is added.
    commentCount: real("comment_count").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    authenticatedOwnerSelectPolicy("posts_owner_select", t.userId),
    authenticatedOwnerInsertPolicy("posts_owner_insert", t.userId),
  ]
)

export const comments = table(
  "comments",
  {
    id: primaryId("uuid"),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id),
    userId: authUserId(),
    body: text().notNull(),
    ...timestamps,
  },
  (t) => [
    authenticatedOwnerSelectPolicy("comments_owner_select", t.userId),
    // TODO(review): comment authors currently can't write their own comments —
    // the insert/update/delete owner policies for this table are missing. Add
    // them here.
    // TODO(review): the comment list filters by post_id on every request, but
    // there is no index on that column. Add one.
  ]
)
