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
      <div className="px-4 py-1.5">
        <Tabs>
          <TabsList>
            {tabs.map((option, i) => (
              <TabsTrigger
                className={cn(
                  "text-fd-muted-foreground [&_svg]:size-4!",
                  option.unlisted && selected !== option && "hidden",
                  selected === option && "border-fd-primary text-fd-primary",
                  selected !== option && "hover:text-fd-accent-foreground"
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
