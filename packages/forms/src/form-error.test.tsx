import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@zeno-lib/test/testing-library"
import userEvent from "@zeno-lib/test/user-event"
import { afterEach, describe, expect, test, vi } from "vitest"
import { z } from "zod"
import { Form, FormProvider, useForm } from "./create-form"
import type { ActionResult } from "./lib/action-result"
import { submitAction } from "./lib/submit-action"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const NAME = /Name/
const SUBMIT = { name: "Submit" }

const schema = z.object({ name: z.string().min(1, "Required") })
type Values = z.infer<typeof schema>
const ADA: Values = { name: "Ada" }

// Browsers drop focus to the body when the focused submit button is disabled
// for the submit; jsdom keeps it there (and can't blur a disabled button).
// Drop it as a browser would: through an element that is then removed.
function dropFocus() {
  const sink = document.createElement("input")
  document.body.append(sink)
  sink.focus()
  sink.remove()
}

function Profile({ onSubmit }: { onSubmit: (values: Values) => unknown }) {
  const form = useForm({
    defaultValues: ADA,
    onSubmit: ({ value }) => onSubmit(value),
    schema,
  })
  const { FormError, InputField, ResetButton, SubmitButton } = form
  return (
    <FormProvider form={form}>
      <Form id="profile">
        <InputField label="Name" name="name" />
      </Form>
      {/* Outside the <form>: FormError finds the form through context. */}
      <FormError />
      <ResetButton />
      <SubmitButton form="profile">Submit</SubmitButton>
    </FormProvider>
  )
}

describe("<FormError> with <Form>", () => {
  test("shows an action's form-level messages, one per line, until an edit", async () => {
    const user = userEvent.setup()
    const action = () =>
      Promise.resolve<ActionResult<never>>({
        error: {
          fieldErrors: { "owners[3].name": ["Unknown owner"] },
          formErrors: ["Record is locked"],
        },
        ok: false,
      })
    function Harness() {
      const form = useForm({
        defaultValues: { name: "Ada" },
        onSubmit: (submit) => submitAction(submit, action),
        schema,
      })
      const { FormError, InputField, SubmitButton } = form
      return (
        <FormProvider form={form}>
          <Form>
            <InputField label="Name" name="name" />
            <FormError />
            <SubmitButton>Submit</SubmitButton>
          </Form>
        </FormProvider>
      )
    }
    render(<Harness />)

    await user.click(screen.getByRole("button", SUBMIT))
    const alert = await screen.findByRole("alert")
    expect(
      within(alert)
        .getAllByRole("listitem")
        .map((item) => item.textContent)
    ).toEqual(["Record is locked", "Unknown owner"])

    await user.type(screen.getByLabelText(NAME), "!")
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull())
  })

  test("a thrown submit shows a generic message and leaves the submit button usable", async () => {
    const user = userEvent.setup()
    const report = vi.fn()
    vi.stubGlobal("reportError", report)
    const refused = new Error("connect ECONNREFUSED 10.0.0.1:5432")
    let rejectRetry: (error: Error) => void = () => undefined
    const onSubmit = vi
      .fn<(values: Values) => unknown>()
      .mockImplementationOnce(() => {
        dropFocus()
        throw refused
      })
      .mockImplementationOnce(
        () =>
          new Promise((_, reject) => {
            rejectRetry = reject
          })
      )
    render(<Profile onSubmit={onSubmit} />)
    const submit = screen.getByRole("button", SUBMIT)
    await user.click(submit)

    const alert = await screen.findByRole("alert")
    expect(alert.textContent).toBe("Something went wrong. Try again.")
    expect(submit.matches(":disabled")).toBe(false)
    await waitFor(() => expect(document.activeElement).toBe(submit))
    // Caught for the retry, but still logged and seen by error monitoring.
    expect(report).toHaveBeenCalledWith(refused)

    // A retry clears the message while it runs; it comes back if it fails.
    await user.click(submit)
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2))
    expect(screen.queryByRole("alert")).toBeNull()
    rejectRetry(new Error("offline"))
    expect(await screen.findByRole("alert")).toBeTruthy()

    await user.type(screen.getByLabelText(NAME), "!")
    expect(screen.queryByRole("alert")).toBeNull()
  })

  test("a reset drops a thrown submit's error, even when it restores the same values", async () => {
    const user = userEvent.setup()
    let resolveRetry: () => void = () => undefined
    const onSubmit = vi
      .fn<(values: Values) => unknown>()
      .mockImplementationOnce(() => {
        throw new Error("offline")
      })
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveRetry = resolve
          })
      )
    render(<Profile onSubmit={onSubmit} />)
    await user.click(screen.getByRole("button", SUBMIT))
    expect(await screen.findByRole("alert")).toBeTruthy()

    await user.click(screen.getByRole("button", { name: "Reset" }))
    expect(screen.queryByRole("alert")).toBeNull()
    // Back to the failed submit's values and attempt count.
    await user.click(screen.getByRole("button", SUBMIT))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2))
    expect(screen.queryByRole("alert")).toBeNull()
    resolveRetry()
    await waitFor(() =>
      expect(screen.getByRole("button", SUBMIT).matches(":disabled")).toBe(
        false
      )
    )
    expect(screen.queryByRole("alert")).toBeNull()
  })

  test("a Next.js redirect from onSubmit is no error", async () => {
    const user = userEvent.setup()
    const report = vi.fn()
    vi.stubGlobal("reportError", report)
    const onSubmit = vi.fn(() => {
      throw Object.assign(new Error("NEXT_REDIRECT"), {
        digest: "NEXT_REDIRECT;push;/people/1;307;",
      })
    })
    render(<Profile onSubmit={onSubmit} />)
    await user.click(screen.getByRole("button", SUBMIT))

    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    expect(screen.queryByRole("alert")).toBeNull()
    expect(report).not.toHaveBeenCalled()
  })

  test("a form-level message wins over a thrown submit", async () => {
    const user = userEvent.setup()
    const action = () =>
      Promise.resolve<ActionResult<never>>({
        error: { fieldErrors: {}, formErrors: ["Record is locked"] },
        ok: false,
      })
    function Harness() {
      const form = useForm({
        defaultValues: ADA,
        onSubmit: async (submit) => {
          await submitAction(submit, action)
          throw new Error("Not saved")
        },
        schema,
      })
      const { FormError, SubmitButton } = form
      return (
        <FormProvider form={form}>
          <Form>
            <FormError />
            <SubmitButton>Submit</SubmitButton>
          </Form>
        </FormProvider>
      )
    }
    render(<Harness />)

    await user.click(screen.getByRole("button", SUBMIT))
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Record is locked"
    )
  })
})

describe("<FormError> with a <form> of your own", () => {
  test("shows a thrown submit too", async () => {
    const user = userEvent.setup()
    function Harness() {
      const form = useForm({
        defaultValues: ADA,
        onSubmit: () => {
          throw new Error("offline")
        },
        schema,
      })
      const { FormError } = form
      return (
        <FormProvider form={form}>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              form.handleSubmit().catch(() => undefined)
            }}
          >
            <FormError />
            <button type="submit">Submit</button>
          </form>
        </FormProvider>
      )
    }
    render(<Harness />)

    await user.click(screen.getByRole("button", SUBMIT))
    expect(await screen.findByRole("alert")).toBeTruthy()
  })
})
