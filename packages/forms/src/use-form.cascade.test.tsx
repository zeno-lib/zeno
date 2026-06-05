import { afterEach, describe, expect, test, vi } from "@zeno-lib/test"
import { cleanup, render, screen } from "@zeno-lib/test/testing-library"
import userEvent from "@zeno-lib/test/user-event"
import { z } from "zod"
import { Form, FormProvider } from "./form"
import { useForm } from "./use-form"

const DIET_LABEL = /Diet/
const SAUSAGE_LABEL = /Sausage/

afterEach(() => {
  cleanup()
})

describe("Field listeners — cascade pattern", () => {
  test("onChange listener can call form.setFieldValue to update a sibling field", async () => {
    const user = userEvent.setup()
    const schema = z.object({
      diet: z.string().default("none"),
      sausage: z.string().default("yes"),
    })

    function H() {
      const form = useForm({ onSubmit: vi.fn(), schema })
      const { InputField } = form
      return (
        <FormProvider form={form}>
          <Form>
            <InputField
              label="Diet"
              listeners={{
                onChange: ({ value }: { value: string }) => {
                  if (value === "vegan") {
                    form.setFieldValue("sausage", "no")
                  }
                },
              }}
              name="diet"
            />
            <InputField label="Sausage" name="sausage" />
          </Form>
        </FormProvider>
      )
    }
    render(<H />)
    const diet = screen.getByLabelText(DIET_LABEL) as HTMLInputElement
    const sausage = screen.getByLabelText(SAUSAGE_LABEL) as HTMLInputElement

    expect(sausage.value).toBe("yes")
    await user.clear(diet)
    await user.type(diet, "vegan")
    expect(sausage.value).toBe("no")
  })

  test("listener fires per change without triggering the field's own validator", async () => {
    const user = userEvent.setup()
    type Values = { diet: string }
    const listener = vi.fn()
    function H() {
      const form = useForm<Values>({
        defaultValues: { diet: "" },
        onSubmit: vi.fn(),
      })
      const { InputField } = form
      return (
        <FormProvider form={form}>
          <Form>
            <InputField
              label="Diet"
              listeners={{ onChange: listener }}
              name="diet"
            />
          </Form>
        </FormProvider>
      )
    }
    render(<H />)
    await user.type(screen.getByLabelText(DIET_LABEL), "abc")
    // "abc" — three keystrokes → listener fired at least three times.
    expect(listener.mock.calls.length).toBeGreaterThanOrEqual(3)
  })
})
