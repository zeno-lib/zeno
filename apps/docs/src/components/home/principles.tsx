import { Bot, Code, Compass, Gauge, Layers, Sparkles } from "@zeno-lib/ui/icons"
import { cn } from "@zeno-lib/ui/lib/utils"
import { hasRuleJunction, RuleDot } from "@/components/home/rule-dot"
import { Section, SectionHeader } from "@/components/home/section"

const PRINCIPLES = [
  {
    body: "Intelligent defaults, streamlined workflows and high level abstractions, so the work starts past the setup.",
    icon: Gauge,
    title: "Development speed",
  },
  {
    body: "Development experience is part of productivity. Time not spent fighting the tooling is time spent on features.",
    icon: Sparkles,
    title: "Development experience",
  },
  {
    body: "Proven patterns instead of endless configuration. One clear path removes the decision fatigue and keeps projects consistent.",
    icon: Compass,
    title: "Opinionated",
  },
  {
    body: "Being opinionated buys abstraction. You build features rather than reimplement the wheel under them.",
    icon: Layers,
    title: "High level",
  },
  {
    body: "AI sits at the core of the development experience rather than bolted on beside it.",
    icon: Bot,
    title: "AI conscious",
  },
  {
    body: "Following shadcn, the relevant source is delivered into your codebase. You and your agents keep full control of it.",
    icon: Code,
    title: "Open code",
  },
] as const

/** Columns from the `md` breakpoint up, where the vertical rules exist. */
const COLUMNS = 3

/** First index of the final row, so its cells drop their bottom padding. */
const LAST_ROW_START =
  PRINCIPLES.length - (PRINCIPLES.length % COLUMNS || COLUMNS)

export function Principles() {
  return (
    <Section>
      <SectionHeader
        body={
          <p>
            Six positions that decide what makes it into the framework and what
            stays out. They are the reason Zeno says no to things that would
            otherwise be easy to add.
          </p>
        }
        icon={Compass}
        label="Philosophy"
        title="Opinions, held on purpose."
      />

      {/* Divided by hairlines rather than boxed into cards; the tile sits at
          the top and the text is pushed to the bottom, so a row shares one
          baseline. */}
      <ul className="mt-14 grid md:mt-20 md:grid-cols-3">
        {PRINCIPLES.map((principle, index) => (
          <li
            className={cn(
              "relative flex min-h-56 flex-col justify-between gap-10 border-t px-0 py-8 first:border-t-0 first:pt-0 last:pb-0 md:border-r md:px-6 md:last:border-r-0 md:[&:nth-child(-n+3)]:border-t-0 md:[&:nth-child(-n+3)]:pt-0 md:[&:nth-child(3n)]:border-r-0 md:[&:nth-child(3n)]:pr-0 md:[&:nth-child(3n+1)]:pl-0",
              index >= LAST_ROW_START && "md:pb-0"
            )}
            key={principle.title}
          >
            {hasRuleJunction(index, PRINCIPLES.length, COLUMNS) && (
              <RuleDot className="-top-px -right-px hidden translate-x-1/2 -translate-y-1/2 md:block" />
            )}
            <span className="flex size-11 items-center justify-center rounded-xl border bg-fd-background text-fd-muted-foreground">
              <principle.icon className="size-5" />
            </span>
            <span className="flex flex-col gap-2">
              <h3 className="text-fd-muted-foreground text-sm">
                {principle.title}
              </h3>
              <p className="text-balance leading-relaxed">{principle.body}</p>
            </span>
          </li>
        ))}
      </ul>
    </Section>
  )
}
