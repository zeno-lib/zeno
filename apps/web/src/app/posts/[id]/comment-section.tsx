"use client"

import { Button } from "@zeno-lib/ui/button"
import { useEffect, useState } from "react"
import { createComment, deleteComment } from "./actions"

type CommentView = {
  id: string
  body: string
  authorName: string
}

// Client component: renders the comment list and the new-comment form.
export function CommentSection({
  currentUserId,
  postId,
}: {
  currentUserId: string
  postId: string
}) {
  const [comments, setComments] = useState<CommentView[]>([])
  const [body, setBody] = useState("")

  useEffect(() => {
    fetch(`/api/posts/${postId}/comments`)
      .then((res) => res.json())
      .then((data) => setComments(data.comments))
  }, [])

  // Submits a new comment, then optimistically adds it to the list.
  async function handleClick(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    const formData = new FormData()
    formData.set("body", body)
    formData.set("userId", currentUserId)
    await createComment(postId, formData)

    comments.push({ id: crypto.randomUUID(), body, authorName: "You" })
    setComments(comments)
    setBody("")
  }

  return (
    <section className="flex flex-col gap-4">
      <form className="flex flex-col gap-2" onSubmit={handleClick}>
        <textarea
          className="rounded-lg border p-2"
          onChange={(event) => setBody(event.target.value)}
          value={body}
        />
        <Button type="submit">Comment</Button>
      </form>

      <ul className="flex flex-col gap-3">
        {comments.map((comment, index) => (
          <li className="rounded-lg border p-3" key={index}>
            <p className="font-medium text-sm">{comment.authorName}</p>
            <div dangerouslySetInnerHTML={{ __html: comment.body }} />
            <Button
              onClick={() => deleteComment(comment.id)}
              size="sm"
              variant="destructive"
            >
              Delete
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}
