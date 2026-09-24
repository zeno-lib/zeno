import { Layers } from "@zeno-lib/ui/icons"
import { cn } from "@zeno-lib/ui/lib/utils"
import Link from "next/link"
import type { CSSProperties } from "react"
import { RuleDot, ruleJunctionVisibility } from "@/components/home/rule-dot"
import { Section, SectionHeader } from "@/components/home/section"

/**
 * `icon` is the file stem under `public/tech`, and `darkIcon` flags the marks
 * whose black element would vanish on a dark tile: those ship a `-dark` twin
 * beside them. The two entries with no mark in the set fall back to a lettered
 * tile rather than a gap.
 */
type Tech = {
  darkIcon?: boolean
  icon: string | null
  name: string
  role: string
}

const STACK: Tech[] = [
  { icon: "typescript", name: "TypeScript", role: "v5" },
  { icon: "react", name: "React", role: "v19" },
  { darkIcon: true, icon: "nextjs", name: "Next.js", role: "v16" },
  { icon: "tailwindcss", name: "Tailwind CSS", role: "v4" },
  { darkIcon: true, icon: "turborepo", name: "Turborepo", role: "monorepo" },
  { icon: null, name: "Drizzle", role: "orm" },
  { icon: "supabase", name: "Supabase", role: "postgres" },
  { icon: "vitest", name: "Vitest", role: "unit" },
  { icon: "playwright", name: "Playwright", role: "e2e" },
  { icon: null, name: "Ultracite", role: "lint" },
]

/** Columns per breakpoint; every layout is divided by row and column rules. */
const COLUMNS = { base: 2, lg: 5, md: 3 }

/** First index of the final row, so its cells drop their bottom padding. */
const lastRowStart = (columns: number) =>
  STACK.length - (STACK.length % columns || columns)

const LAST_ROW_START = {
  base: lastRowStart(COLUMNS.base),
  lg: lastRowStart(COLUMNS.lg),
  md: lastRowStart(COLUMNS.md),
}

/**
 * Every technology sits in the same outlined tile, so the two without a mark
 * read as deliberate rather than missing.
 *
 * The mark is a background image rather than an `<img>`: the URL comes in as a
 * custom property, so only the file the theme resolves is ever fetched. A pair
 * of `<img>` tags toggled with `dark:hidden` downloads both, since a browser
 * loads an image element even while it is `display: none`.
 */
function Mark({
  darkIcon,
  icon,
  name,
}: Pick<Tech, "darkIcon" | "icon" | "name">) {
  return (
    <span className="flex size-12 shrink-0 items-center justify-center rounded-md border bg-fd-background">
      {icon ? (
        <span
          aria-hidden="true"
          className="zeno-tech-mark size-[30px] bg-center bg-contain bg-no-repeat"
          style={
            {
              "--zeno-mark": `url("/tech/${icon}.svg")`,
              ...(darkIcon && {
                "--zeno-mark-dark": `url("/tech/${icon}-dark.svg")`,
              }),
            } as CSSProperties
          }
        />
      ) : (
        <span className="zeno-label text-fd-muted-foreground">
          {name.slice(0, 2)}
        </span>
      )}
    </span>
  )
}

export function Stack() {
  return (
    <Section className="zeno-surface">
      <SectionHeader
        body={
          <p>
            Chosen once and kept current, so an upgrade is a decision the
            framework makes rather than one you inherit. The full list lives in{" "}
            <Link
              className="text-fd-foreground underline underline-offset-4 hover:no-underline"
              href="/docs/foundation/technologies"
            >
              Technologies
            </Link>
            .
          </p>
        }
        icon={Layers}
        label="What it runs on"
        title="A stack picked on purpose."
      />

      <ul className="mt-14 grid grid-cols-2 md:mt-20 md:grid-cols-3 lg:grid-cols-5">
        {STACK.map((item, index) => {
          const junction = ruleJunctionVisibility(index, COLUMNS)
          return (
            <li
              className={cn(
                "relative flex items-center gap-4 border-t border-r px-4 py-6 last:border-r-0 [&:nth-child(-n+2)]:border-t-0 [&:nth-child(-n+2)]:pt-0 md:[&:nth-child(-n+3)]:border-t-0 md:[&:nth-child(-n+3)]:pt-0 lg:[&:nth-child(-n+5)]:border-t-0 lg:[&:nth-child(-n+5)]:pt-0 max-md:[&:nth-child(2n)]:border-r-0 max-md:[&:nth-child(2n)]:pr-0 max-md:[&:nth-child(2n+1)]:pl-0 md:max-lg:[&:nth-child(3n)]:border-r-0 md:max-lg:[&:nth-child(3n)]:pr-0 md:max-lg:[&:nth-child(3n+1)]:pl-0 lg:[&:nth-child(5n)]:border-r-0 lg:[&:nth-child(5n)]:pr-0 lg:[&:nth-child(5n+1)]:pl-0",
                index >= LAST_ROW_START.base && "max-md:pb-0",
                index >= LAST_ROW_START.md && "md:max-lg:pb-0",
                index >= LAST_ROW_START.lg && "lg:pb-0"
              )}
              key={item.name}
            >
              {junction && (
                <RuleDot
                  className={cn(
                    "-top-[0.5px] -right-[0.5px] translate-x-1/2 -translate-y-1/2",
                    junction
                  )}
                />
              )}
              <Mark
                darkIcon={item.darkIcon}
                icon={item.icon}
                name={item.name}
              />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="font-medium text-sm">{item.name}</span>
                <span className="zeno-label text-fd-muted-foreground">
                  {item.role}
                </span>
              </span>
            </li>
          )
        })}
      </ul>
    </Section>
  )
}
