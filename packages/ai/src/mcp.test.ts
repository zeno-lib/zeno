import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  getBearerContext,
  getPost,
  received,
  renamePost,
} from "./fixtures.test-utils.ts"
import { createMcpRoute } from "./mcp.ts"

const METADATA_URL =
  "https://app.example.com/.well-known/oauth-protected-resource/mcp"

const route = createMcpRoute({
  getContext: getBearerContext,
  name: "example",
  resourceMetadataUrl: () => METADATA_URL,
  tools: [getPost],
  version: "1.0.0",
})

// Sends the client's requests straight to the route handlers, with a token.
const routeFetch =
  (token: string) => (url: string | URL, init?: RequestInit) => {
    const request = new Request(url, init)
    request.headers.set("authorization", `Bearer ${token}`)
    const method = request.method as "DELETE" | "GET" | "POST"
    return route[method](request)
  }

let client: Client | undefined

const connect = async (mode: "legacy" | { pin: string }) => {
  client = new Client(
    { name: "test", version: "1.0.0" },
    { versionNegotiation: { mode } }
  )
  await client.connect(
    new StreamableHTTPClientTransport(new URL("https://app.example.com/mcp"), {
      fetch: routeFetch("good"),
    })
  )
  return client
}

beforeEach(() => {
  received.length = 0
})

afterEach(async () => {
  await client?.close()
  client = undefined
})

describe("createMcpRoute", () => {
  it.each([
    ["2026-07-28", { pin: "2026-07-28" }, "2026-07-28"],
    ["the 2025 initialize fallback", "legacy", "2025-11-25"],
  ] as const)("serves the tools over %s", async (_, mode, revision) => {
    const connected = await connect(mode)
    expect(connected.getNegotiatedProtocolVersion()).toBe(revision)

    const { tools } = await connected.listTools()
    const result = await connected.callTool({
      arguments: { id: "7" },
      name: "get_post",
    })

    expect(tools).toMatchObject([
      {
        annotations: { openWorldHint: false, readOnlyHint: true },
        inputSchema: { properties: { id: { type: "string" } } },
        name: "get_post",
      },
    ])
    expect(result.content).toEqual([
      { text: '{"id":7,"title":"Draft"}', type: "text" },
    ])
    expect(received).toEqual([{ id: 7 }])
  })

  it("answers a request without a valid token with a 401 that points at the metadata", async () => {
    const response = await route.POST(
      new Request("https://app.example.com/mcp", {
        body: JSON.stringify({ id: 1, jsonrpc: "2.0", method: "tools/list" }),
        headers: {
          authorization: "Bearer expired",
          "content-type": "application/json",
        },
        method: "POST",
      })
    )

    expect(response.status).toBe(401)
    expect(response.headers.get("www-authenticate")).toContain(
      `resource_metadata="${METADATA_URL}"`
    )
  })

  it("refuses a write tool", () => {
    expect(() =>
      createMcpRoute({
        getContext: getBearerContext,
        name: "example",
        resourceMetadataUrl: METADATA_URL,
        tools: [renamePost as never],
        version: "1.0.0",
      })
    ).toThrow('"rename_post" writes, and this tool list serves reads only')
  })
})
