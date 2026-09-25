import { cleanup, render, screen } from "@zeno-lib/test/testing-library"
import userEvent from "@zeno-lib/test/user-event"
import { afterEach, describe, expect, test, vi } from "vitest"
import { QueryErrorFallback } from "./query-error-fallback"

// @testing-library auto-cleanup only runs with `globals: true`; our vitest config keeps it off.
afterEach(cleanup)

/** An error whose message is empty or blank, as a failed fetch sometimes produces. */
const errorWithMessage = (message: string) =>
  Object.assign(new Error("placeholder"), { message })

describe("QueryErrorFallback (registry item)", () => {
  test("shows the error message and wires retry", async () => {
    const onRetry = vi.fn()
    render(<QueryErrorFallback error={new Error("boom")} onRetry={onRetry} />)

    expect(screen.getByText("boom")).toBeDefined()
    await userEvent.click(screen.getByRole("button", { name: "Try again" }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  test("falls back to fallbackMessage, then a generic message, when the error has none", () => {
    const { rerender } = render(
      <QueryErrorFallback
        error={errorWithMessage("  ")}
        fallbackMessage="Could not load notes."
        onRetry={vi.fn()}
      />
    )
    expect(screen.getByText("Could not load notes.")).toBeDefined()

    rerender(
      <QueryErrorFallback error={errorWithMessage("")} onRetry={vi.fn()} />
    )
    expect(screen.getByText("Something went wrong.")).toBeDefined()
  })

  test("hideRetry drops the button; buttonOnly drops the message and children", () => {
    const { rerender } = render(
      <QueryErrorFallback
        error={new Error("boom")}
        hideRetry
        onRetry={vi.fn()}
      />
    )
    expect(screen.queryByRole("button")).toBeNull()

    rerender(
      <QueryErrorFallback
        buttonOnly
        error={new Error("boom")}
        onRetry={vi.fn()}
        retryLabel="Reload"
      >
        <span>details</span>
      </QueryErrorFallback>
    )
    expect(screen.queryByText("boom")).toBeNull()
    expect(screen.queryByText("details")).toBeNull()
    expect(screen.getByRole("button", { name: "Reload" })).toBeDefined()
  })
})
