import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client"
import { SessionRevokedError } from "@zeno-lib/db/next"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  getBearerContext,
  getCheckedPost,
  getHiddenPost,
  getPost,
  listPosts,
  received,
  renamePost,
} from "./fixtures.test-utils.ts"
import { createMcpRoute, type McpToolCall, ToolInputError } from "./mcp.ts"

const METADATA_URL =
  "https://app.example.com/.well-known/oauth-protected-resource/mcp"

const route = createMcpRoute({
  getContext: getBearerContext,
  name: "example",
  resourceMetadataUrl: () => METADATA_URL,
  tools: [getPost, listPosts],
  version: "1.0.0",
})

// Sends the client's requests straight to the route handlers, with a token.
const routeFetch =
  (token: string, target: typeof route) =>
  (url: string | URL, init?: RequestInit) => {
    const request = new Request(url, init)
    request.headers.set("authorization", `Bearer ${token}`)
    const method = request.method as "DELETE" | "GET" | "POST"
    return target[method](request)
  }

let client: Client | undefined

const connect = async (
  mode: "legacy" | { pin: string },
  target: typeof route = route
) => {
  client = new Client(
    { name: "test", version: "1.0.0" },
    { versionNegotiation: { mode } }
  )
  await client.connect(
    new StreamableHTTPClientTransport(new URL("https://app.example.com/mcp"), {
      fetch: routeFetch("good", target),
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
      { name: "list_posts" },
    ])
    expect(result.content).toEqual([
      { text: '{"id":7,"title":"Draft"}', type: "text" },
    ])
    expect(received).toEqual([{ id: 7 }])
  })

  it("lists a paged query's limit and offset, and checks them before it runs", async () => {
    const connected = await connect({ pin: "2026-07-28" })
    const { tools } = await connected.listTools()

    expect(tools.find(({ name }) => name === "list_posts")).toMatchObject({
      inputSchema: {
        properties: {
          limit: { type: "integer" },
          offset: { type: "integer" },
          status: { enum: ["draft", "published"] },
        },
      },
    })
    await expect(
      connected.callTool({ arguments: { limit: 1000 }, name: "list_posts" })
    ).resolves.toMatchObject({ isError: true })
    await connected.callTool({
      arguments: { status: "draft" },
      name: "list_posts",
    })
    expect(received).toMatchObject([{ offset: 0, status: "draft" }])
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

  it("answers a revoked session with a 401 too", async () => {
    // A context that queries throws this for a banned user's valid token.
    const revokedRoute = createMcpRoute({
      getContext: () => Promise.reject(new SessionRevokedError("user_banned")),
      name: "example",
      resourceMetadataUrl: METADATA_URL,
      tools: [getPost],
      version: "1.0.0",
    })

    const response = await revokedRoute.POST(
      new Request("https://app.example.com/mcp", {
        body: JSON.stringify({ id: 1, jsonrpc: "2.0", method: "tools/list" }),
        headers: {
          authorization: "Bearer good",
          "content-type": "application/json",
        },
        method: "POST",
      })
    )

    expect(response.status).toBe(401)
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

  describe("onToolCall", () => {
    const calls: [McpToolCall, unknown][] = []
    const errors: Error[] = []

    const auditedRoute = (
      onToolCall: Parameters<typeof createMcpRoute>[0]["onToolCall"] = (
        call,
        context
      ) => {
        calls.push([call, context])
      }
    ) =>
      createMcpRoute({
        getContext: getBearerContext,
        name: "example",
        onError: (error) => errors.push(error),
        onToolCall,
        resourceMetadataUrl: METADATA_URL,
        tools: [getPost, getHiddenPost, getCheckedPost, listPosts],
        version: "1.0.0",
      })

    beforeEach(() => {
      calls.length = 0
      errors.length = 0
    })

    it("reports a success with the parsed input, the result and the caller", async () => {
      const connected = await connect({ pin: "2026-07-28" }, auditedRoute())

      await connected.callTool({ arguments: { id: "7" }, name: "get_post" })

      expect(calls).toEqual([
        [
          {
            durationMs: expect.any(Number),
            input: { id: 7 },
            name: "get_post",
            ok: true,
            result: { id: 7, title: "Draft" },
          },
          expect.objectContaining({
            claims: expect.objectContaining({ sub: "user-1" }),
            via: "Claude",
          }),
        ],
      ])
    })

    it("reports a tool that throws, and the client still gets its error", async () => {
      const connected = await connect({ pin: "2026-07-28" }, auditedRoute())

      const result = await connected.callTool({
        arguments: {},
        name: "get_hidden_post",
      })

      expect(result).toMatchObject({
        content: [{ text: "No post 9 for this user" }],
        isError: true,
      })
      expect(calls).toHaveLength(1)
      expect(calls[0]?.[0]).toMatchObject({
        error: new Error("No post 9 for this user"),
        input: {},
        name: "get_hidden_post",
        ok: false,
      })
    })

    it("reports input the schema refuses, with the raw arguments, before the tool runs", async () => {
      const connected = await connect({ pin: "2026-07-28" }, auditedRoute())

      const result = await connected.callTool({
        arguments: { limit: 1000 },
        name: "list_posts",
      })

      expect(result).toMatchObject({ isError: true })
      expect(received).toEqual([])
      expect(calls).toHaveLength(1)
      const [call] = calls[0] ?? []
      expect(call).toMatchObject({
        input: { limit: 1000 },
        name: "list_posts",
        ok: false,
      })
      expect(call?.ok === false && call.error).toBeInstanceOf(ToolInputError)
      expect(call?.ok === false && call.error).toMatchObject({
        issues: [expect.objectContaining({ path: ["limit"] })],
        message: expect.stringContaining("list_posts: limit: "),
      })
    })

    it("reports a schema that throws, before the tool runs", async () => {
      const connected = await connect({ pin: "2026-07-28" }, auditedRoute())

      const result = await connected.callTool({
        arguments: {},
        name: "get_checked_post",
      })

      expect(result).toMatchObject({ isError: true })
      expect(received).toEqual([])
      expect(calls.map(([call]) => call)).toMatchObject([
        {
          error: new Error("Lookup unavailable"),
          input: {},
          name: "get_checked_post",
          ok: false,
        },
      ])
    })

    it.each([
      ["2026-07-28", { pin: "2026-07-28" }],
      ["the 2025 initialize fallback", "legacy"],
    ] as const)(
      "leaves the answer unchanged when it throws, over %s, and passes the error to onError",
      async (_, mode) => {
        const failure = new Error("audit log unreachable")
        const connected = await connect(
          mode,
          auditedRoute(() => Promise.reject(failure))
        )

        const result = await connected.callTool({
          arguments: { id: "7" },
          name: "get_post",
        })

        expect(result.isError).toBeFalsy()
        expect(result.content).toEqual([
          { text: '{"id":7,"title":"Draft"}', type: "text" },
        ])
        expect(errors).toEqual([failure])
      }
    )
  })
})
