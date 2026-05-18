import { Construction } from "@zeno-lib/ui/icons"

export default function AboutPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <Construction className="size-12 text-fd-muted-foreground" />
      <h1 className="font-bold text-2xl">About</h1>
      <p className="text-fd-muted-foreground">
        This page is under construction. Check back soon to learn more about
        Zeno and the team behind it.
      </p>
    </div>
  )
}
