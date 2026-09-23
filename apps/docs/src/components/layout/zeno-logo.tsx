import type { SVGProps } from "react"

/**
 * The full Zeno lockup: the mark plus the wordmark, as one asset. Drawn with
 * `currentColor` and the page's own typeface, so it inverts with the theme and
 * never drifts from the surrounding type.
 *
 * The mark is a Z on an 8x8 module, scaled here to a 20-unit box: a seven-cell
 * top bar flush left, two two-cell steps, and a seven-cell bottom bar flush
 * right. Keep it in whole cells (2.5 units); it is the same drawing as
 * `src/app/icon.svg`.
 *
 * The word is set in caps on the same 0.14em tracking as `.zeno-label`, and is
 * pinned to the 55 units it measures in Inter (the advance includes the space
 * that trails the last letter, which is why the viewBox stops at 81). Set free,
 * any fallback the browser paints before `next/font` swaps in would overrun the
 * box and lose its last glyph to the edge.
 */
export function ZenoLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      fill="currentColor"
      role="img"
      viewBox="0 0 81 20"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <title>Zeno</title>
      <rect height="5" width="17.5" x="0" y="0" />
      <rect height="5" width="5" x="12.5" y="5" />
      <rect height="5" width="5" x="2.5" y="10" />
      <rect height="5" width="17.5" x="2.5" y="15" />
      <text
        dominantBaseline="middle"
        fontSize="17"
        fontWeight="600"
        lengthAdjust="spacingAndGlyphs"
        letterSpacing="2.38"
        textLength="55"
        x="28"
        y="10.75"
      >
        ZENO
      </text>
    </svg>
  )
}
