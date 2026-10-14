import { cleanup, render, screen } from "@zeno-lib/test/testing-library"
import userEvent from "@zeno-lib/test/user-event"
import type { ComponentProps } from "react"
import { afterEach, describe, expect, test, vi } from "vitest"
import { z } from "zod"
import { Form, FormProvider, useForm } from "./create-form"

afterEach(() => {
  cleanup()
})

const PHONE = /Phone/
const SUBMIT = { name: "Submit" }

// A control a `<label htmlFor>` can't name: only `aria-labelledby` does.
function StarRating({
  disabled,
  name: _name,
  onChange,
  value,
  ...props
}: Omit<ComponentProps<"div">, "onChange"> & {
  disabled?: boolean
  name?: string
  onChange: (value: number) => void
  value?: number | null
}) {
  return (
    <div role="radiogroup" {...props}>
      {[1, 2, 3].map((star) => (
        // biome-ignore lint/a11y/useSemanticElements: a custom radio group, as a star rating draws one.
        <button
          aria-checked={value === star}
          disabled={disabled}
          key={star}
          onClick={() => onChange(star)}
          role="radio"
          type="button"
        >
          {star}
        </button>
      ))}
    </div>
  )
}

// A text control that reports its value, not a change event.
function PhoneInput({
  onChange,
  ...props
}: Omit<ComponentProps<"input">, "onChange" | "value"> & {
  onChange: (value: string) => void
  value: string
}) {
  return (
    <input
      {...props}
      onChange={(event) => onChange(event.target.value)}
      type="tel"
    />
  )
}

describe("ControlField", () => {
  test("names and describes its control, and flags it once invalid", async () => {
    const user = userEvent.setup()
    const schema = z.object({ rating: z.number("Rate it") })
    function H() {
      const form = useForm({ onSubmit: vi.fn(), schema })
      const { ControlField, SubmitButton } = form
      return (
        <FormProvider form={form}>
          <Form>
            <ControlField
              description="Out of three."
              label="Rating"
              name="rating"
              render={(control) => <StarRating {...control} />}
            />
            <SubmitButton>Submit</SubmitButton>
          </Form>
        </FormProvider>
      )
    }
    const { container } = render(<H />)
    const group = screen.getByRole("radiogroup", { name: "Rating" })
    const description = screen.getByText("Out of three.")
    expect(group.getAttribute("aria-describedby")).toBe(description.id)
    expect(group.hasAttribute("aria-invalid")).toBe(false)

    await user.click(screen.getByRole("button", SUBMIT))
    const error = await screen.findByRole("alert")
    expect(error.textContent).toBe("Rate it")
    expect(group.getAttribute("aria-invalid")).toBe("true")
    expect(group.getAttribute("aria-describedby")).toBe(
      `${description.id} ${error.id}`
    )
    expect(
      container
        .querySelector('[data-field="rating"]')
        ?.getAttribute("data-invalid")
    ).toBe("true")

    await user.click(screen.getByRole("radio", { name: "2" }))
    expect(screen.queryByRole("alert")).toBeNull()
    expect(group.hasAttribute("aria-invalid")).toBe(false)
  })

  test("marks the field touched on blur, so its error shows", async () => {
    const user = userEvent.setup()
    const schema = z.object({ phone: z.string().min(1, "Enter a phone") })
    function H() {
      const form = useForm({ onSubmit: vi.fn(), schema })
      const { ControlField } = form
      return (
        <FormProvider form={form}>
          <Form>
            <ControlField
              label="Phone"
              name="phone"
              render={(control) => <PhoneInput {...control} />}
            />
          </Form>
        </FormProvider>
      )
    }
    render(<H />)
    await user.click(screen.getByLabelText(PHONE))
    expect(screen.queryByRole("alert")).toBeNull()
    await user.tab()
    expect((await screen.findByRole("alert")).textContent).toBe("Enter a phone")
  })

  test("takes required from the schema unless `required` says otherwise", () => {
    const schema = z.object({
      forced: z.string().optional(),
      kept: z.string().min(1),
      lifted: z.string().min(1),
      open: z.string().optional(),
    })
    const FIELDS = [
      { name: "kept" },
      { name: "open" },
      { name: "forced", required: true },
      { name: "lifted", required: false },
    ] as const
    function H({ requiredIndicator }: { requiredIndicator: boolean }) {
      const form = useForm({ onSubmit: vi.fn(), requiredIndicator, schema })
      const { ControlField } = form
      return (
        <FormProvider form={form}>
          <Form>
            {FIELDS.map((props) => (
              <ControlField
                key={props.name}
                label={props.name}
                render={(control) => (
                  <PhoneInput {...control} value={control.value ?? ""} />
                )}
                {...props}
              />
            ))}
          </Form>
        </FormProvider>
      )
    }
    for (const requiredIndicator of [true, false]) {
      const { container, unmount } = render(
        <H requiredIndicator={requiredIndicator} />
      )
      const required = screen
        .getAllByRole("textbox")
        .filter((input) => input.getAttribute("aria-required") === "true")
        .map((input) => input.getAttribute("name"))
      expect(required).toEqual(["kept", "forced"])
      // `required` overrides `requiredIndicator: false` too.
      expect(
        container.querySelectorAll('[data-slot="required-indicator"]')
      ).toHaveLength(requiredIndicator ? 2 : 1)
      unmount()
    }
  })

  test("clearing stores the value the schema accepts as empty", async () => {
    const user = userEvent.setup()
    const schema = z.object({
      count: z.number().nullable(),
      nullable: z.string().min(1).nullable(),
      optional: z.string().min(1).optional(),
      tags: z.array(z.string()),
      text: z.string(),
    })
    const captured: { values?: unknown } = {}
    function H() {
      const form = useForm({
        defaultValues: {
          count: 1,
          nullable: "a",
          optional: "b",
          tags: ["c"],
          text: "d",
        },
        onSubmit: vi.fn(),
        schema,
      })
      const { ControlField, Subscribe } = form
      return (
        <FormProvider form={form}>
          <Form>
            {(["nullable", "optional", "text"] as const).map((name) => (
              <ControlField
                key={name}
                label={name}
                name={name}
                render={(control) => (
                  <PhoneInput {...control} value={control.value ?? ""} />
                )}
              />
            ))}
            <ControlField
              label="Tags"
              name="tags"
              render={({ onChange }) => (
                <button onClick={() => onChange([])} type="button">
                  Clear tags
                </button>
              )}
            />
            {/* A number control reports `NaN` once cleared. */}
            <ControlField
              label="Count"
              name="count"
              render={({ onChange }) => (
                <button onClick={() => onChange(Number.NaN)} type="button">
                  Clear count
                </button>
              )}
            />
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
    render(<H />)
    await user.clear(screen.getByLabelText("nullable"))
    await user.clear(screen.getByLabelText("optional"))
    await user.clear(screen.getByLabelText("text"))
    await user.click(screen.getByRole("button", { name: "Clear tags" }))
    await user.click(screen.getByRole("button", { name: "Clear count" }))
    expect(captured.values).toStrictEqual({
      count: null,
      nullable: null,
      optional: undefined,
      tags: [],
      text: "",
    })
    expect(schema.safeParse(captured.values).success).toBe(true)
  })

  test("keeps one `onChange` across renders, so a control can memoize on it", async () => {
    const user = userEvent.setup()
    const handlers = new Set<unknown>()
    function H() {
      const form = useForm({ defaultValues: { phone: "" }, onSubmit: vi.fn() })
      const { ControlField } = form
      return (
        <FormProvider form={form}>
          <Form>
            <ControlField
              label="Phone"
              name="phone"
              render={(control) => {
                handlers.add(control.onChange)
                return <PhoneInput {...control} />
              }}
            />
          </Form>
        </FormProvider>
      )
    }
    render(<H />)
    await user.type(screen.getByLabelText(PHONE), "079")
    expect(handlers.size).toBe(1)
  })

  test("refuses a change event, rather than storing it", async () => {
    const user = userEvent.setup()
    const errors: unknown[] = []
    const onError = (event: ErrorEvent) => {
      event.preventDefault()
      errors.push(event.error)
    }
    window.addEventListener("error", onError)
    const captured: { values?: unknown } = {}
    function H() {
      const form = useForm({ defaultValues: { phone: "" }, onSubmit: vi.fn() })
      const { ControlField, Subscribe } = form
      return (
        <FormProvider form={form}>
          <Form>
            <ControlField
              label="Phone"
              name="phone"
              render={({ onChange }) => (
                // The mistake: an event handed to `onChange` as the value.
                <button
                  onClick={(event) => onChange(event as never)}
                  type="button"
                >
                  Set
                </button>
              )}
            />
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
    try {
      render(<H />)
      await user.click(screen.getByRole("button", { name: "Set" }))
    } finally {
      window.removeEventListener("error", onError)
    }
    expect(errors).toEqual([expect.any(TypeError)])
    expect(captured.values).toStrictEqual({ phone: "" })
  })
})
