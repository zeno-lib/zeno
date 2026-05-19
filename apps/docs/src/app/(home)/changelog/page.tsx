import { Construction } from "@zeno-lib/ui/icons"

export default function ChangelogPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <Construction className="size-12 text-fd-muted-foreground" />
      <h1 className="font-bold text-2xl">Changelog</h1>
      <p className="text-fd-muted-foreground">
        This page is under construction. Check back soon for a history of
        releases, improvements, and bug fixes.
      </p>
    </div>
  )
}
