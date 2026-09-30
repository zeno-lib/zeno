import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@zeno-lib/test/testing-library"
import userEvent from "@zeno-lib/test/user-event"
import { afterEach, describe, expect, test, vi } from "vitest"
import { z } from "zod"
import { Form, FormProvider, useForm } from "./create-form"
import { getNumberSeparators } from "./lib/formatted-number"

const AMOUNT = /Amount/
const RATE = /Rate/
const YEAR = /Year/
const CH = getNumberSeparators("de-CH").group

afterEach(() => {
  cleanup()
})

type Captured = { current: ReturnType<typeof useAmountForm> | null }

const AMOUNT_DEFAULTS = { amount: null as number | null }

function useAmountForm(onSubmit = vi.fn()) {
  return useForm({ defaultValues: AMOUNT_DEFAULTS, onSubmit })
}

function MoneyHarness({
  captured,
  locale = "de-CH",
  currency = "CHF",
}: {
  captured?: Captured
  locale?: string
  currency?: string
}) {
  const form = useAmountForm()
  if (captured) {
    captured.current = form
  }
  const { MoneyField } = form
  return (
    <FormProvider form={form}>
      <Form>
        <MoneyField
          currency={currency}
          label="Amount"
          locale={locale}
          name="amount"
        />
      </Form>
    </FormProvider>
  )
}

describe("MoneyField", () => {
  test("formats with thousands separators while typing and stores a number", async () => {
    const user = userEvent.setup()
    const captured: Captured = { current: null }
    render(<MoneyHarness captured={captured} />)
    const input = screen.getByLabelText(AMOUNT) as HTMLInputElement
    expect(input.inputMode).toBe("decimal")
    expect(input.type).toBe("text")

    await user.type(input, "1234567.5")
    expect(input.value).toBe(`1${CH}234${CH}567.5`)
    expect(captured.current?.state.values.amount).toBe(1_234_567.5)

    await user.tab()
    expect(input.value).toBe(`1${CH}234${CH}567.50`)
  })

  test("shows the currency as an add-on on the locale's side", () => {
    render(<MoneyHarness />)
    const addon = screen.getByText("CHF")
    const group = addon.closest("[data-slot=input-group-addon]")
    expect(group?.getAttribute("data-align")).toBe("inline-start")
  })

  test("parses pasted text from another locale", () => {
    const captured: Captured = { current: null }
    render(<MoneyHarness captured={captured} />)
    const input = screen.getByLabelText(AMOUNT) as HTMLInputElement
    fireEvent.paste(input, {
      clipboardData: { getData: () => "EUR 1.234,56" },
    })
    expect(captured.current?.state.values.amount).toBe(1234.56)
    expect(input.value).toBe(`1${CH}234.56`)
  })

  test("clearing the input stores null", async () => {
    const user = userEvent.setup()
    const captured: Captured = { current: null }
    render(<MoneyHarness captured={captured} />)
    const input = screen.getByLabelText(AMOUNT) as HTMLInputElement
    await user.type(input, "12")
    await user.clear(input)
    expect(captured.current?.state.values.amount).toBeNull()
  })

  test("re-syncs the text when the value changes from outside", async () => {
    const user = userEvent.setup()
    const captured: Captured = { current: null }
    render(<MoneyHarness captured={captured} />)
    const input = screen.getByLabelText(AMOUNT) as HTMLInputElement
    await user.type(input, "5")
    act(() => {
      captured.current?.setFieldValue("amount", 9876)
    })
    console.log(
      "VALS",
      JSON.stringify(captured.current?.state.values),
      input.value
    )
    expect(input.value).toBe(`9${CH}876`)
  })

  test("rejects letters and keeps integers bare on blur", async () => {
    const user = userEvent.setup()
    render(<MoneyHarness />)
    const input = screen.getByLabelText(AMOUNT) as HTMLInputElement
    await user.type(input, "12a3")
    expect(input.value).toBe("123")
    await user.tab()
    expect(input.value).toBe("123")
  })
})

describe("PercentageField", () => {
  function PercentHarness({
    captured,
    scale,
  }: {
    captured: { current: number | null | undefined }
    scale?: "fraction" | "percent"
  }) {
    const form = useForm({
      defaultValues: { rate: 0.05 as number | null },
      onSubmit: vi.fn(),
    })
    const { PercentageField, Subscribe } = form
    return (
      <FormProvider form={form}>
        <Form>
          <PercentageField
            label="Rate"
            locale="en-US"
            name="rate"
            scale={scale}
          />
          <Subscribe selector={(state) => state.values.rate}>
            {(rate) => {
              captured.current = rate
              return null
            }}
          </Subscribe>
        </Form>
      </FormProvider>
    )
  }

  test("edits a 0–1 fraction as a percentage with scale='fraction'", async () => {
    const user = userEvent.setup()
    const captured = { current: undefined as number | null | undefined }
    render(<PercentHarness captured={captured} scale="fraction" />)
    const input = screen.getByLabelText(RATE) as HTMLInputElement
    expect(input.value).toBe("5")
    expect(screen.getByText("%")).toBeTruthy()

    await user.clear(input)
    await user.type(input, "12.5")
    expect(captured.current).toBe(0.125)
  })

  test("stores the typed number by default", async () => {
    const user = userEvent.setup()
    const captured = { current: undefined as number | null | undefined }
    render(<PercentHarness captured={captured} />)
    const input = screen.getByLabelText(RATE) as HTMLInputElement
    await user.clear(input)
    await user.type(input, "7.25")
    expect(captured.current).toBe(7.25)
  })
})

describe("YearField", () => {
  function YearHarness({
    captured,
  }: {
    captured: { current: number | null | undefined }
  }) {
    const form = useForm({
      onSubmit: vi.fn(),
      schema: z.object({ year: z.number().int().nullable() }),
    })
    const { Subscribe, YearField } = form
    return (
      <FormProvider form={form}>
        <Form>
          <YearField label="Year" max={2100} min={1900} name="year" />
          <Subscribe selector={(state) => state.values.year}>
            {(year) => {
              captured.current = year
              return null
            }}
          </Subscribe>
        </Form>
      </FormProvider>
    )
  }

  test("caps at four digits without grouping", async () => {
    const user = userEvent.setup()
    const captured = { current: undefined as number | null | undefined }
    render(<YearHarness captured={captured} />)
    const input = screen.getByLabelText(YEAR) as HTMLInputElement
    expect(input.inputMode).toBe("numeric")
    await user.type(input, "20245")
    expect(input.value).toBe("2024")
    expect(captured.current).toBe(2024)
  })

  test("clamps to min/max on blur", async () => {
    const user = userEvent.setup()
    const captured = { current: undefined as number | null | undefined }
    render(<YearHarness captured={captured} />)
    const input = screen.getByLabelText(YEAR) as HTMLInputElement
    await user.type(input, "1850")
    await user.tab()
    expect(input.value).toBe("1900")
    expect(captured.current).toBe(1900)
  })
})
