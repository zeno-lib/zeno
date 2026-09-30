import { cleanup, render, screen } from "@zeno-lib/test/testing-library"
import userEvent from "@zeno-lib/test/user-event"
import { afterEach, describe, expect, test, vi } from "vitest"
import { Form, FormProvider, useForm } from "./create-form"

const TAGS = /Tags/
const CLEAR = /Clear/

afterEach(() => {
  cleanup()
})

type Box<T> = { current: T | undefined }

describe("MultiSelectField", () => {
  const ITEMS = [
    { label: "One", value: 1 },
    { label: "Two", value: 2 },
    { label: "Three", value: 3 },
  ]
  const DEFAULTS = { ids: [3] as number[] }

  function Harness({ captured }: { captured: Box<number[]> }) {
    const form = useForm({ defaultValues: DEFAULTS, onSubmit: vi.fn() })
    const { MultiSelectField, Subscribe } = form
    return (
      <FormProvider form={form}>
        <Form>
          <MultiSelectField
            items={ITEMS}
            label="Tags"
            name="ids"
            placeholder="Pick"
          />
          <Subscribe selector={(state) => state.values.ids}>
            {(ids) => {
              captured.current = ids
              return null
            }}
          </Subscribe>
        </Form>
      </FormProvider>
    )
  }

  test("renders selected values as chips and appends picks as numbers", async () => {
    const user = userEvent.setup()
    const captured: Box<number[]> = { current: undefined }
    const { container } = render(<Harness captured={captured} />)
    expect(container.querySelector("[data-field=ids]")?.textContent).toContain(
      "Three"
    )

    await user.click(screen.getByLabelText(TAGS))
    await user.click(await screen.findByRole("option", { name: "One" }))
    expect(captured.current).toEqual([3, 1])
  })

  test("the clear button empties the selection", async () => {
    const user = userEvent.setup()
    const captured: Box<number[]> = { current: undefined }
    render(<Harness captured={captured} />)
    await user.click(screen.getByRole("button", { name: CLEAR }))
    expect(captured.current).toEqual([])
  })
})

describe("CheckboxGroupField", () => {
  const DEFAULTS = { days: [] as string[] }

  function Harness({ captured }: { captured: Box<string[]> }) {
    const form = useForm({ defaultValues: DEFAULTS, onSubmit: vi.fn() })
    const { CheckboxGroupField, Subscribe } = form
    return (
      <FormProvider form={form}>
        <Form>
          <CheckboxGroupField
            items={[
              "mon",
              "tue",
              { disabled: true, label: "Wednesday", value: "wed" },
            ]}
            label="Days"
            name="days"
          />
          <Subscribe selector={(state) => state.values.days}>
            {(days) => {
              captured.current = days
              return null
            }}
          </Subscribe>
        </Form>
      </FormProvider>
    )
  }

  test("toggles values and keeps the order of items", async () => {
    const user = userEvent.setup()
    const captured: Box<string[]> = { current: undefined }
    render(<Harness captured={captured} />)
    await user.click(screen.getByRole("checkbox", { name: "tue" }))
    await user.click(screen.getByRole("checkbox", { name: "mon" }))
    expect(captured.current).toEqual(["mon", "tue"])
    await user.click(screen.getByRole("checkbox", { name: "tue" }))
    expect(captured.current).toEqual(["mon"])
  })

  test("renders a labelled group and honours per-option disabled", () => {
    render(<Harness captured={{ current: undefined }} />)
    expect(screen.getByRole("group", { name: "Days" })).toBeTruthy()
    const wed = screen.getByRole("checkbox", { name: "Wednesday" })
    expect(
      wed.getAttribute("aria-disabled") ?? wed.getAttribute("data-disabled")
    ).not.toBeNull()
  })
})
