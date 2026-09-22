"use client"

import { cn } from "@zeno-lib/ui/lib/utils"
import { usePathname } from "fumadocs-core/framework"
import Link from "fumadocs-core/link"
import {
  NavbarMenu,
  NavbarMenuContent,
  NavbarMenuLink,
  NavbarMenuTrigger,
} from "fumadocs-ui/layouts/home/navbar"
import { hasRuleJunction, RuleDot } from "@/components/home/rule-dot"
import type { SubMenuLinkProps } from "@/lib/layout.shared"
import { DocsLayoutHeaderTabs } from "./header-tabs"

function normalize(urlOrPath: string) {
  if (urlOrPath.length > 1 && urlOrPath.endsWith("/")) {
    return urlOrPath.slice(0, -1)
  }
  return urlOrPath
}

/**
 * @returns if `href` is matching the given pathname
 */
function isActive(href: string, pathname: string, nested = false): boolean {
  const normalizedHref = normalize(href)
  const normalizedPathname = normalize(pathname)

  return (
    normalizedHref === normalizedPathname ||
    (nested && normalizedPathname.startsWith(`${normalizedHref}/`))
  )
}

/** The dropdown is desktop-only, so the column count is fixed and the border
 * arithmetic below is deterministic. */
const COLUMNS = 3

/**
 * Laid out like the technologies grid on the landing page: flat cells divided
 * by hairlines, an outlined tile on the left, and a dot wherever a row rule
 * actually crosses a column rule.
 */
function SubMenuLink({
  description,
  href,
  icon,
  index,
  title,
  total,
}: SubMenuLinkProps & { index: number; total: number }) {
  const lastInRow = index % COLUMNS === COLUMNS - 1
  const hasRowRule = index >= COLUMNS
  const hasColumnRule = !(lastInRow || index === total - 1)

  return (
    <NavbarMenuLink
      className={cn(
        "relative flex flex-row items-center gap-4 rounded-none border-0 bg-transparent p-5 transition-colors hover:bg-fd-muted/50",
        hasRowRule && "border-fd-border border-t",
        hasColumnRule && "border-fd-border border-r",
        // Flush with the panel's edges, like the technologies grid.
        index < COLUMNS && "pt-0",
        index % COLUMNS === 0 && "pl-0",
        lastInRow && "pr-0",
        index >= total - (total % COLUMNS || COLUMNS) && "pb-0"
      )}
      href={href}
    >
      {hasRuleJunction(index, total, COLUMNS) && (
        <RuleDot className="-top-px -right-px translate-x-1/2 -translate-y-1/2" />
      )}
      <span className="flex size-12 shrink-0 items-center justify-center rounded-md border bg-fd-background text-fd-muted-foreground [&>svg]:size-5">
        {icon}
      </span>
      <span className="flex min-w-0 flex-col gap-1">
        <span className="font-medium text-sm">{title}</span>
        <span className="text-fd-muted-foreground text-sm">{description}</span>
      </span>
    </NavbarMenuLink>
  )
}

export function HeaderDocumentationItem({
  docsMenuItems,
}: {
  docsMenuItems: SubMenuLinkProps[]
}) {
  const pathname = usePathname()
  const active = isActive("/docs", pathname, true)

  return (
    <>
      {active && <DocsLayoutHeaderTabs />}
      <NavbarMenu>
        <NavbarMenuTrigger data-active={active}>
          <Link className="zeno-label" href="/docs">
            Documentation
          </Link>
        </NavbarMenuTrigger>
        {!active && (
          <NavbarMenuContent className="grid-cols-3 gap-0 bg-transparent px-4 pt-0 pb-4 md:grid-cols-3 lg:grid-cols-3">
            {docsMenuItems.map((item, index) => (
              <SubMenuLink
                index={index}
                key={item.href}
                total={docsMenuItems.length}
                {...item}
              />
            ))}
          </NavbarMenuContent>
        )}
      </NavbarMenu>
    </>
  )
}
