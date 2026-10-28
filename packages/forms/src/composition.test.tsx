import { cleanup, render, screen, within } from "@zeno-lib/test/testing-library"
import userEvent from "@zeno-lib/test/user-event"
import { afterEach, describe, expect, test, vi } from "vitest"
import { z } from "zod"
import {
  Form,
  FormProvider,
  useAppForm,
  useForm,
  withFieldGroup,
  withForm,
} from "./create-form"

const STREET_LABEL = /Street/u
const CITY_LABEL = /City/u
const BILLING_STREET_LABEL = /Billing street/u

afterEach(() => {
  cleanup()
})

const address = z.object({ city: z.string(), street: z.string() })
const schema = z.object({ billing: address, shipping: address })
type Values = z.infer<typeof schema>
const VALUES: Values = {
  billing: { city: "", street: "" },
  shipping: { city: "", street: "" },
}

const AddressGroup = withFieldGroup({
  defaultValues: VALUES.billing,
  props: { title: "" },
  render: ({ group, title }) => (
    <fieldset aria-label={title}>
      <group.InputField label="Street" name="street" />
      <group.InputField label="City" name="city" />
    </fieldset>
  ),
})

describe("withFieldGroup", () => {
  test("a group's named field binds under the group's path", async () => {
    const user = userEvent.setup()
    let current: { state: { values: Values } } | undefined
    function H() {
      const form = useForm({ onSubmit: vi.fn(), schema })
      current = form
      return (
        <FormProvider form={form}>
          <Form>
            <AddressGroup fields="billing" form={form} title="Billing" />
            <AddressGroup fields="shipping" form={form} title="Shipping" />
          </Form>
        </FormProvider>
      )
    }
    render(<H />)
    const shipping = within(screen.getByRole("group", { name: "Shipping" }))
    const street = shipping.getByLabelText(STREET_LABEL) as HTMLInputElement
    expect(street.name).toBe("shipping.street")
    await user.type(street, "Main St")
    expect(current?.state.values.shipping.street).toBe("Main St")
    expect(current?.state.values.billing.street).toBe("")
  })

  test("a group nested in a group binds under both paths", async () => {
    const user = userEvent.setup()
    const Nested = withFieldGroup({
      defaultValues: { billing: VALUES.billing },
      render: ({ group }) => (
        <AddressGroup fields="billing" form={group} title="Nested" />
      ),
    })
    const nestedSchema = z.object({ order: z.object({ billing: address }) })
    let current: { state: { values: z.infer<typeof nestedSchema> } } | undefined
    function H() {
      const form = useForm({ onSubmit: vi.fn(), schema: nestedSchema })
      current = form
      return (
        <FormProvider form={form}>
          <Form>
            <Nested fields="order" form={form} />
          </Form>
        </FormProvider>
      )
    }
    render(<H />)
    const city = screen.getByLabelText(CITY_LABEL) as HTMLInputElement
    expect(city.name).toBe("order.billing.city")
    await user.type(city, "Bern")
    expect(current?.state.values.order.billing.city).toBe("Bern")
  })
})

describe("withForm", () => {
  const BillingSection = withForm({
    defaultValues: VALUES,
    render: ({ form }) => (
      <form.InputField label="Billing street" name="billing.street" />
    ),
  })

  test("a section's form has the fields when useAppForm made it", async () => {
    const user = userEvent.setup()
    let current: { state: { values: Values } } | undefined
    function H() {
      const form = useAppForm({ defaultValues: VALUES, onSubmit: vi.fn() })
      current = form
      return (
        <FormProvider form={form}>
          <Form>
            <BillingSection form={form} />
          </Form>
        </FormProvider>
      )
    }
    render(<H />)
    await user.type(screen.getByLabelText(BILLING_STREET_LABEL), "Main St")
    expect(current?.state.values.billing.street).toBe("Main St")
  })

  test("a section keeps the fields of useForm's form as they are", () => {
    const seen: unknown[] = []
    function H() {
      const form = useForm({ onSubmit: vi.fn(), schema })
      seen.push(form.InputField)
      return (
        <FormProvider form={form}>
          <Form>
            <BillingSection form={form} />
          </Form>
        </FormProvider>
      )
    }
    const { rerender } = render(<H />)
    rerender(<H />)
    expect(seen).toHaveLength(2)
    expect(seen[1]).toBe(seen[0])
  })
})
