import { cn } from "@zeno-lib/ui/lib/utils"

/**
 * Marks a point where two rules actually cross. It is positioned on the corner
 * of the element that draws them, so it only ever appears at a real junction,
 * never floating in the middle of a single line.
 *
 * The ring is a solid halo in the local background colour, which punches a gap
 * in whichever rules pass underneath instead of letting them run into the dot.
 * `--zeno-dot-ring` is set by `.zeno-surface`, so a dot inside a tinted band
 * picks up that band's colour automatically.
 */
export function RuleDot({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute z-10 size-[3px] rounded-full bg-fd-muted-foreground shadow-[0_0_0_8px_var(--zeno-dot-ring,var(--background))]",
        className
      )}
    />
  )
}

/**
 * Whether a junction sits at the top-right corner of cell `index`.
 *
 * A grid draws a column rule down every cell that is neither last in its row
 * nor the final cell, and a row rule above every cell past the first row. A
 * junction exists where those meet, which includes the case the obvious check
 * misses: a partial final row, where the column rule from above *terminates*
 * on the row rule rather than crossing it.
 */
export function hasRuleJunction(index: number, total: number, columns: number) {
  const lastColumn = columns - 1
  const hasColumnRule = (i: number) =>
    i % columns !== lastColumn && i !== total - 1

  return (
    index >= columns &&
    index % columns !== lastColumn &&
    (hasColumnRule(index - columns) || hasColumnRule(index))
  )
}
