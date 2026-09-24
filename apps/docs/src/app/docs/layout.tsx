import { DocsLayout } from "fumadocs-ui/layouts/docs"
import { baseOptions } from "@/lib/layout.shared"
import { source } from "@/lib/source"

export default function Layout({ children }: LayoutProps<"/docs">) {
  return (
    <DocsLayout
      {...baseOptions()}
      // The navbar already carries both, and DocsLayout renders inside it, so
      // the sidebar footer would just duplicate them.
      githubUrl={undefined}
      themeSwitch={{ enabled: false }}
      tree={source.getPageTree()}
    >
      {children}
    </DocsLayout>
  )
}
