import { cn } from "@zeno-lib/ui/lib/utils"

/**
 * The one marker every rule crossing on the page uses: an odd 3px square, so it
 * centres on a 1px rule and overhangs it evenly rather than sitting half off.
 * Square, not round, so its edges stay parallel to the rules it marks.
 *
 * Callers offset themselves by half a pixel (`-top-[0.5px]` and friends) so the
 * marker's centre lands on the rule's centre rather than its edge.
 */
const MARKER = "size-[3px] bg-fd-muted-foreground"

/** Paints over a rule in the local background, hiding it. */
const CLEAR = "absolute bg-[var(--zeno-dot-ring,var(--background))]"

/**
 * One vertical arm of clear space, matching the tick's `gap-y-2`, offset by
 * half the marker so it starts where the marker ends.
 */
const ARM = "-translate-x-1/2 left-1/2 h-2 w-px"

/**
 * Marks a point where two rules cross inside a single surface, such as a grid
 * cell corner. Positioned on the corner of the element that draws them, so it
 * only ever appears at a real crossing.
 *
 * The halo is a solid disc in the local background colour, which punches the
 * gap in whichever rules pass underneath. `--zeno-dot-ring` is set by
 * `.zeno-surface`, so a marker inside a tinted band picks up that band's
 * colour. Only safe here because a grid sits wholly within one background;
 * {@link RuleJunction} spans a seam and has to break its rules a different way.
 */
export function RuleDot({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute z-10",
        MARKER,
        "shadow-[0_0_0_8px_var(--zeno-dot-ring,var(--background))]",
        className
      )}
    />
  )
}

/**
 * A column-edge junction: a short vertical tick centred on a rule, broken
 * around the same marker.
 *
 * A junction sits on the seam between two backgrounds, so it can never mask a
 * square of clear space the way {@link RuleDot} does: one side of that square
 * would always be the wrong colour. It clears exactly the rules instead. The
 * horizontal patch is one pixel tall and the vertical arms one pixel wide, so
 * each covers the rule it breaks and nothing of the surfaces either side.
 *
 * `side` trims the tick for a rule that bounds a filled block, so it reaches
 * away from the block rather than running into it. An arm is painted only where
 * a tick is, since that is the only side a rule runs in to.
 */
export function RuleJunction({
  className,
  side = "both",
}: {
  className?: string
  side?: "above" | "below" | "both"
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute z-10 grid h-32 grid-rows-[1fr_auto_1fr] justify-items-center gap-y-2",
        className
      )}
    >
      <span
        className={cn(
          CLEAR,
          "top-1/2 left-1/2 h-px w-[19px] -translate-x-1/2 -translate-y-1/2"
        )}
      />
      {side !== "below" && (
        <span className={cn(CLEAR, ARM, "bottom-1/2 mb-[1.5px]")} />
      )}
      {side !== "above" && (
        <span className={cn(CLEAR, ARM, "top-1/2 mt-[1.5px]")} />
      )}
      <span className={cn("w-px", side !== "below" && "bg-fd-border")} />
      <span className={cn(MARKER, "relative")} />
      <span className={cn("w-px", side !== "above" && "bg-fd-border")} />
    </span>
  )
}

/**
 * Whether a junction sits at the top-right corner of cell `index`.
 *
 * A grid draws a row rule above every cell past the first row, and a column
 * rule down every cell that is not last in its row. Wherever both hold, the
 * cell above this one carries a column rule that reaches this corner, so the
 * two meet. That covers a partial final row too, where the column rule from
 * above terminates on the row rule rather than crossing it: the junction is
 * drawn all the same.
 */
export function hasRuleJunction(index: number, columns: number) {
  return index >= columns && index % columns !== columns - 1
}
