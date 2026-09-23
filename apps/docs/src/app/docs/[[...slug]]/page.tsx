import { cn } from "@zeno-lib/ui/lib/utils"
import Link from "fumadocs-core/link"
import { findSiblings, type Item } from "fumadocs-core/page-tree"
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from "fumadocs-ui/layouts/docs/page"
import { createRelativeLink } from "fumadocs-ui/mdx"
import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { LLMCopyButton, ViewOptions } from "@/components/ai/page-actions"
import { hasRuleJunction, RuleDot } from "@/components/home/rule-dot"
import { getPageImage, source } from "@/lib/source"
import { getMDXComponents } from "@/mdx-components"

export default async function Page(props: PageProps<"/docs/[[...slug]]">) {
  const params = await props.params

  if (!params.slug || params.slug.length === 0) {
    redirect("/docs/foundation")
  }

  const page = source.getPage(params.slug)
  if (!page) {
    notFound()
  }

  const MDX = page.data.body
  const gitConfig = {
    branch: "main",
    repo: "repo",
    user: "username",
  }

  return (
    <DocsPage full={page.data.full} toc={page.data.toc}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription className="mb-0">
        {page.data.description}
      </DocsDescription>
      <div className="flex flex-row items-center gap-2 border-b pb-6">
        <LLMCopyButton markdownUrl={`${page.url}.mdx`} />
        <ViewOptions
          githubUrl={`https://github.com/${gitConfig.user}/${gitConfig.repo}/blob/${gitConfig.branch}/docs/content/docs/${page.path}`}
          // update it to match your repo
          markdownUrl={`${page.url}.mdx`}
        />
      </div>
      <DocsBody>
        <MDX
          components={getMDXComponents({
            // this allows you to link to other pages with relative file paths
            a: createRelativeLink(source, page),
            // biome-ignore lint/correctness/noNestedComponentDefinitions: STFU
            DocsCategory: ({ url }) => <DocsCategory url={url ?? page.url} />,
          })}
        />
      </DocsBody>
    </DocsPage>
  )
}

/** Columns from the `sm` breakpoint up, where the vertical rules exist. */
const CATEGORY_COLUMNS = 2

/**
 * The child pages of a section, laid out like the technologies grid on the
 * landing page: flat cells divided by hairlines, an outlined tile for the
 * page's icon, and a dot wherever a row rule crosses a column rule.
 */
function DocsCategory({ url }: { url: string }) {
  const items = findSiblings(source.getPageTree(), url)
    .filter((item) => item.type !== "separator")
    .filter((item) => !(item.type === "folder" && !item.index))
    .map((item) =>
      item.type === "folder" && item.index ? item.index : (item as Item)
    )

  return (
    <div className="not-prose grid sm:grid-cols-2">
      {items.map((item, index) => (
        <Link
          className={cn(
            "relative flex items-start gap-4 border-t px-0 py-5 transition-colors first:border-t-0 first:pt-0 last:pb-0 hover:bg-fd-muted/50 sm:border-r sm:px-5 sm:last:border-r-0 sm:[&:nth-child(-n+2)]:border-t-0 sm:[&:nth-child(-n+2)]:pt-0 sm:[&:nth-child(even)]:border-r-0 sm:[&:nth-child(even)]:pr-0 sm:[&:nth-child(odd)]:pl-0",
            index >=
              items.length -
                (items.length % CATEGORY_COLUMNS || CATEGORY_COLUMNS) &&
              "sm:pb-0"
          )}
          href={item.url}
          key={item.url}
        >
          {hasRuleJunction(index, items.length, CATEGORY_COLUMNS) && (
            <RuleDot className="-top-[0.5px] -right-[0.5px] hidden translate-x-1/2 -translate-y-1/2 sm:block" />
          )}
          {item.icon ? (
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md border bg-fd-background text-fd-muted-foreground [&>svg]:size-4">
              {item.icon}
            </span>
          ) : null}
          <span className="flex min-w-0 flex-col gap-1">
            <span className="font-medium text-sm">{item.name}</span>
            <span className="text-fd-muted-foreground text-sm">
              {item.description}
            </span>
          </span>
        </Link>
      ))}
    </div>
  )
}

export async function generateStaticParams() {
  return source.generateParams()
}

export async function generateMetadata(
  props: PageProps<"/docs/[[...slug]]">
): Promise<Metadata> {
  const params = await props.params
  const page = source.getPage(params.slug)
  if (!page) {
    notFound()
  }

  return {
    description: page.data.description,
    openGraph: {
      images: getPageImage(page).url,
    },
    title: page.data.title,
  }
}
