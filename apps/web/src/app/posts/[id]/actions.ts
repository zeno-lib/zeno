"use server"

import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { db } from "@/db/client"
import { comments, posts } from "@/db/schema"

export async function createComment(postId: string, formData: FormData) {
  // TODO(review): the comment body is inserted without validation. Parse the
  // input against the comment schema (derive one with @zeno-lib/schema) before
  // it reaches the database.
  const body = formData.get("body") as string
  const userId = formData.get("userId") as string

  await db.insert(comments).values({ postId, userId, body })

  // TODO(review): this read-then-write races under concurrent inserts — two
  // requests read the same count and one increment is lost. Make the counter
  // update atomic.
  const [post] = await db.select().from(posts).where(eq(posts.id, postId))
  await db
    .update(posts)
    .set({ commentCount: post.commentCount + 1 })
    .where(eq(posts.id, postId))

  revalidatePath(`/posts/${postId}`)
}

export async function deleteComment(commentId: string) {
  try {
    await db.delete(comments).where(eq(comments.id, commentId))
  } catch (error) {
    console.log("failed to delete comment", error)
  }
}
