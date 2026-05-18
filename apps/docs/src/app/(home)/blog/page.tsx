import { Construction } from "@zeno-lib/ui/icons"

export default function BlogPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <Construction className="size-12 text-fd-muted-foreground" />
      <h1 className="font-bold text-2xl">Blog</h1>
      <p className="text-fd-muted-foreground">
        This page is under construction. Check back soon for articles, updates,
        and insights from the Zeno team.
      </p>
    </div>
  )
}
