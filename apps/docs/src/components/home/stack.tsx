import { Layers } from "@zeno-lib/ui/icons"
import { cn } from "@zeno-lib/ui/lib/utils"
import Link from "next/link"
import type { CSSProperties } from "react"
import { hasRuleJunction, RuleDot } from "@/components/home/rule-dot"
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

/** Columns at the two breakpoints where the grid changes shape. */
const SM_COLUMNS = 2
const COLUMNS = 5

/** First index of the final row, so its cells drop their bottom padding. */
const lastRowStart = (columns: number) =>
  STACK.length - (STACK.length % columns || columns)

const SM_LAST_ROW_START = lastRowStart(SM_COLUMNS)
const LAST_ROW_START = lastRowStart(COLUMNS)

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

      <ul className="mt-14 grid sm:grid-cols-2 md:mt-20 md:grid-cols-5">
        {STACK.map((item, index) => (
          <li
            className={cn(
              "relative flex items-center gap-4 border-t px-0 py-6 first:border-t-0 first:pt-0 last:pb-0 md:border-r md:px-4 md:last:border-r-0 sm:[&:nth-child(-n+2)]:border-t-0 sm:[&:nth-child(-n+2)]:pt-0 md:[&:nth-child(-n+5)]:border-t-0 md:[&:nth-child(-n+5)]:pt-0 md:[&:nth-child(5n)]:border-r-0 md:[&:nth-child(5n)]:pr-0 md:[&:nth-child(5n+1)]:pl-0",
              index >= SM_LAST_ROW_START && "sm:pb-0",
              index >= LAST_ROW_START && "md:pb-0"
            )}
            key={item.name}
          >
            {hasRuleJunction(index, COLUMNS) && (
              <RuleDot className="-top-[0.5px] -right-[0.5px] hidden translate-x-1/2 -translate-y-1/2 md:block" />
            )}
            <Mark darkIcon={item.darkIcon} icon={item.icon} name={item.name} />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="font-medium text-sm">{item.name}</span>
              <span className="zeno-label text-fd-muted-foreground">
                {item.role}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </Section>
  )
}
