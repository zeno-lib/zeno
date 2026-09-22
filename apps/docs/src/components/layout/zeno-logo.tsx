import type { SVGProps } from "react"

/**
 * The full Zeno lockup: the pixel mark plus the wordmark, as one asset. Drawn
 * with `currentColor` and the page's own typeface, so it inverts with the theme
 * and never drifts from the surrounding type.
 *
 * Use {@link ZenoMark} on its own only where there is no room for the word.
 */
export function ZenoLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      fill="currentColor"
      role="img"
      viewBox="0 0 69 20"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <title>Zeno</title>
      <rect height="3.4" rx="0.4" width="3.4" x="0.3" y="0.3" />
      <rect height="3.4" rx="0.4" width="3.4" x="4.3" y="0.3" />
      <rect height="3.4" rx="0.4" width="3.4" x="8.3" y="0.3" />
      <rect height="3.4" rx="0.4" width="3.4" x="12.3" y="0.3" />
      <rect height="3.4" rx="0.4" width="3.4" x="16.3" y="0.3" />
      <rect height="3.4" rx="0.4" width="3.4" x="12.3" y="4.3" />
      <rect height="3.4" rx="0.4" width="3.4" x="8.3" y="8.3" />
      <rect height="3.4" rx="0.4" width="3.4" x="4.3" y="12.3" />
      <rect height="3.4" rx="0.4" width="3.4" x="0.3" y="16.3" />
      <rect height="3.4" rx="0.4" width="3.4" x="4.3" y="16.3" />
      <rect height="3.4" rx="0.4" width="3.4" x="8.3" y="16.3" />
      <rect height="3.4" rx="0.4" width="3.4" x="12.3" y="16.3" />
      <rect height="3.4" rx="0.4" width="3.4" x="16.3" y="16.3" />
      <text
        dominantBaseline="middle"
        fontSize="17"
        fontWeight="600"
        letterSpacing="-0.4"
        x="28"
        y="10.75"
      >
        Zeno
      </text>
    </svg>
  )
}
