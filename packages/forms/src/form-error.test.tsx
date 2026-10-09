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
})

const NAME = /Name/
const SUBMIT = { name: "Submit" }

const schema = z.object({ name: z.string().min(1, "Required") })
type Values = z.infer<typeof schema>

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
    defaultValues: { name: "Ada" },
    onSubmit: ({ value }) => onSubmit(value),
    schema,
  })
  const { FormError, InputField, SubmitButton } = form
  return (
    <FormProvider form={form}>
      <Form id="profile">
        <InputField label="Name" name="name" />
      </Form>
      {/* Outside the <form>: FormError finds the form through context. */}
      <FormError />
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
    let rejectRetry: (error: Error) => void = () => undefined
    const onSubmit = vi
      .fn<(values: Values) => unknown>()
      .mockImplementationOnce(() => {
        dropFocus()
        throw new Error("connect ECONNREFUSED 10.0.0.1:5432")
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

    // A retry clears the message while it runs; it comes back if it fails.
    await user.click(submit)
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2))
    expect(screen.queryByRole("alert")).toBeNull()
    rejectRetry(new Error("offline"))
    expect(await screen.findByRole("alert")).toBeTruthy()

    await user.type(screen.getByLabelText(NAME), "!")
    expect(screen.queryByRole("alert")).toBeNull()
  })
})
