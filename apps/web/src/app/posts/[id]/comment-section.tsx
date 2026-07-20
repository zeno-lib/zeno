"use client"

import { Button } from "@zeno-lib/ui/button"
import { useEffect, useState } from "react"
import { createComment } from "./actions"

type CommentView = {
  id: string
  body: string
  authorName: string
}

export function CommentSection({
  currentUserId,
  postId,
}: {
  currentUserId: string
  postId: string
}) {
  const [comments, setComments] = useState<CommentView[]>([])
  const [body, setBody] = useState("")

  // TODO(review): when postId changes, a slower earlier request can resolve
  // after a newer one and overwrite it with stale comments. Make this effect
  // ignore stale responses.
  useEffect(() => {
    fetch(`/api/posts/${postId}/comments`)
      .then((res) => res.json())
      .then((data) => setComments(data.comments))
  }, [])

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

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
      <form className="flex flex-col gap-2" onSubmit={onSubmit}>
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
          </li>
        ))}
      </ul>
    </section>
  )
}
