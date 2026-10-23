import { cleanup, render, screen } from "@zeno-lib/test/testing-library"
import userEvent from "@zeno-lib/test/user-event"
import { afterEach, expect, test, vi } from "vitest"
import { z } from "zod"
import { Form, FormProvider, useForm } from "./create-form"

afterEach(cleanup)

type Hint = { field: string; scale?: "fraction" | "percent" }

// Where `@zeno-lib/schema` registers a column's hint.
const HINTS_KEY = Symbol.for("@zeno-lib/field-hints")
const holder = globalThis as {
  [HINTS_KEY]?: z.core.$ZodRegistry<Hint>
}
const hints = holder[HINTS_KEY] ?? z.registry<Hint>()
holder[HINTS_KEY] = hints

const hinted = <T extends z.ZodType>(column: T, hint: Hint) => {
  hints.add(column, hint)
  return column
}

// What a `percentage()` or `year()` column of `@zeno-lib/db/schema` hands a
// form: the rule, its hint, and the wrappers of a nullable column.
const schema = z.object({
  built: hinted(z.int().min(1900).max(2100), { field: "year" })
    .nullable()
    .optional(),
  occupancy: hinted(z.number().min(0).max(1), {
    field: "percentage",
    scale: "fraction",
  })
    .nullable()
    .optional()
    // Metadata of the form's own, around the column's schema.
    .describe("Share of the floor area let"),
  rate: hinted(z.number().min(-1).max(1), {
    field: "percentage",
    scale: "fraction",
  })
    // A caller's refinement narrows the column's bounds.
    .max(0.5)
    .nullable()
    .optional(),
})

const captured: { values?: z.input<typeof schema> } = {}

function Harness({ occupancyMax }: { occupancyMax?: number }) {
  const form = useForm({
    defaultValues: { occupancy: 0.125 },
    onSubmit: vi.fn(),
    schema,
  })
  const { PercentageField, Subscribe, YearField } = form
  return (
    <FormProvider form={form}>
      <Form>
        <PercentageField
          label="Occupancy"
          locale="en-US"
          max={occupancyMax}
          name="occupancy"
        />
        <PercentageField label="Rate" locale="en-US" name="rate" />
        <YearField label="Built" name="built" />
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

test("a percentage field takes its scale and bounds from the column's hint", async () => {
  const user = userEvent.setup()
  render(<Harness />)
  const occupancy = screen.getByLabelText("Occupancy") as HTMLInputElement
  expect(occupancy.value).toBe("12.5")

  await user.clear(occupancy)
  await user.type(occupancy, "150")
  await user.tab()
  expect(captured.values?.occupancy).toBe(1)

  // A bound below 0 lets the field take a negative rate, and the field
  // clamps to the bound the schema narrowed.
  const rate = screen.getByLabelText("Rate")
  await user.type(rate, "-25")
  await user.tab()
  expect(captured.values?.rate).toBe(-0.25)
  await user.clear(rate)
  await user.type(rate, "90")
  await user.tab()
  expect(captured.values?.rate).toBe(0.5)
})

test("a year field clamps to the column's hinted bounds", async () => {
  const user = userEvent.setup()
  render(<Harness />)
  await user.type(screen.getByLabelText("Built"), "1850")
  await user.tab()
  expect(captured.values?.built).toBe(1900)
})

test("a prop wins over the hint", async () => {
  const user = userEvent.setup()
  render(<Harness occupancyMax={0.5} />)
  const occupancy = screen.getByLabelText("Occupancy")
  await user.clear(occupancy)
  await user.type(occupancy, "90")
  await user.tab()
  expect(captured.values?.occupancy).toBe(0.5)
})
