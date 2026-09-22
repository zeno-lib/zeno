import {
  type Folder,
  findPath,
  getPageTreeRoots,
  type Item,
} from "fumadocs-core/page-tree"
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared"
import type { ReactNode } from "react"
import { HeaderDocumentationItem } from "@/components/layout/header-documentation-item"
import { ZenoLogo } from "@/components/layout/zeno-logo"
import { source } from "./source"

export interface SubMenuLinkProps {
  description: ReactNode
  href: string
  icon: ReactNode
  title: ReactNode
}

function getDocsMenuItems(): SubMenuLinkProps[] {
  const roots = getPageTreeRoots(source.getPageTree())
  return roots
    .filter((root): root is Folder => "type" in root && root.type === "folder")
    .map((folder) => ({
      description: folder.index?.description ?? folder.description ?? "",
      href:
        (findPath(folder.children, (node) => node.type === "page")?.[0] as Item)
          ?.url ?? "/",
      icon: folder.icon,
      title: folder.name,
    }))
}

export function baseOptions(): BaseLayoutProps {
  return {
    githubUrl: "https://github.com/zeno-lib/zeno",
    nav: {
      title: <ZenoLogo className="h-5 w-auto" />,
      transparentMode: "none",
    },
  }
}

export function homeOptions(): BaseLayoutProps {
  const docsMenuItems = getDocsMenuItems()
  return {
    ...baseOptions(),
    links: [
      {
        on: "nav",
        text: <span className="zeno-label">Discover</span>,
        url: "/",
      },
      {
        items: docsMenuItems.map((item) => ({
          icon: item.icon,
          text: item.title,
          url: item.href,
        })),
        on: "menu",
        text: <span className="zeno-label">Documentation</span>,
        type: "menu",
      },
      {
        children: <HeaderDocumentationItem docsMenuItems={docsMenuItems} />,
        on: "nav",
        type: "custom",
      },
      {
        text: <span className="zeno-label">Showcase</span>,
        url: "/showcase",
      },
      {
        text: <span className="zeno-label">About</span>,
        url: "/about",
      },
      {
        text: <span className="zeno-label">Blog</span>,
        url: "/blog",
      },
      {
        text: <span className="zeno-label">Changelog</span>,
        url: "/changelog",
      },
    ],
  }
}
