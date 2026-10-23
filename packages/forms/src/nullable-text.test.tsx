import { cleanup, render, screen } from "@zeno-lib/test/testing-library"
import userEvent from "@zeno-lib/test/user-event"
import { afterEach, expect, test, vi } from "vitest"
import { z } from "zod"
import { Form, FormProvider, useForm } from "./create-form"

afterEach(cleanup)

test("a nullable text field holds null for no text, from the start and once emptied", async () => {
  const user = userEvent.setup()
  const schema = z.object({
    note: z.string().nullable(),
    optional: z.string().optional(),
    title: z.string(),
  })
  const captured: { values?: unknown } = {}
  function H() {
    const form = useForm({ onSubmit: vi.fn(), schema })
    const { InputField, Subscribe, TextAreaField } = form
    return (
      <FormProvider form={form}>
        <Form>
          <TextAreaField label="Note" name="note" />
          <InputField label="Optional" name="optional" />
          <InputField label="Title" name="title" />
          <Subscribe selector={(state) => state.values}>
            {(values) => {
              captured.values = values
              return null
            }}
          </Subscribe>
        </Form>
      </FormProvider>
    )
  }
  render(<H />)
  // An optional field keeps `""`: an update skips an `undefined` column, so
  // emptying it would keep the stored text.
  const empty = { note: null, optional: "", title: "" }
  expect(captured.values).toStrictEqual(empty)

  for (const label of ["Note", "Optional", "Title"]) {
    // biome-ignore lint/performance/noAwaitInLoops: one field after another, as a user types
    await user.type(screen.getByLabelText(label), "x")
    await user.clear(screen.getByLabelText(label))
  }
  expect(captured.values).toStrictEqual(empty)
})

test("an emptied nullable text field holds null whatever the other fields hold", async () => {
  const user = userEvent.setup()
  // Once every field passes, the async refinement keeps the form from being
  // checked synchronously.
  const schema = z
    .object({ note: z.string().nullable() })
    .refine(async () => await Promise.resolve(true))
  const captured: { values?: unknown } = {}
  function H() {
    const form = useForm({ onSubmit: vi.fn(), schema })
    const { InputField, Subscribe } = form
    return (
      <FormProvider form={form}>
        <Form>
          <InputField label="Note" name="note" />
          <Subscribe selector={(state) => state.values}>
            {(values) => {
              captured.values = values
              return null
            }}
          </Subscribe>
        </Form>
      </FormProvider>
    )
  }
  render(<H />)

  await user.type(screen.getByRole("textbox"), "x")
  await user.clear(screen.getByRole("textbox"))
  expect(captured.values).toStrictEqual({ note: null })
})
