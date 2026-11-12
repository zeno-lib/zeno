import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client"
import { SessionRevokedError } from "@zeno-lib/db/next"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { CARD_URI, PROPOSAL_META_KEY } from "./approval-protocol.ts"
import {
  getBearerContext,
  getCheckedPost,
  getHiddenPost,
  getPost,
  listPosts,
  received,
  renamePost,
  retitlePost,
  titles,
} from "./fixtures.test-utils.ts"
import {
  createMcpRoute,
  type McpToolCall,
  type McpWrites,
  ProposalRefusedError,
  ToolInputError,
  type UsedProposal,
} from "./mcp.ts"

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

const clients: Client[] = []

const connect = async (
  mode: "legacy" | { pin: string },
  target: typeof route = route,
  token = "good"
) => {
  const client = new Client(
    { name: "test", version: "1.0.0" },
    { versionNegotiation: { mode } }
  )
  clients.push(client)
  await client.connect(
    new StreamableHTTPClientTransport(new URL("https://app.example.com/mcp"), {
      fetch: routeFetch(token, target),
    })
  )
  return client
}

beforeEach(() => {
  received.length = 0
})

afterEach(async () => {
  await Promise.all(clients.map((client) => client.close()))
  clients.length = 0
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

describe("createMcpRoute writes", () => {
  const SECRET = "a-test-secret-that-is-long-enough-to-sign"
  const used = new Set<string>()
  const marked: UsedProposal[] = []
  const calls: McpToolCall[] = []

  const writeRoute = (
    writes: Partial<
      McpWrites<Awaited<ReturnType<typeof getBearerContext>>>
    > = {}
  ) =>
    createMcpRoute({
      getContext: getBearerContext,
      name: "example",
      onToolCall: (call) => {
        calls.push(call)
      },
      resourceMetadataUrl: METADATA_URL,
      tools: [getPost],
      version: "1.0.0",
      writes: {
        markUsed: (proposal) => {
          marked.push(proposal)
          if (used.has(proposal.id)) {
            return false
          }
          used.add(proposal.id)
          return true
        },
        secret: SECRET,
        tools: [retitlePost],
        ...writes,
      },
    })

  type Result = Awaited<ReturnType<Client["callTool"]>>

  const proposalOf = (result: Result) =>
    (result._meta as Record<string, unknown> | undefined)?.[
      PROPOSAL_META_KEY
    ] as string

  const propose = async (connected: Client, title = "Launch") => {
    const result = await connected.callTool({
      arguments: { id: "7", title },
      name: "retitle_post",
    })
    return { proposal: proposalOf(result), result }
  }

  const apply = (connected: Client, proposal: string) =>
    connected.callTool({ arguments: { proposal }, name: "apply_change" })

  beforeEach(() => {
    titles.clear()
    titles.set(7, "Draft")
    used.clear()
    marked.length = 0
    calls.length = 0
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it.each([
    ["2026-07-28", { pin: "2026-07-28" }],
    ["the 2025 initialize fallback", "legacy"],
  ] as const)(
    "proposes the change for the card and writes nothing, over %s",
    async (_, mode) => {
      const connected = await connect(mode, writeRoute())

      const { tools } = await connected.listTools()
      const { proposal, result } = await propose(connected)
      const card = await connected.readResource({ uri: CARD_URI })

      expect(tools).toMatchObject([
        { name: "get_post" },
        {
          _meta: { ui: { resourceUri: CARD_URI } },
          annotations: { readOnlyHint: true },
          name: "retitle_post",
        },
        {
          _meta: { ui: { resourceUri: CARD_URI, visibility: ["app"] } },
          name: "apply_change",
        },
      ])
      expect(result.isError).toBeFalsy()
      expect(result.structuredContent).toEqual({
        change: {
          changes: [{ field: "title", from: "Draft", to: "Launch" }],
          entity: "Post 7",
        },
        status: "proposed",
      })
      expect(proposal).toEqual(expect.any(String))
      expect(result.content).toEqual([
        {
          text: expect.stringContaining("Nothing is saved until they confirm"),
          type: "text",
        },
      ])
      expect(card.contents).toMatchObject([
        {
          mimeType: "text/html;profile=mcp-app",
          text: expect.stringContaining('<script type="module">'),
          uri: CARD_URI,
        },
      ])
      expect(received).toEqual([])
      expect(titles.get(7)).toBe("Draft")
    }
  )

  it("applies a confirmed proposal once, and refuses it again", async () => {
    const connected = await connect({ pin: "2026-07-28" }, writeRoute())
    const { proposal } = await propose(connected)

    const applied = await apply(connected, proposal)
    const replayed = await apply(connected, proposal)

    expect(applied.isError).toBeFalsy()
    expect(applied.structuredContent).toMatchObject({ status: "applied" })
    expect(replayed).toMatchObject({
      isError: true,
      structuredContent: { status: "used" },
    })
    expect(received).toEqual([{ id: 7, title: "Launch" }])
    expect(titles.get(7)).toBe("Launch")
    expect(marked).toEqual([
      expect.objectContaining({ tool: "retitle_post", user: "user-1" }),
      expect.objectContaining({ id: marked[0]?.id }),
    ])
  })

  it("reports the propose and apply calls to onToolCall", async () => {
    const connected = await connect({ pin: "2026-07-28" }, writeRoute())
    const { proposal } = await propose(connected)
    await apply(connected, proposal)
    await apply(connected, proposal)

    const proposalId = marked[0]?.id
    expect(calls).toMatchObject([
      {
        input: { id: 7, title: "Launch" },
        name: "retitle_post",
        ok: true,
        result: { change: { entity: "Post 7" }, proposalId },
      },
      {
        input: {
          input: { id: "7", title: "Launch" },
          proposalId,
          tool: "retitle_post",
        },
        name: "apply_change",
        ok: true,
        result: { retitled: 7 },
      },
      { name: "apply_change", ok: false },
    ])
    const [, , refused] = calls
    expect(refused?.ok === false && refused.error).toBeInstanceOf(
      ProposalRefusedError
    )
    expect(refused?.ok === false && refused.error).toMatchObject({
      reason: "used",
    })
  })

  // Swaps the sealed payload's title, keeping the signature.
  const tamper = (proposal: string) => {
    const [version, payload, signature] = proposal.split(".")
    const decoded = JSON.parse(
      Buffer.from(payload ?? "", "base64url").toString()
    )
    decoded.input.title = "Hijacked"
    const forged = Buffer.from(JSON.stringify(decoded)).toString("base64url")
    return `${version}.${forged}.${signature}`
  }

  it.each([
    ["an edited proposal", tamper],
    ["a made-up proposal", () => "zp1.e30.AAAA"],
    // A base64url length `atob` throws on.
    ["an undecodable signature", () => "zp1.e30.A"],
    ["not a proposal", () => "anything"],
  ])("refuses %s as invalid", async (_, forge) => {
    const connected = await connect({ pin: "2026-07-28" }, writeRoute())
    const { proposal } = await propose(connected)

    const result = await apply(connected, forge(proposal))

    expect(result).toMatchObject({
      isError: true,
      structuredContent: { status: "invalid" },
    })
    expect(received).toEqual([])
    expect(marked).toEqual([])
  })

  it("refuses a proposal another server's secret sealed", async () => {
    const other = await connect(
      { pin: "2026-07-28" },
      writeRoute({ secret: "another-secret-that-is-also-long-enough" })
    )
    const { proposal } = await propose(other)
    const connected = await connect({ pin: "2026-07-28" }, writeRoute())

    await expect(apply(connected, proposal)).resolves.toMatchObject({
      structuredContent: { status: "invalid" },
    })
    expect(received).toEqual([])
  })

  it("verifies with a rotated-out secret while it is still listed", async () => {
    const old = await connect({ pin: "2026-07-28" }, writeRoute())
    const { proposal } = await propose(old)
    const connected = await connect(
      { pin: "2026-07-28" },
      writeRoute({
        secret: ["a-new-secret-that-is-long-enough-to-sign", SECRET],
      })
    )

    await expect(apply(connected, proposal)).resolves.toMatchObject({
      structuredContent: { status: "applied" },
    })
  })

  it("refuses an expired proposal", async () => {
    const connected = await connect({ pin: "2026-07-28" }, writeRoute())
    const { proposal } = await propose(connected)
    const now = Date.now()
    vi.spyOn(Date, "now").mockReturnValue(now + 600_001)

    const result = await apply(connected, proposal)

    expect(result).toMatchObject({
      isError: true,
      structuredContent: { status: "expired" },
    })
    expect(received).toEqual([])
    expect(marked).toEqual([])
  })

  it("refuses another user's proposal", async () => {
    const target = writeRoute()
    const mine = await connect({ pin: "2026-07-28" }, target)
    const { proposal } = await propose(mine)
    const theirs = await connect({ pin: "2026-07-28" }, target, "other")

    const result = await apply(theirs, proposal)

    expect(result).toMatchObject({
      isError: true,
      structuredContent: { status: "wrong-user" },
    })
    expect(received).toEqual([])
    expect(marked).toEqual([])
  })

  it("refuses a stale proposal with the new change, which the user can confirm", async () => {
    const connected = await connect({ pin: "2026-07-28" }, writeRoute())
    const { proposal } = await propose(connected)
    titles.set(7, "Edited elsewhere")

    const stale = await apply(connected, proposal)

    expect(stale).toMatchObject({
      isError: true,
      structuredContent: {
        change: {
          changes: [{ field: "title", from: "Edited elsewhere", to: "Launch" }],
        },
        status: "stale",
      },
    })
    expect(received).toEqual([])

    const fresh = proposalOf(stale)
    expect(fresh).not.toBe(proposal)
    await expect(apply(connected, fresh)).resolves.toMatchObject({
      structuredContent: { status: "applied" },
    })
    expect(titles.get(7)).toBe("Launch")
  })

  it.each([
    ["without writes", route],
    ["with writes its enabled refuses", writeRoute({ enabled: () => false })],
  ])("serves reads alone %s", async (_, target) => {
    const connected = await connect({ pin: "2026-07-28" }, target)

    const { tools } = await connected.listTools()

    expect(tools.map(({ name }) => name)).not.toContain("apply_change")
    expect(tools.map(({ name }) => name)).not.toContain("retitle_post")
    expect(connected.getServerCapabilities()?.resources).toBeUndefined()
  })

  it.each([
    [{ secret: "too-short" }, "at least 32 characters"],
    [{ tools: [getPost as never] }, '"get_post" reads: serve it in tools'],
  ])("refuses writes configured with %o", (writes, message) => {
    expect(() => writeRoute(writes)).toThrow(message)
  })
})
