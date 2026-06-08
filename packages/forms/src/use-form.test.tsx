import { act, cleanup, render, screen } from "@zeno-lib/test/testing-library"
import userEvent from "@zeno-lib/test/user-event"
import { useRef } from "react"
import { afterEach, describe, expect, test, vi } from "vitest"
import { z } from "zod"
import { Form, FormProvider } from "./form"
import { ValidationError } from "./lib/validation-error"
import { useForm } from "./use-form"

const EMAIL_LABEL = /Email/
const VALID_EMAIL_MSG = /Enter a valid email/i
const SUBMIT_NAME = /Submit/

// @testing-library auto-cleanup only runs with `globals: true`. Our vitest
// config keeps globals off (we import test helpers explicitly), so add the
// hook ourselves to keep tests isolated.
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe("useForm — schema-derived defaults", () => {
  test("strings/arrays fill in from schema, .default flows through, optional booleans only set when user supplies", () => {
    const schema = z.object({
      email: z.email(),
      newsletter: z.boolean().optional(),
      role: z.string().default("member"),
      tags: z.array(z.string()),
    })
    let capturedValues: unknown
    function Harness() {
      const form = useForm({
        defaultValues: { newsletter: false },
        onSubmit: vi.fn(),
        schema,
      })
      capturedValues = form.state.values
      return null
    }
    render(<Harness />)
    expect(capturedValues).toEqual({
      email: "",
      newsletter: false,
      role: "member",
      tags: [],
    })
  })

  test("user defaultValues win on conflict", () => {
    const schema = z.object({ role: z.string().default("member") })
    let capturedValues: unknown
    function Harness() {
      const form = useForm({
        defaultValues: { role: "admin" },
        onSubmit: vi.fn(),
        schema,
      })
      capturedValues = form.state.values
      return null
    }
    render(<Harness />)
    expect(capturedValues).toEqual({ role: "admin" })
  })
})

describe("useForm — required indicator", () => {
  test("`*` rendered next to required field labels (schema-derived)", () => {
    const schema = z.object({
      email: z.email(),
      role: z.string().default("member"),
    })
    function Harness() {
      const form = useForm({ onSubmit: vi.fn(), schema })
      const { EmailField, InputField } = form
      return (
        <FormProvider form={form}>
          <Form>
            <EmailField label="Email" />
            <InputField label="Role" name="role" />
          </Form>
        </FormProvider>
      )
    }
    render(<Harness />)
    const emailLabel = screen.getByText("Email")
    const roleLabel = screen.getByText("Role")
    expect(
      emailLabel.querySelector('[data-slot="required-indicator"]')
    ).not.toBeNull()
    expect(
      roleLabel.querySelector('[data-slot="required-indicator"]')
    ).toBeNull()
  })

  test("requiredIndicator: false disables the `*` entirely", () => {
    const schema = z.object({ email: z.email() })
    function Harness() {
      const form = useForm({
        onSubmit: vi.fn(),
        requiredIndicator: false,
        schema,
      })
      const { EmailField } = form
      return (
        <FormProvider form={form}>
          <Form>
            <EmailField label="Email" />
          </Form>
        </FormProvider>
      )
    }
    render(<Harness />)
    expect(
      screen
        .getByText("Email")
        .querySelector('[data-slot="required-indicator"]')
    ).toBeNull()
  })
})

describe("useForm — hideFieldErrors", () => {
  test("aria-invalid still flips after blur, but inline FieldError is suppressed", async () => {
    const user = userEvent.setup()
    const schema = z.object({ email: z.email("Enter a valid email") })
    function Harness() {
      const form = useForm({
        hideFieldErrors: true,
        onSubmit: vi.fn(),
        schema,
        validators: "blur",
      })
      const { EmailField, SubmitButton } = form
      return (
        <FormProvider form={form}>
          <Form>
            <EmailField label="Email" />
            <SubmitButton>Submit</SubmitButton>
          </Form>
        </FormProvider>
      )
    }
    render(<Harness />)
    const input = screen.getByLabelText(EMAIL_LABEL) as HTMLInputElement
    await user.type(input, "not-an-email")
    await user.tab() // blur → triggers validation
    expect(input.getAttribute("aria-invalid")).toBe("true")
    expect(screen.queryByText(VALID_EMAIL_MSG)).toBeNull()
  })
})

describe("useForm — ValidationError from onSubmit", () => {
  test("per-field messages land on the matching field after submit", async () => {
    const user = userEvent.setup()
    const schema = z.object({ email: z.email() })
    function Harness() {
      const form = useForm({
        onSubmit: () => {
          throw new ValidationError({ email: "Taken on the server" })
        },
        schema,
      })
      const { EmailField, SubmitButton } = form
      return (
        <FormProvider form={form}>
          <Form>
            <EmailField label="Email" />
            <SubmitButton>Submit</SubmitButton>
          </Form>
        </FormProvider>
      )
    }
    render(<Harness />)
    await user.type(screen.getByLabelText(EMAIL_LABEL), "user@example.com")
    await user.click(screen.getByRole("button", { name: "Submit" }))
    expect(await screen.findByText("Taken on the server")).not.toBeNull()
  })

  test("formError populates the form-level error map", async () => {
    const user = userEvent.setup()
    const schema = z.object({ email: z.email() })
    const errorMapRef: { current: unknown } = { current: undefined }
    function Harness() {
      const form = useForm({
        onSubmit: () => {
          throw new ValidationError(
            { email: "Taken" },
            { formError: "Service unavailable" }
          )
        },
        schema,
      })
      errorMapRef.current = form.state.errorMap
      const { EmailField, SubmitButton } = form
      return (
        <FormProvider form={form}>
          <Form>
            <EmailField label="Email" />
            <SubmitButton>Submit</SubmitButton>
          </Form>
        </FormProvider>
      )
    }
    render(<Harness />)
    await user.type(screen.getByLabelText(EMAIL_LABEL), "user@example.com")
    await user.click(screen.getByRole("button", { name: "Submit" }))
    // TanStack Form normalises the `setErrorMap({ onSubmit: { form, fields } })`
    // payload by surfacing the `form` string directly on `errorMap.onSubmit`.
    expect(errorMapRef.current).toMatchObject({
      onSubmit: "Service unavailable",
    })
  })

  test("non-ValidationError thrown from onSubmit propagates (is not swallowed)", async () => {
    const user = userEvent.setup()
    const schema = z.object({ email: z.email() })
    const boom = new Error("not a validation problem")
    const onSubmit = vi.fn(() => {
      throw boom
    })
    function Harness() {
      const form = useForm({ onSubmit, schema })
      const { EmailField, SubmitButton } = form
      return (
        <FormProvider form={form}>
          <Form>
            <EmailField label="Email" />
            <SubmitButton>Submit</SubmitButton>
          </Form>
        </FormProvider>
      )
    }
    render(<Harness />)
    await user.type(screen.getByLabelText(EMAIL_LABEL), "user@example.com")
    await user.click(screen.getByRole("button", { name: "Submit" }))
    expect(onSubmit).toHaveBeenCalled()
    // Not a ValidationError → no field-level message is applied.
    expect(screen.queryByText("not a validation problem")).toBeNull()
  })

  test("submit without an onSubmit prop does not crash (wrappedOnSubmit branch)", async () => {
    const user = userEvent.setup()
    const schema = z.object({ email: z.email() })
    function Harness() {
      const form = useForm({ schema })
      const { EmailField, SubmitButton } = form
      return (
        <FormProvider form={form}>
          <Form>
            <EmailField label="Email" />
            <SubmitButton>Submit</SubmitButton>
          </Form>
        </FormProvider>
      )
    }
    render(<Harness />)
    await user.type(screen.getByLabelText(EMAIL_LABEL), "user@example.com")
    await expect(
      user.click(screen.getByRole("button", { name: "Submit" }))
    ).resolves.not.toThrow()
  })
})

describe("useForm — SubmitButton state", () => {
  test("disabled and shows spinner while isSubmitting", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const schema = z.object({ email: z.email() })
    function Harness() {
      const form = useForm({
        onSubmit: () => new Promise((resolve) => setTimeout(resolve, 50)),
        schema,
      })
      const { EmailField, SubmitButton } = form
      return (
        <FormProvider form={form}>
          <Form>
            <EmailField label="Email" />
            <SubmitButton>Submit</SubmitButton>
          </Form>
        </FormProvider>
      )
    }
    render(<Harness />)
    await user.type(screen.getByLabelText(EMAIL_LABEL), "user@example.com")
    const button = screen.getByRole("button", {
      name: SUBMIT_NAME,
    }) as HTMLButtonElement
    await user.click(button)
    expect(button.disabled).toBe(true)
    // Spinner renders Lucide's Loader2 with role="status" + aria-label="Loading".
    expect(button.querySelector('[role="status"]')).not.toBeNull()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60)
    })
    expect(button.disabled).toBe(false)
  })
})

describe("useForm — useAppFields memoization", () => {
  test("field component identity is stable across re-renders with the same form", () => {
    const schema = z.object({ email: z.email() })
    const seen: { same: boolean; tick: number }[] = []
    function Harness({ tick }: { tick: number }) {
      const form = useForm({ onSubmit: vi.fn(), schema })
      const lastEmail = useRef<unknown>(undefined)
      if (lastEmail.current === undefined) {
        lastEmail.current = form.EmailField
      }
      seen.push({ same: lastEmail.current === form.EmailField, tick })
      return null
    }
    const { rerender } = render(<Harness tick={1} />)
    rerender(<Harness tick={2} />)
    rerender(<Harness tick={3} />)
    expect(seen.every((s) => s.same)).toBe(true)
  })
})

describe("useForm — manual path", () => {
  test("native validators object is forwarded; runs on user input", async () => {
    const user = userEvent.setup()
    type Values = { email: string }
    const onChange = vi.fn((_: { value: Values }) => undefined)
    function Harness() {
      const form = useForm<Values>({
        defaultValues: { email: "" },
        onSubmit: vi.fn(),
        // Manual path: validators is the native object — typed by TanStack
        // Form. The `vi.fn(...)` mock signature matches the validator shape.
        validators: { onChange: onChange as never },
      })
      const { EmailField, SubmitButton } = form
      return (
        <FormProvider form={form}>
          <Form>
            <EmailField label="Email" name="email" />
            <SubmitButton>Submit</SubmitButton>
          </Form>
        </FormProvider>
      )
    }
    render(<Harness />)
    const input = screen.getByLabelText(EMAIL_LABEL) as HTMLInputElement
    await user.type(input, "bad")
    expect(onChange).toHaveBeenCalled()
  })
})
