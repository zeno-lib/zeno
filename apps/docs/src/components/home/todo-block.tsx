import { cn } from "@zeno-lib/ui/lib/utils"

/**
 * A placeholder that says so. Marks a region where real content belongs but
 * has not been made yet, rather than filling it with decoration that reads as
 * finished. The hatch is spaced on the same 10px module as the page texture.
 */
export function TodoBlock({
  className,
  label,
}: {
  className?: string
  label: string
}) {
  return (
    <div
      className={cn(
        "zeno-todo flex items-center justify-center border-y",
        className
      )}
    >
      <span className="zeno-label border bg-fd-background px-3 py-2 text-fd-muted-foreground">
        Todo · {label}
      </span>
    </div>
  )
}
