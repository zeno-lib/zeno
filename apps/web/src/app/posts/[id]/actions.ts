"use server"

import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { db } from "@/db/client"
import { comments, posts } from "@/db/schema"

// Server action: adds a comment to a post and updates its comment count.
export async function createComment(postId: string, formData: FormData) {
  const body = formData.get("body") as string
  const userId = formData.get("userId") as string

  await db.insert(comments).values({ postId, userId, body })

  const [p] = await db.select().from(posts).where(eq(posts.id, postId))
  await db
    .update(posts)
    .set({ commentCount: p.commentCount + 1 })
    .where(eq(posts.id, postId))

  revalidatePath(`/posts/${postId}`)
}

// Server action: deletes a comment by id.
export async function deleteComment(commentId: string) {
  try {
    await db.delete(comments).where(eq(comments.id, commentId))
  } catch (error) {
    console.log("failed to delete comment", error)
  }
}
