import { defineConfig } from "tsdown"

export default defineConfig({
  clean: true,
  // Peers stay bare specifiers: the app owns `ai`, the MCP SDK and `@zeno-lib/db`, and a bundled
  // copy of the MCP SDK would register tools on a different `McpServer` class than the app's
  // `setup` callback receives.
  deps: {
    neverBundle: [/^@modelcontextprotocol\//u, /^@zeno-lib\//u, /^ai(?:\/|$)/u],
  },
  dts: true,
  entry: {
    index: "src/index.ts",
    mcp: "src/mcp.ts",
    tools: "src/tools.ts",
  },
})
