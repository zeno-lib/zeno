import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@zeno-lib/test/testing-library"
import userEvent from "@zeno-lib/test/user-event"
import { afterEach, describe, expect, test, vi } from "vitest"
import { z } from "zod"
import { Form, FormProvider, useForm } from "./create-form"

const CONTACT_EMAIL_LABEL = /Contact email/
const PASSWORD_LABEL = /Password/
const NAME_LABEL = /Name/
const ACCEPT_NAME = /Accept/
const TITLE_LABEL = /Title/
const NOTE_LABEL = /Note/
const DAY_LABEL = /Day/
const PICKED_DAY = /October 9/
const OWNER_LABEL = /Owner/

afterEach(() => {
  cleanup()
})

describe("EmailField / PasswordField", () => {
  test("EmailField with an explicit `name` binds to that field", async () => {
    const user = userEvent.setup()
    const schema = z.object({ contactEmail: z.email() })
    function H() {
      const form = useForm({ onSubmit: vi.fn(), schema })
      const { EmailField } = form
      return (
        <FormProvider form={form}>
          <Form>
            <EmailField label="Contact email" name="contactEmail" />
          </Form>
        </FormProvider>
      )
    }
    render(<H />)
    const input = screen.getByLabelText(CONTACT_EMAIL_LABEL) as HTMLInputElement
    expect(input.name).toBe("contactEmail")
    await user.type(input, "u@example.com")
    expect(input.value).toBe("u@example.com")
  })

  test("PasswordField with an explicit `name` renders a password input", () => {
    const schema = z.object({
      email: z.email(),
      password: z.string().min(1),
    })
    function H() {
      const form = useForm({ onSubmit: vi.fn(), schema })
      const { PasswordField } = form
      return (
        <FormProvider form={form}>
          <Form>
            <PasswordField label="Password" name="password" />
          </Form>
        </FormProvider>
      )
    }
    render(<H />)
    const input = screen.getByLabelText(PASSWORD_LABEL) as HTMLInputElement
    expect(input.name).toBe("password")
    expect(input.type).toBe("password")
  })
})

describe("validators & listeners props forward into the underlying AppField", () => {
  test("InputField forwards validators (runs on user input)", async () => {
    const user = userEvent.setup()
    const schema = z.object({ name: z.string() })
    const validator = vi.fn(() => undefined)
    function H() {
      const form = useForm({ onSubmit: vi.fn(), schema })
      const { InputField } = form
      return (
        <FormProvider form={form}>
          <Form>
            <InputField
              label="Name"
              name="name"
              validators={{ onChange: validator }}
            />
          </Form>
        </FormProvider>
      )
    }
    render(<H />)
    await user.type(screen.getByLabelText(NAME_LABEL), "Alice")
    expect(validator).toHaveBeenCalled()
  })

  test("InputField forwards listeners (fires on user input)", async () => {
    const user = userEvent.setup()
    const schema = z.object({ name: z.string() })
    const listener = vi.fn()
    function H() {
      const form = useForm({ onSubmit: vi.fn(), schema })
      const { InputField } = form
      return (
        <FormProvider form={form}>
          <Form>
            <InputField
              label="Name"
              listeners={{ onChange: listener }}
              name="name"
            />
          </Form>
        </FormProvider>
      )
    }
    render(<H />)
    await user.type(screen.getByLabelText(NAME_LABEL), "Bob")
    expect(listener).toHaveBeenCalled()
  })
})

describe("CheckboxField — boolean state wrapper", () => {
  test("binds boolean state and reflects toggle clicks", async () => {
    const user = userEvent.setup()
    const schema = z.object({ accept: z.boolean() })
    function H() {
      const form = useForm({
        defaultValues: { accept: false },
        onSubmit: vi.fn(),
        schema,
      })
      const { CheckboxField } = form
      return (
        <FormProvider form={form}>
          <Form>
            <CheckboxField label="Accept" name="accept" />
          </Form>
        </FormProvider>
      )
    }
    render(<H />)
    // BaseUI renders the checkbox as a <button role="checkbox">.
    const checkbox = screen.getByRole("checkbox", { name: ACCEPT_NAME })
    expect(checkbox.getAttribute("aria-checked")).toBe("false")
    await user.click(checkbox)
    expect(checkbox.getAttribute("aria-checked")).toBe("true")
  })
})

describe("field ids", () => {
  test("two forms with the same field name label their own controls", () => {
    const schema = z.object({ description: z.string().min(1) })
    function H({ label }: { label: string }) {
      const form = useForm({ onSubmit: vi.fn(), schema })
      const { InputField } = form
      return (
        <FormProvider form={form}>
          <Form>
            <InputField description="Hint" label={label} name="description" />
          </Form>
        </FormProvider>
      )
    }
    render(
      <>
        <H label="Page description" />
        <H label="Dialog description" />
      </>
    )
    const page = screen.getByRole("textbox", { name: "Page description" })
    const dialog = screen.getByRole("textbox", { name: "Dialog description" })
    expect(dialog).not.toBe(page)
    const hints = screen.getAllByText("Hint")
    expect(page.getAttribute("aria-describedby")).toBe(hints[0]?.id)
    expect(dialog.getAttribute("aria-describedby")).toBe(hints[1]?.id)
  })
})

describe("ComboboxField", () => {
  test("offers to clear an optional value but not a required one", () => {
    const schema = z.object({
      forced: z.string().optional(),
      kind: z.string().min(1),
      note: z.string().optional(),
      overridden: z.string().min(1),
    })
    const ITEMS = ["a", "b"]
    function H() {
      const form = useForm({
        defaultValues: { forced: "a", kind: "a", note: "a", overridden: "a" },
        onSubmit: vi.fn(),
        schema,
      })
      const { ComboboxField } = form
      return (
        <FormProvider form={form}>
          <Form>
            <ComboboxField items={ITEMS} name="note" />
            <ComboboxField items={ITEMS} name="kind" />
            <ComboboxField items={ITEMS} name="forced" required />
            <ComboboxField items={ITEMS} name="overridden" showClear />
          </Form>
        </FormProvider>
      )
    }
    const { container } = render(<H />)
    const hasClear = (name: string) => {
      const root = container.querySelector<HTMLElement>(
        `[data-field="${name}"]`
      )
      return root
        ? within(root).queryByRole("button", { name: "Clear" }) !== null
        : false
    }
    expect(hasClear("note")).toBe(true)
    expect(hasClear("kind")).toBe(false)
    expect(hasClear("forced")).toBe(false)
    expect(hasClear("overridden")).toBe(true)
  })
})

describe("required fields", () => {
  test("a required control says so to assistive tech, with or without the `*`", () => {
    const schema = z.object({
      kind: z.string().min(1),
      note: z.string(),
      title: z.string().min(1),
    })
    function H({ requiredIndicator }: { requiredIndicator: boolean }) {
      const form = useForm({
        defaultValues: { kind: "a" },
        onSubmit: vi.fn(),
        requiredIndicator,
        schema,
      })
      const { ComboboxField, InputField } = form
      return (
        <FormProvider form={form}>
          <Form>
            <InputField label="Title" name="title" />
            <InputField label="Note" name="note" />
            <ComboboxField items={["a", "b"]} label="Kind" name="kind" />
          </Form>
        </FormProvider>
      )
    }
    for (const requiredIndicator of [true, false]) {
      const { container, unmount } = render(
        <H requiredIndicator={requiredIndicator} />
      )
      const title = screen.getByRole("textbox", { name: TITLE_LABEL })
      const note = screen.getByRole("textbox", { name: NOTE_LABEL })
      expect(title.getAttribute("aria-required")).toBe("true")
      expect(note.hasAttribute("aria-required")).toBe(false)
      expect(
        container.querySelectorAll('[data-slot="required-indicator"]')
      ).toHaveLength(requiredIndicator ? 2 : 0)
      expect(
        container.querySelector(
          '[data-field="kind"] [data-slot="combobox-clear"]'
        )
      ).toBeNull()
      unmount()
    }
  })
})

describe("DatePickerField", () => {
  const DAY = new Date(2026, 9, 9)

  async function pickSelectedDayAgain(required: boolean) {
    const captured: { day?: Date } = {}
    function H() {
      const form = useForm({
        defaultValues: { day: DAY as Date | undefined },
        onSubmit: vi.fn(),
      })
      const { DatePickerField, Subscribe } = form
      return (
        <FormProvider form={form}>
          <Form>
            <DatePickerField label="Day" name="day" required={required} />
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
    const user = userEvent.setup()
    render(<H />)
    fireEvent.click(screen.getByRole("button", { name: DAY_LABEL }))
    await user.click(await screen.findByRole("button", { name: PICKED_DAY }))
    return captured.day
  }

  test("picking a required date's day again keeps it", async () => {
    expect(await pickSelectedDayAgain(true)).toEqual(DAY)
  })

  test("picking an optional date's day again clears it", async () => {
    expect(await pickSelectedDayAgain(false)).toBeUndefined()
  })
})

describe("ComboboxField with items still loading", () => {
  test("shows a stored id's label once its item arrives, never the raw id", () => {
    function H({ items }: { items: { label: string; value: string }[] }) {
      const form = useForm({
        defaultValues: { ownerId: "user-7" },
        onSubmit: vi.fn(),
      })
      const { ComboboxField } = form
      return (
        <FormProvider form={form}>
          <Form>
            <ComboboxField items={items} label="Owner" name="ownerId" />
          </Form>
        </FormProvider>
      )
    }
    const { rerender } = render(<H items={[]} />)
    const input = screen.getByRole("combobox", { name: OWNER_LABEL })
    expect(input).toHaveProperty("value", "")
    rerender(<H items={[{ label: "Ada Lovelace", value: "user-7" }]} />)
    expect(input).toHaveProperty("value", "Ada Lovelace")
  })
})
