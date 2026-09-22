import type { SVGProps } from "react"

/**
 * The Zeno mark: a Z drawn on the same square module the landing-page canvas
 * paints its pixels on. Inherits `currentColor`, so it works in both themes.
 */
export function ZenoMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      fill="currentColor"
      focusable="false"
      viewBox="0 0 20 20"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
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
    </svg>
  )
}
