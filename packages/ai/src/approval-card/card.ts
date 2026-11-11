// The approval card's script, bundled into the card's HTML at build time. It
// runs in the host's sandboxed iframe: every value is set as text, never as
// HTML, because the entity and the values come from the database.
import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext,
} from "@modelcontextprotocol/ext-apps"
import type { ChangeDescription } from "@zeno-lib/db/next"
import { formatValue, singleLine } from "../agent-tools.ts"
import {
  APPLY_TOOL,
  type ApprovalContent,
  PROPOSAL_META_KEY,
} from "../approval-protocol.ts"

type ToolResult = {
  readonly content?: readonly {
    readonly type: string
    readonly text?: string
  }[]
  readonly isError?: boolean
  readonly structuredContent?: Record<string, unknown>
  readonly _meta?: Record<string, unknown>
}

const element = <T extends HTMLElement>(id: string) =>
  document.querySelector(`#${id}`) as T

const entity = element<HTMLHeadingElement>("entity")
const eyebrow = element("eyebrow")
const table = element<HTMLTableElement>("changes")
const rows = element<HTMLTableSectionElement>("rows")
const note = element("note")
const actions = element("actions")
const confirm = element<HTMLButtonElement>("confirm")
const cancel = element<HTMLButtonElement>("cancel")
const status = element("status")

const app = new App({ name: "Change approval", version: "1.0.0" })

let proposal: string | undefined
let shown: ChangeDescription | undefined

const say = (text: string, tone: "info" | "success" | "danger" = "info") => {
  status.textContent = text
  status.dataset.tone = tone
}

const showChange = (change: ChangeDescription) => {
  shown = change
  entity.textContent = singleLine(change.entity).trim()
  rows.replaceChildren(
    ...change.changes.map(({ field, from, to }) => {
      const row = document.createElement("tr")
      const name = document.createElement("th")
      name.scope = "row"
      name.textContent = singleLine(field)
      row.append(name)
      for (const [value, label] of [
        [from, "old"],
        [to, "new"],
      ] as const) {
        const cell = document.createElement("td")
        cell.className = label
        cell.textContent = formatValue(value)
        row.append(cell)
      }
      return row
    })
  )
  table.hidden = change.changes.length === 0
  note.hidden = change.changes.length > 0
  note.textContent = "This change sets no fields."
}

const setPending = (pending: boolean) => {
  confirm.disabled = pending
  cancel.disabled = pending
  confirm.setAttribute("aria-busy", String(pending))
}

// Ends the card: no button left to press.
const close = () => {
  proposal = undefined
  actions.hidden = true
}

const tellModel = async (text: string) => {
  if (!app.getHostCapabilities()?.updateModelContext) {
    return
  }
  try {
    await app.updateModelContext({ content: [{ text, type: "text" }] })
  } catch {
    // The host keeps its own record of the outcome; the card has shown it.
  }
}

const describeEntity = () =>
  shown ? `"${singleLine(shown.entity).trim()}"` : "the record"

const textOf = (result: ToolResult) =>
  result.content
    ?.map((block) => block.text ?? "")
    .join("\n")
    .trim() || "The server gave no reason."

const contentOf = (result: ToolResult) =>
  result.structuredContent as ApprovalContent | undefined

const proposalOf = (result: ToolResult) => {
  const sealed = result._meta?.[PROPOSAL_META_KEY]
  return typeof sealed === "string" ? sealed : undefined
}

const showProposal = (result: ToolResult) => {
  const content = contentOf(result)
  const sealed = proposalOf(result)
  if (result.isError || content?.status !== "proposed" || !sealed) {
    eyebrow.textContent = "Change not proposed"
    entity.textContent = "This change can't be shown"
    say(textOf(result), "danger")
    close()
    return
  }
  proposal = sealed
  showChange(content.change)
  actions.hidden = false
  setPending(false)
  say("Nothing is saved until you confirm.")
}

const showOutcome = async (result: ToolResult) => {
  const content = contentOf(result)
  const entityName = describeEntity()
  switch (content?.status) {
    case "applied":
      eyebrow.textContent = "Change saved"
      showChange(content.change)
      say("Saved.", "success")
      close()
      await tellModel(
        `The user confirmed the change to ${entityName}. It is saved.`
      )
      return
    case "stale": {
      // The record moved: show what confirming would do now, with the fresh
      // proposal the server sealed for it.
      const sealed = proposalOf(result)
      showChange(content.change)
      eyebrow.textContent = "Record changed"
      if (sealed) {
        proposal = sealed
        setPending(false)
        say(
          "This record changed since the change was proposed. Review the change as it is now, then confirm again.",
          "danger"
        )
      } else {
        close()
        say("This record changed since the change was proposed.", "danger")
      }
      return
    }
    case "expired":
    case "used":
    case "wrong-user":
    case "invalid":
    case "failed":
      eyebrow.textContent =
        content.status === "used" ? "Already saved" : "Change not saved"
      say(content.message, content.status === "used" ? "info" : "danger")
      close()
      await tellModel(
        `The change to ${entityName} was not saved: ${content.message}`
      )
      return
    default:
      say(textOf(result), "danger")
      setPending(false)
  }
}

confirm.addEventListener("click", async () => {
  if (!proposal) {
    return
  }
  setPending(true)
  say("Saving…")
  try {
    const result = await app.callServerTool({
      arguments: { proposal },
      name: APPLY_TOOL,
    })
    await showOutcome(result as ToolResult)
  } catch (error) {
    // The request never reached the tool, or the host refused it.
    say(
      `The change could not be sent: ${error instanceof Error ? error.message : String(error)}`,
      "danger"
    )
    setPending(false)
  }
})

cancel.addEventListener("click", async () => {
  eyebrow.textContent = "Change cancelled"
  say("Cancelled. Nothing was saved.")
  close()
  await tellModel(
    `The user cancelled the change to ${describeEntity()}. Nothing was saved.`
  )
})

const applyHostContext = (context: McpUiHostContext) => {
  if (context.theme) {
    applyDocumentTheme(context.theme)
  }
  if (context.styles?.variables) {
    applyHostStyleVariables(context.styles.variables)
  }
  if (context.styles?.css?.fonts) {
    applyHostFonts(context.styles.css.fonts)
  }
}

app.ontoolresult = (result) => showProposal(result as ToolResult)
app.ontoolcancelled = () => {
  eyebrow.textContent = "Change not proposed"
  say("The request was cancelled before the change was described.")
  close()
}
app.onhostcontextchanged = applyHostContext

app.connect().then(
  () => {
    const hostContext = app.getHostContext()
    if (hostContext) {
      applyHostContext(hostContext)
    }
  },
  () => say("This card could not reach the chat it is shown in.", "danger")
)
