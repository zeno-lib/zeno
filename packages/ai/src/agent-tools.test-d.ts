import { createRequestDb } from "@zeno-lib/db/next"
import { streamText } from "ai"
import { MockLanguageModelV4 } from "ai/test"
import { expectTypeOf, test } from "vitest"
import { z } from "zod"
import type { AgentTool } from "./agent-tools.ts"
import {
  context,
  getBearerContext,
  getPost,
  renamePost,
  undescribedWrite,
} from "./fixtures.test-utils.ts"
import { createMcpRoute } from "./mcp.ts"
import { toAiSdkTools } from "./tools.ts"

type Context = typeof context

test("only an object-form export with describeChange on a write is a tool", () => {
  const { defineQuery } = createRequestDb({ supabase: () => ({}) as never })
  const positional = defineQuery(z.number(), (_db, input) => input)

  expectTypeOf(getPost).toExtend<AgentTool<Context>>()
  expectTypeOf(renamePost).toExtend<AgentTool<Context>>()
  expectTypeOf(undescribedWrite).not.toExtend<AgentTool<Context>>()
  expectTypeOf(positional).not.toExtend<AgentTool<Context>>()
})

test("createMcpRoute takes reads only, run as the bearer caller", () => {
  createMcpRoute({
    getContext: getBearerContext,
    name: "example",
    resourceMetadataUrl: "https://app.example.com/.well-known/x",
    tools: [getPost],
    version: "1.0.0",
  })
  createMcpRoute({
    getContext: getBearerContext,
    name: "example",
    resourceMetadataUrl: "https://app.example.com/.well-known/x",
    // @ts-expect-error: MCP serves no writes yet
    tools: [renamePost],
    version: "1.0.0",
  })
})

test("toAiSdkTools plugs into streamText as is", () => {
  const { toolApproval, tools } = toAiSdkTools([getPost, renamePost], context)
  streamText({
    model: new MockLanguageModelV4(),
    prompt: "Go.",
    toolApproval,
    tools,
  })
})
