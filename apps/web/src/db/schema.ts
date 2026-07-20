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
import { defineTableSchema } from "@zeno-lib/schema"
import { sql } from "drizzle-orm"
import { real, text, uuid } from "drizzle-orm/pg-core"

export const profiles = table(
  "profiles",
  {
    id: authUserId().primaryKey(),
    displayName: text().notNull(),
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
    commentCount: real().notNull().default(0),
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
    postId: uuid()
      .notNull()
      .references(() => posts.id),
    userId: authUserId(),
    body: text().notNull(),
    ...timestamps,
  },
  (t) => [
    authenticatedOwnerSelectPolicy("comments_owner_select", t.userId),
  ]
)

export const postSchema = defineTableSchema(posts)
export const commentSchema = defineTableSchema(comments)
