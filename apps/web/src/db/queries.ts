import { eq } from "drizzle-orm"
import { db } from "./client"
import { comments, posts, profiles } from "./schema"

export async function getPost(postId: string) {
  const [post] = await db.select().from(posts).where(eq(posts.id, postId))
  return post
}

export type CommentView = {
  id: string
  body: string
  authorName: string
  createdAt: Date
}

export async function listComments(postId: string): Promise<CommentView[]> {
  // TODO(review): this returns every comment on the post in a single response.
  // Add a bounded page size (a limit/offset or a cursor) to the query below.
  const rows = await db
    .select()
    .from(comments)
    .where(eq(comments.postId, postId))

  const views: CommentView[] = []
  for (const row of rows) {
    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, row.userId))

    views.push({
      id: row.id,
      body: row.body,
      authorName: profile?.displayName ?? "Unknown",
      createdAt: row.createdAt,
    })
  }

  return views
}
