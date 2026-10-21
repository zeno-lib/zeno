import { cleanup, render, screen } from "@zeno-lib/test/testing-library"
import userEvent from "@zeno-lib/test/user-event"
import { afterEach, expect, test, vi } from "vitest"
import { z } from "zod"
import { Form, FormProvider, useForm } from "./create-form"

afterEach(cleanup)

// What a `percentage()` or `year()` column of `@zeno-lib/db/schema` hands a
// form: the rule, its hint, and the wrappers of a nullable column.
const schema = z.object({
  built: z
    .number()
    .min(1900)
    .max(2100)
    .meta({ field: "year", max: 2100, min: 1900 })
    .nullable()
    .optional(),
  occupancy: z
    .number()
    .min(0)
    .max(1)
    .meta({ field: "percentage", max: 1, min: 0, scale: "fraction" })
    .nullable()
    .optional(),
  rate: z
    .number()
    .min(-1)
    .max(1)
    .meta({ field: "percentage", max: 1, min: -1, scale: "fraction" })
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

  // A bound below 0 lets the field take a negative rate.
  await user.type(screen.getByLabelText("Rate"), "-25")
  await user.tab()
  expect(captured.values?.rate).toBe(-0.25)
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
