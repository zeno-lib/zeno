import { createClient } from "@zeno-lib/supabase/server"
import { getLatestComment, getPost } from "@/db/queries"
import { CommentSection } from "./comment-section"

// Post detail page: renders the post and its comment section.
export default async function PostPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const post = await getPost(id)
  const latest = await getLatestComment(id)

  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const currentUserId = data?.claims.sub ?? ""

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="font-semibold text-2xl">{post.title}</h1>
        <p className="text-muted-foreground">{post.body}</p>
        <span className="text-muted-foreground text-sm">
          {post.commentCount} comments
        </span>
        {latest ? (
          <p className="text-muted-foreground text-sm">Latest: {latest.body}</p>
        ) : null}
      </header>
      <CommentSection currentUserId={currentUserId} postId={id} />
    </main>
  )
}
