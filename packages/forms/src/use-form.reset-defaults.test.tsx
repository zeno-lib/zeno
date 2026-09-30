import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
} from "@zeno-lib/test/testing-library"
import userEvent from "@zeno-lib/test/user-event"
import { afterEach, describe, expect, test, vi } from "vitest"
import { z } from "zod"
import { Form, FormProvider, useForm } from "./create-form"

afterEach(() => {
  cleanup()
})

const TITLE = /Title/
const SAVE = /Save/

const schema = z.object({ title: z.string().min(1) })

type Captured = {
  isDefaultValue: boolean
  isDirty: boolean
  isTouched: boolean
  values: { title: string }
}

function EditTitle({
  capture,
  record,
  tick,
}: {
  capture: (state: Captured) => void
  record: { title: string }
  tick?: number
}) {
  const form = useForm({
    // A fresh literal every render, like most callers write it.
    defaultValues: { title: record.title },
    onSubmit: ({ formApi, value }) => {
      formApi.reset(value)
    },
    schema,
  })
  const { InputField, SubmitButton } = form
  capture({
    isDefaultValue: form.state.isDefaultValue,
    isDirty: form.state.isDirty,
    isTouched: form.state.isTouched,
    values: form.state.values,
  })
  return (
    <FormProvider form={form}>
      <Form data-tick={tick}>
        <InputField label="Title" name="title" />
        <SubmitButton>Save</SubmitButton>
      </Form>
    </FormProvider>
  )
}

function titleInput() {
  return screen.getByLabelText(TITLE) as HTMLInputElement
}

describe("useForm — reset(values) rebases defaults", () => {
  test("reset after submit sticks across rerenders with fixed defaults", async () => {
    const user = userEvent.setup()
    let state: Captured | undefined
    const capture = vi.fn((next: Captured) => {
      state = next
    })
    const record = { title: "Draft" }
    const { rerender } = render(<EditTitle capture={capture} record={record} />)

    await user.clear(titleInput())
    await user.type(titleInput(), "Saved title")
    await user.click(screen.getByRole("button", { name: SAVE }))

    await waitFor(() => expect(state?.isTouched).toBe(false))
    for (const tick of [1, 2, 3]) {
      rerender(<EditTitle capture={capture} record={record} tick={tick} />)
    }
    await act(() => Promise.resolve())

    expect(titleInput().value).toBe("Saved title")
    expect(state?.values).toEqual({ title: "Saved title" })
    expect(state?.isDefaultValue).toBe(true)
    expect(state?.isDirty).toBe(false)
  })

  test("new caller defaults apply while the form is untouched", async () => {
    let state: Captured | undefined
    const capture = (next: Captured) => {
      state = next
    }
    const { rerender } = render(
      <EditTitle capture={capture} record={{ title: "v1" }} />
    )
    expect(titleInput().value).toBe("v1")

    rerender(<EditTitle capture={capture} record={{ title: "v2" }} />)
    await waitFor(() => expect(titleInput().value).toBe("v2"))
    expect(state?.isDefaultValue).toBe(true)
  })

  test("new caller defaults are not applied once the form is touched", async () => {
    const user = userEvent.setup()
    let state: Captured | undefined
    const capture = (next: Captured) => {
      state = next
    }
    const { rerender } = render(
      <EditTitle capture={capture} record={{ title: "v1" }} />
    )
    await user.type(titleInput(), " edited")

    rerender(<EditTitle capture={capture} record={{ title: "v2" }} />)
    await act(() => Promise.resolve())

    expect(titleInput().value).toBe("v1 edited")
    expect(state?.values).toEqual({ title: "v1 edited" })
  })
})
