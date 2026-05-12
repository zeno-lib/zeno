import { act, cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { z } from "zod"

import { Form, FormProvider } from "./form"
import { useForm } from "./use-form"

let addSpy: ReturnType<typeof vi.spyOn>
let removeSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  addSpy = vi.spyOn(window, "addEventListener")
  removeSpy = vi.spyOn(window, "removeEventListener")
})

afterEach(() => {
  cleanup()
  addSpy.mockRestore()
  removeSpy.mockRestore()
})

function countBeforeunloadListeners() {
  const added = addSpy.mock.calls.filter(
    (call: unknown[]) => call[0] === "beforeunload"
  ).length
  const removed = removeSpy.mock.calls.filter(
    (call: unknown[]) => call[0] === "beforeunload"
  ).length
  return added - removed
}

const schema = z.object({
  name: z.string(),
})

describe("useUnsavedChangesWarning — disabled", () => {
  test("no listener attached when option is false (default)", () => {
    function H() {
      const form = useForm({ onSubmit: vi.fn(), schema })
      const { InputField } = form
      return (
        <FormProvider form={form}>
          <Form>
            <InputField label="Name" name="name" />
          </Form>
        </FormProvider>
      )
    }
    render(<H />)
    expect(countBeforeunloadListeners()).toBe(0)
  })
})

describe("useUnsavedChangesWarning — 'if-changed' (and `true`)", () => {
  test("listener attaches once values diverge from defaults", async () => {
    const user = userEvent.setup()
    function H() {
      const form = useForm({
        onSubmit: vi.fn(),
        schema,
        unsavedChangesWarning: "if-changed",
      })
      const { InputField } = form
      return (
        <FormProvider form={form}>
          <Form>
            <InputField label="Name" name="name" />
          </Form>
        </FormProvider>
      )
    }
    render(<H />)
    expect(countBeforeunloadListeners()).toBe(0)
    await user.type(screen.getByLabelText(/Name/), "Alice")
    expect(countBeforeunloadListeners()).toBe(1)
  })

  test("`true` is shorthand for 'if-changed'", async () => {
    const user = userEvent.setup()
    function H() {
      const form = useForm({
        onSubmit: vi.fn(),
        schema,
        unsavedChangesWarning: true,
      })
      const { InputField } = form
      return (
        <FormProvider form={form}>
          <Form>
            <InputField label="Name" name="name" />
          </Form>
        </FormProvider>
      )
    }
    render(<H />)
    expect(countBeforeunloadListeners()).toBe(0)
    await user.type(screen.getByLabelText(/Name/), "Alice")
    expect(countBeforeunloadListeners()).toBe(1)
  })

  test("listener detaches when value reverts to defaults", async () => {
    const user = userEvent.setup()
    function H() {
      const form = useForm({
        onSubmit: vi.fn(),
        schema,
        unsavedChangesWarning: "if-changed",
      })
      const { InputField } = form
      return (
        <FormProvider form={form}>
          <Form>
            <InputField label="Name" name="name" />
          </Form>
        </FormProvider>
      )
    }
    render(<H />)
    const input = screen.getByLabelText(/Name/) as HTMLInputElement
    await user.type(input, "Alice")
    expect(countBeforeunloadListeners()).toBe(1)
    await user.clear(input)
    expect(countBeforeunloadListeners()).toBe(0)
  })
})

describe("useUnsavedChangesWarning — 'if-touched'", () => {
  test("listener attaches on first edit and stays attached after revert", async () => {
    const user = userEvent.setup()
    function H() {
      const form = useForm({
        onSubmit: vi.fn(),
        schema,
        unsavedChangesWarning: "if-touched",
      })
      const { InputField } = form
      return (
        <FormProvider form={form}>
          <Form>
            <InputField label="Name" name="name" />
          </Form>
        </FormProvider>
      )
    }
    render(<H />)
    expect(countBeforeunloadListeners()).toBe(0)
    const input = screen.getByLabelText(/Name/) as HTMLInputElement
    await user.type(input, "Alice")
    expect(countBeforeunloadListeners()).toBe(1)
    // Revert — `if-touched` is sticky once edited.
    await user.clear(input)
    expect(countBeforeunloadListeners()).toBe(1)
  })
})

describe("useUnsavedChangesWarning — beforeunload event behaviour", () => {
  test("preventDefault is called and returnValue is set", async () => {
    const user = userEvent.setup()
    function H() {
      const form = useForm({
        onSubmit: vi.fn(),
        schema,
        unsavedChangesWarning: "if-changed",
      })
      const { InputField } = form
      return (
        <FormProvider form={form}>
          <Form>
            <InputField label="Name" name="name" />
          </Form>
        </FormProvider>
      )
    }
    render(<H />)
    await user.type(screen.getByLabelText(/Name/), "Alice")
    const event = new Event("beforeunload", { cancelable: true })
    act(() => {
      window.dispatchEvent(event)
    })
    expect(event.defaultPrevented).toBe(true)
  })
})
