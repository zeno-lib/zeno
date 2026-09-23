"use client"

import { cn } from "@zeno-lib/ui/lib/utils"
import { Tabs, TabsList, TabsTrigger } from "@zeno-lib/ui/tabs"
import { Link, usePathname } from "fumadocs-core/framework"
import { getSidebarTabs } from "fumadocs-ui/components/sidebar/tabs"
import { isTabActive } from "fumadocs-ui/components/sidebar/tabs/dropdown"
import { useMemo } from "react"
import { source } from "@/lib/source"

export function DocsLayoutHeaderTabs() {
  const tabs = useMemo(() => getSidebarTabs(source.getPageTree()), [])
  const pathname = usePathname()
  const selected = useMemo(
    () => tabs.findLast((tab) => isTabActive(tab, pathname)),
    [tabs, pathname]
  )

  return (
    <div
      className="fixed inset-x-0 top-20 hidden border-b bg-fd-background *:mx-auto *:max-w-(--fd-layout-width) md:top-[46px] md:block lg:top-[49px] xl:top-[51px]"
      id="nd-header-tabs"
    >
      <div className="px-4 pt-2">
        {/* Controlled: the triggers are links, so nothing sets the value on
            click. It comes from the pathname, and without it no tab is active,
            which loses both the underline and the roving tabindex. */}
        <Tabs value={selected?.url ?? null}>
          {/* The height has to carry the same variant as the base it replaces
              (`group-data-horizontal/tabs:h-8`), or that one wins and the list
              cannot grow to the trigger's padding. */}
          <TabsList
            className="gap-6 p-0 group-data-horizontal/tabs:h-auto"
            variant="line"
          >
            {tabs.map((option, i) => (
              <TabsTrigger
                className={cn(
                  "zeno-label h-full gap-2 rounded-none px-0 pb-2 text-fd-muted-foreground after:-bottom-px! [&_svg]:size-3.5!",
                  option.unlisted && selected !== option && "hidden",
                  selected === option && "text-fd-foreground",
                  selected !== option && "hover:text-fd-foreground"
                )}
                // biome-ignore lint/suspicious/noArrayIndexKey: can't do better
                key={i}
                nativeButton={false}
                render={<Link href={option.url} />}
                value={option.url}
              >
                {option.icon}
                {option.title}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
    </div>
  )
}
