import {
  cleanup,
  fireEvent,
  render,
  screen,
} from "@zeno-lib/test/testing-library"
import userEvent from "@zeno-lib/test/user-event"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { Form, FormProvider, useForm } from "./create-form"
import type { DateValueType } from "./lib/date-value"

const DAY_LABEL = /Day/u
const OCTOBER_9_SELECTED = /October 9th, 2026, selected/u
const OCTOBER_10 = /October 10th, 2026/u

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
})

function Harness({
  captured,
  defaultValue,
  valueType,
}: {
  captured: { day?: unknown }
  defaultValue: string
  valueType: DateValueType
}) {
  const form = useForm({
    defaultValues: { day: defaultValue as string | undefined },
    onSubmit: vi.fn(),
  })
  const { DatePickerField, Subscribe } = form
  return (
    <FormProvider form={form}>
      <Form>
        <DatePickerField
          // `toDateString` doesn't depend on the runtime's locale.
          formatValue={(date) => date.toDateString()}
          label="Day"
          name="day"
          valueType={valueType}
        />
        <Subscribe selector={(state) => state.values.day}>
          {(day) => {
            captured.day = day
            return null
          }}
        </Subscribe>
      </Form>
    </FormProvider>
  )
}

// The day before UTC's date in the evening, and the day after in the morning:
// a date read or written through UTC lands on the wrong day in one of them.
describe.each(["Pacific/Kiritimati", "America/Los_Angeles"])(
  "DatePickerField in %s",
  (zone) => {
    beforeEach(() => {
      vi.stubEnv("TZ", zone)
    })

    test('valueType="iso-date" shows and stores the day itself', async () => {
      const user = userEvent.setup()
      const captured: { day?: unknown } = {}
      render(
        <Harness
          captured={captured}
          defaultValue="2026-10-09"
          valueType="iso-date"
        />
      )
      const trigger = screen.getByRole("button", { name: DAY_LABEL })
      expect(trigger.textContent).toContain("Oct 09 2026")

      fireEvent.click(trigger)
      expect(await screen.findByRole("button", { name: OCTOBER_9_SELECTED }))
      await user.click(screen.getByRole("button", { name: OCTOBER_10 }))
      expect(captured.day).toBe("2026-10-10")
      expect(trigger.textContent).toContain("Oct 10 2026")
    })

    test('valueType="iso-datetime" stores a timestamp that reads back as the picked day', async () => {
      const user = userEvent.setup()
      const captured: { day?: unknown } = {}
      render(
        <Harness
          captured={captured}
          // What the field stored for October 9 in this zone.
          defaultValue={new Date(2026, 9, 9).toISOString()}
          valueType="iso-datetime"
        />
      )
      const trigger = screen.getByRole("button", { name: DAY_LABEL })
      expect(trigger.textContent).toContain("Oct 09 2026")

      fireEvent.click(trigger)
      await user.click(await screen.findByRole("button", { name: OCTOBER_10 }))
      expect(typeof captured.day).toBe("string")
      expect(new Date(captured.day as string).toDateString()).toBe(
        "Sat Oct 10 2026"
      )
      expect(trigger.textContent).toContain("Oct 10 2026")
    })
  }
)
