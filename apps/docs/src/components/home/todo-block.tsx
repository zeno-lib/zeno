import { cn } from "@zeno-lib/ui/lib/utils"
import { RuleJunction } from "@/components/home/rule-dot"

/**
 * A placeholder that says so. Marks a region where real content belongs but
 * has not been made yet, rather than filling it with decoration that reads as
 * finished. The hatch is spaced on the same 10px module as the page texture.
 */
export function TodoBlock({
  bleed = false,
  className,
  closesPage = false,
  label,
}: {
  /** True when the block spans the viewport, so its rules cross the column edges. */
  bleed?: boolean
  className?: string
  /**
   * True when nothing follows the block. Its bottom rule then ends the page, so
   * the column edges cross nothing there and the junctions, whose ticks reach
   * down past that rule, would add scroll to a page that should stop on it.
   */
  closesPage?: boolean
  label: string
}) {
  return (
    <div
      className={cn(
        "zeno-todo relative flex items-center justify-center border-y",
        className
      )}
    >
      {bleed && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 mx-auto w-full max-w-[90rem]"
        >
          <RuleJunction
            className="-top-[0.5px] -left-px -translate-x-1/2 -translate-y-1/2"
            side="above"
          />
          <RuleJunction
            className="-top-[0.5px] -right-px translate-x-1/2 -translate-y-1/2"
            side="above"
          />
          {!closesPage && (
            <>
              <RuleJunction
                className="-bottom-[0.5px] -left-px -translate-x-1/2 translate-y-1/2"
                side="below"
              />
              <RuleJunction
                className="-right-px -bottom-[0.5px] translate-x-1/2 translate-y-1/2"
                side="below"
              />
            </>
          )}
        </span>
      )}
      <span className="zeno-label border bg-fd-background px-3 py-2 text-fd-muted-foreground">
        Todo · {label}
      </span>
    </div>
  )
}
