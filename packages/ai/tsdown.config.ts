import { defineConfig } from "tsdown"
import { inlineScript } from "./inline-script.ts"

export default defineConfig({
  clean: true,
  // Peers stay bare specifiers: the app owns `ai`, the MCP SDK and `@zeno-lib/db`, and a bundled
  // copy of the MCP SDK would register tools on a different `McpServer` class than the app's
  // `setup` callback receives. `ext-apps` is no peer: its server helpers (constants and a
  // `registerTool` wrapper) are bundled, and its browser `App` lives inside the card's HTML.
  deps: {
    neverBundle: [
      /^@modelcontextprotocol\/(?!ext-apps(?:\/|$))/u,
      /^@zeno-lib\//u,
      /^ai(?:\/|$)/u,
    ],
    onlyBundle: ["@modelcontextprotocol/ext-apps"],
  },
  dts: true,
  entry: {
    index: "src/index.ts",
    mcp: "src/mcp.ts",
    tools: "src/tools.ts",
  },
  plugins: [inlineScript()],
})
