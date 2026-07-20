import { desc, eq } from "drizzle-orm"
import type { z } from "zod"
import { db } from "./client"
import { comments, type commentSchema, posts, profiles } from "./schema"

// Loads a single post by id (used by the post page).
export async function getPost(postId: string) {
  const [post] = await db.select().from(posts).where(eq(posts.id, postId))
  return post
}

export type SelectComment = z.infer<typeof commentSchema.select>

export type CommentView = Pick<SelectComment, "id" | "body" | "createdAt"> & {
  authorName: string
}

// Loads a post's comments, each with its author's name (used by the comments API route).
export async function listComments(postId: string): Promise<CommentView[]> {
  const rows = await db
    .select()
    .from(comments)
    .where(eq(comments.postId, postId))

  const arr: CommentView[] = []
  for (const row of rows) {
    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, row.userId))

    arr.push({
      id: row.id,
      body: row.body,
      authorName: profile?.displayName ?? "Unknown",
      createdAt: row.createdAt,
    })
  }

  return arr
}

// Loads the most recent comment for a post (shown in the post header).
export async function getLatestComment(
  postId: string
): Promise<CommentView | undefined> {
  const [row] = await db
    .select()
    .from(comments)
    .where(eq(comments.postId, postId))
    .orderBy(desc(comments.createdAt))
    .limit(1)

  if (!row) {
    return undefined
  }

  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, row.userId))

  return {
    id: row.id,
    body: row.body,
    authorName: profile?.displayName ?? "Unknown",
    createdAt: row.createdAt,
  }
}
