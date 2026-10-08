import { cleanup, render, screen } from "@zeno-lib/test/testing-library"
import { afterEach, describe, expect, test, vi } from "vitest"
import { Form, FormProvider, useForm } from "./create-form"

afterEach(() => {
  cleanup()
})

describe("SliderField", () => {
  function Harness() {
    const form = useForm({ defaultValues: { volume: 0 }, onSubmit: vi.fn() })
    const { SliderField } = form
    return (
      <FormProvider form={form}>
        <Form>
          <SliderField
            formatValue={(value) => value}
            label="Volume"
            name="volume"
          />
        </Form>
      </FormProvider>
    )
  }

  test("renders a numeric readout of 0", () => {
    render(<Harness />)
    expect(screen.getByText("0").tagName).toBe("SPAN")
  })
})
