import { docs } from "fumadocs-mdx:collections/server"
import { cn } from "@zeno-lib/ui/lib/utils"
import { type InferPageType, loader } from "fumadocs-core/source"
import { lucideIconsPlugin } from "fumadocs-core/source/lucide-icons"

// const badgeLabelMap = {
//   "in progress": "In Progress",
//   new: "New",
//   todo: "Todo",
// } as const

// See https://fumadocs.dev/docs/headless/source-api for more info
export const source = loader({
  baseUrl: "/docs",
  pageTree: {
    transformers: [
      {
        file(node, filePath) {
          if (!filePath) {
            return node
          }

          const file = this.storage.read(filePath)
          if (!file || file.format !== "page") {
            return node
          }

          if (file.data.status) {
            node.name = (
              <>
                {node.name}
                <span
                  className={cn(
                    "absolute top-3.5 right-2 size-2 rounded-full",
                    {
                      "bg-blue-500": file.data.status === "to check",
                      "bg-green-500": file.data.status === "new",
                      "bg-red-500": file.data.status === "todo",
                      "bg-yellow-500": file.data.status === "in progress",
                    }
                  )}
                />
              </>
            )
          }

          return node
        },
      },
    ],
  },
  plugins: [lucideIconsPlugin()],
  source: docs.toFumadocsSource(),
})

export function getPageImage(page: InferPageType<typeof source>) {
  const segments = [...page.slugs, "image.png"]

  return {
    segments,
    url: `/og/docs/${segments.join("/")}`,
  }
}

export async function getLLMText(page: InferPageType<typeof source>) {
  const processed = await page.data.getText("processed")

  return `# ${page.data.title}

${processed}`
}
