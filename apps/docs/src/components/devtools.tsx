"use client"

import dynamic from "next/dynamic"

/**
 * `@tanstack/devtools-ui` imports `use` from `solid-js/web`, which only the
 * browser builds export; Next's app-ssr layer resolves the node build through
 * the `node` condition and the compile fails. Loading the panel browser-side
 * keeps the whole subtree out of the SSR graph.
 */
const DevtoolsPanel = dynamic(
  () => import("./devtools-panel").then((mod) => mod.DevtoolsPanel),
  { ssr: false }
)

export function Devtools() {
  if (process.env.NODE_ENV !== "development") {
    return null
  }
  return <DevtoolsPanel />
}
