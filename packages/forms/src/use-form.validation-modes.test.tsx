import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, test, vi } from "vitest"
import { z } from "zod"

import { Form, FormProvider } from "./form"
import type { ValidationMode } from "./lib/validation-modes"
import { useForm } from "./use-form"

afterEach(() => {
  cleanup()
})

const schema = z.object({
  email: z.email("Enter a valid email"),
})

function Harness({ mode }: { mode?: ValidationMode }) {
  const form = useForm({
    onSubmit: vi.fn(),
    schema,
    validators: mode,
  })
  const { EmailField, SubmitButton } = form
  return (
    <FormProvider form={form}>
      <Form>
        <EmailField label="Email" />
        <SubmitButton>Submit</SubmitButton>
      </Form>
    </FormProvider>
  )
}

const ERROR = /Enter a valid email/i
const EMAIL_LABEL = /Email/

function getInput() {
  return screen.getByLabelText(EMAIL_LABEL) as HTMLInputElement
}
function isInvalid() {
  return getInput().getAttribute("aria-invalid") === "true"
}

describe("validation mode: blur-then-change (default)", () => {
  test("hidden while typing pristine", async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.type(getInput(), "bad")
    expect(screen.queryByText(ERROR)).toBeNull()
    expect(isInvalid()).toBe(false)
  })

  test("shown after blur with invalid value", async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.type(getInput(), "bad")
    await user.tab()
    expect(screen.queryByText(ERROR)).not.toBeNull()
    expect(isInvalid()).toBe(true)
  })

  test("stickiness fix: blur invalid, fix value, error clears live", async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.type(getInput(), "bad")
    await user.tab()
    expect(screen.queryByText(ERROR)).not.toBeNull()
    // Focus back, fix the value — error should clear without re-blur.
    await user.click(getInput())
    await user.clear(getInput())
    await user.type(getInput(), "ok@example.com")
    expect(screen.queryByText(ERROR)).toBeNull()
    expect(isInvalid()).toBe(false)
  })
})

describe("validation mode: change", () => {
  test("shown live as soon as the user types invalid", async () => {
    const user = userEvent.setup()
    render(<Harness mode="change" />)
    await user.type(getInput(), "bad")
    expect(screen.queryByText(ERROR)).not.toBeNull()
    expect(isInvalid()).toBe(true)
  })

  test("clears live when value becomes valid", async () => {
    const user = userEvent.setup()
    render(<Harness mode="change" />)
    await user.type(getInput(), "bad")
    expect(screen.queryByText(ERROR)).not.toBeNull()
    await user.clear(getInput())
    await user.type(getInput(), "ok@example.com")
    expect(screen.queryByText(ERROR)).toBeNull()
  })
})

describe("validation mode: blur", () => {
  test("hidden while typing pristine; shown only after blur", async () => {
    const user = userEvent.setup()
    render(<Harness mode="blur" />)
    await user.type(getInput(), "bad")
    expect(screen.queryByText(ERROR)).toBeNull()
    await user.tab()
    expect(screen.queryByText(ERROR)).not.toBeNull()
  })
})

describe("validation mode: submit", () => {
  test("hidden until submit attempt", async () => {
    const user = userEvent.setup()
    render(<Harness mode="submit" />)
    await user.type(getInput(), "bad")
    await user.tab()
    expect(screen.queryByText(ERROR)).toBeNull()
    await user.click(screen.getByRole("button", { name: "Submit" }))
    expect(screen.queryByText(ERROR)).not.toBeNull()
  })
})

describe("per-field validators bypass form-level gating", () => {
  test("per-field onChange flips aria-invalid live, even with a blur-then-change form schema", async () => {
    const user = userEvent.setup()
    const validator = vi.fn(({ value }: { value: string }) =>
      value === "nope" ? "Field-level live error" : undefined
    )
    function H() {
      const form = useForm({
        onSubmit: vi.fn(),
        schema,
      })
      const { EmailField } = form
      return (
        <FormProvider form={form}>
          <Form>
            <EmailField label="Email" validators={{ onChange: validator }} />
          </Form>
        </FormProvider>
      )
    }
    render(<H />)
    await user.type(getInput(), "nope")
    expect(validator).toHaveBeenCalled()
    // No blur yet — the form-level schema is gated, but the per-field
    // onChange is honoured directly by `useIsInvalid` and flips the field
    // invalid live (no submit attempt, no blur).
    expect(isInvalid()).toBe(true)
  })
})
