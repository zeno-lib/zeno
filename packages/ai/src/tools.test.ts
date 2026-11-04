import { generateText, type ModelMessage, type ToolApprovalResponse } from "ai"
import { MockLanguageModelV4 } from "ai/test"
import { beforeEach, describe, expect, it } from "vitest"
import {
  context,
  getPost,
  hiddenPost,
  received,
  renamePost,
  undescribedWrite,
} from "./fixtures.test-utils.ts"
import { toAiSdkTools } from "./tools.ts"

const usage = {
  inputTokens: { cacheRead: 0, cacheWrite: 0, noCache: 1, total: 1 },
  outputTokens: { reasoning: 0, text: 1, total: 1 },
}

/** Calls `toolName` once, then answers in text once the prompt holds a tool message. */
const callTool = (toolName: string, input: unknown) =>
  new MockLanguageModelV4({
    doGenerate: ({ prompt }) =>
      Promise.resolve(
        prompt.some((message) => message.role === "tool")
          ? {
              content: [{ text: "Done.", type: "text" as const }],
              finishReason: { raw: "stop", unified: "stop" as const },
              usage,
              warnings: [],
            }
          : {
              content: [
                {
                  input: JSON.stringify(input),
                  toolCallId: "call-1",
                  toolName,
                  type: "tool-call" as const,
                },
              ],
              finishReason: { raw: "tool_use", unified: "tool-calls" as const },
              usage,
              warnings: [],
            }
      ),
  })

const run = (toolName: string, input: unknown) => {
  const { toolApproval, tools } = toAiSdkTools(
    [getPost, renamePost, hiddenPost],
    context
  )
  return generateText({
    model: callTool(toolName, input),
    prompt: "Go.",
    toolApproval,
    tools,
  })
}

beforeEach(() => {
  received.length = 0
})

describe("toAiSdkTools", () => {
  it("runs a read without approval, parsing its input once", async () => {
    const result = await run("get_post", { id: "7" })

    expect(result.toolResults).toMatchObject([
      { output: { id: 7, title: "Draft" } },
    ])
    expect(received).toEqual([{ id: 7 }])
  })

  it("holds a write for approval, with the change as the reason", async () => {
    const result = await run("rename_post", { id: "7", title: "Launch" })

    expect(
      result.content.filter((part) => part.type === "tool-approval-request")
    ).toMatchObject([{ reason: 'Post 7\ntitle: "Draft" → "Launch"' }])
    expect(received).toEqual([])
  })

  it("runs an approved write once, from the raw input", async () => {
    const { toolApproval, tools } = toAiSdkTools([renamePost], context)
    const model = callTool("rename_post", { id: "7", title: "Launch" })
    const messages: ModelMessage[] = [{ content: "Go.", role: "user" }]
    const first = await generateText({ messages, model, toolApproval, tools })
    const request = first.content.find(
      (part) => part.type === "tool-approval-request"
    )
    const approval: ToolApprovalResponse = {
      approvalId: request?.approvalId ?? "",
      approved: true,
      type: "tool-approval-response",
    }

    await generateText({
      messages: [
        ...messages,
        ...first.response.messages,
        { content: [approval], role: "tool" },
      ],
      model,
      toolApproval,
      tools,
    })

    expect(received).toEqual([{ id: 7, title: "Launch" }])
  })

  it("still asks before a write when the route forgets toolApproval", async () => {
    const { tools } = toAiSdkTools([renamePost], context)
    const result = await generateText({
      model: callTool("rename_post", { id: "7", title: "Launch" }),
      prompt: "Go.",
      tools,
    })

    expect(result.content.map((part) => part.type)).toContain(
      "tool-approval-request"
    )
    expect(received).toEqual([])
  })

  it("denies a write whose change can't be read, without asking the user", async () => {
    const result = await run("rename_hidden_post", {})

    expect(
      result.content.filter((part) => part.type === "tool-approval-response")
    ).toMatchObject([
      {
        approved: false,
        reason:
          "Could not read what this change would do: No post 9 for this user",
      },
    ])
    expect(received).toEqual([])
  })

  it("refuses input the schema rejects before asking for approval", async () => {
    const result = await run("rename_post", { id: "7" })

    expect(result.content.map((part) => part.type)).toEqual([
      "tool-call",
      "tool-error",
    ])
  })

  it("refuses a write without describeChange", () => {
    expect(() => toAiSdkTools([undescribedWrite as never], context)).toThrow(
      '"save_post" writes, so it needs a describeChange'
    )
  })

  it("refuses two tools with one name", () => {
    expect(() => toAiSdkTools([getPost, getPost], context)).toThrow(
      'Two agent tools are named "get_post"'
    )
  })
})
