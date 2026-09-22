"use client"

import { cn } from "@zeno-lib/ui/lib/utils"
import { DOMAINS, usePixelField } from "@/components/home/pixel-field"

/** Hovering a label isolates that colour inside every canvas on the page. */
export function PixelLegend({ className }: { className?: string }) {
  const { setActive } = usePixelField()

  return (
    <ul
      className={cn(
        "zeno-label flex flex-wrap items-center gap-x-7 gap-y-2 text-fd-muted-foreground",
        className
      )}
    >
      {DOMAINS.map((domain) => (
        <li key={domain.key}>
          <button
            className="flex items-center gap-2 transition-colors hover:text-fd-foreground"
            onBlur={() => setActive(null)}
            onFocus={() => setActive(domain.key)}
            onMouseEnter={() => setActive(domain.key)}
            onMouseLeave={() => setActive(null)}
            type="button"
          >
            <span className={`zeno-swatch zeno-${domain.key} size-2.5`} />
            {domain.label}
          </button>
        </li>
      ))}
    </ul>
  )
}
