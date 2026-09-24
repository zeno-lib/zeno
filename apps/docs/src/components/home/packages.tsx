import {
  ArrowUpRight,
  Braces,
  Component,
  Database,
  FlaskConical,
  KeyRound,
  ListChecks,
  Rocket,
} from "@zeno-lib/ui/icons"
import Link from "next/link"
import type { ComponentType, SVGProps } from "react"

/** The domain accents defined in `(home)/home.css`: data, interface, quality, users. */
type DomainKey = "d" | "i" | "q" | "u"

type Entry = {
  description: string
  domain: DomainKey
  href: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  label: string
  title: string
}

const PACKAGES: Entry[] = [
  {
    description:
      "Postgres through Drizzle ORM, with typed tables, migrations and row level security policies that live in your repository instead of a dashboard.",
    domain: "d",
    href: "/docs/core-framework/data-management/database",
    icon: Database,
    label: "@zeno-lib/db",
    title: "Database",
  },
  {
    description:
      "Turn a Drizzle table into a Zod schema, with insert, update and select variants.",
    domain: "d",
    href: "/docs/core-framework/data-management/schemas",
    icon: Braces,
    label: "@zeno-lib/schema",
    title: "Schemas",
  },
  {
    description:
      "Supabase sign in, sign up, recovery and verification flows you own, added from the registry.",
    domain: "u",
    href: "/docs/core-framework/user-management/authentication",
    icon: KeyRound,
    label: "@zeno-lib/authentication",
    title: "Authentication",
  },
  {
    description:
      "A headless form factory plus a field kit, both wired to Zod validation.",
    domain: "i",
    href: "/docs/feature-modules/components/forms",
    icon: ListChecks,
    label: "@zeno-lib/forms",
    title: "Forms",
  },
  {
    description:
      "shadcn Base UI primitives and the Zeno theme, added with the shadcn CLI.",
    domain: "i",
    href: "/docs/core-framework/building-ui/installation",
    icon: Component,
    label: "zeno-lib/zeno/theme",
    title: "UI",
  },
  {
    description:
      "Vitest for units and Playwright for end to end, preconfigured and running in the same pipeline.",
    domain: "q",
    href: "/docs/core-framework/testing/e2e-testing",
    icon: FlaskConical,
    label: "@zeno-lib/e2e",
    title: "Testing",
  },
  {
    description:
      "One pipeline that lints, type checks, builds, tests and ships.",
    domain: "q",
    href: "/docs/production/deployment/ci-cd",
    icon: Rocket,
    label: "pnpm ci",
    title: "Deployment",
  },
]

export function PackageIndex() {
  return (
    <ul>
      {PACKAGES.map((entry) => (
        <li className="border-b last:border-b-0" key={entry.title}>
          <Link
            className="group grid items-baseline gap-x-10 gap-y-2 py-6 transition-colors hover:bg-fd-muted/40 md:grid-cols-[14rem_minmax(0,1fr)_14rem]"
            href={entry.href}
          >
            <span className="flex items-center gap-3">
              <entry.icon
                className={`zeno-ink zeno-${entry.domain} size-4 shrink-0`}
              />
              <span className="font-medium text-base">{entry.title}</span>
            </span>
            <span className="text-fd-muted-foreground text-sm leading-relaxed">
              {entry.description}
            </span>
            <span className="zeno-label flex items-center justify-between gap-2 text-fd-muted-foreground">
              {entry.label}
              <ArrowUpRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
