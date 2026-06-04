import { afterEach, describe, expect, test, vi } from "@zeno-lib/test"
import { cleanup, render, screen } from "@zeno-lib/test/testing-library"
import userEvent from "@zeno-lib/test/user-event"
import { z } from "zod"
import { Form, FormProvider } from "./form"
import { useForm } from "./use-form"

const EMAIL_LABEL = /Email/
const CONTACT_EMAIL_LABEL = /Contact email/
const PASSWORD_LABEL = /Password/
const NAME_LABEL = /Name/
const ACCEPT_NAME = /Accept/

afterEach(() => {
  cleanup()
})

describe("EmailField / PasswordField — default name", () => {
  test("EmailField with no `name` renders an input with id='email'", () => {
    const schema = z.object({ email: z.email() })
    function H() {
      const form = useForm({ onSubmit: vi.fn(), schema })
      const { EmailField } = form
      return (
        <FormProvider form={form}>
          <Form>
            <EmailField label="Email" />
          </Form>
        </FormProvider>
      )
    }
    render(<H />)
    const input = screen.getByLabelText(EMAIL_LABEL) as HTMLInputElement
    expect(input.id).toBe("email")
    expect(input.name).toBe("email")
    expect(input.type).toBe("email")
  })

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
    expect(input.id).toBe("contactEmail")
    expect(input.name).toBe("contactEmail")
    await user.type(input, "u@example.com")
    expect(input.value).toBe("u@example.com")
  })

  test("PasswordField with no `name` renders an input with id='password'", () => {
    const schema = z.object({
      email: z.email(),
      password: z.string().min(1),
    })
    function H() {
      const form = useForm({ onSubmit: vi.fn(), schema })
      const { EmailField, PasswordField } = form
      return (
        <FormProvider form={form}>
          <Form>
            <EmailField />
            <PasswordField label="Password" />
          </Form>
        </FormProvider>
      )
    }
    render(<H />)
    const input = screen.getByLabelText(PASSWORD_LABEL) as HTMLInputElement
    expect(input.id).toBe("password")
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
