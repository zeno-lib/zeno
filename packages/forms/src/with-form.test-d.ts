import { expectTypeOf, test } from "vitest"
import { z } from "zod"
import {
  useAppFields,
  useAppForm,
  useForm,
  withFieldGroup,
  withForm,
} from "./create-form"

const schema = z.object({
  address: z.object({ city: z.string(), street: z.string() }),
  email: z.string(),
})
type Values = z.infer<typeof schema>
const VALUES: Values = { address: { city: "", street: "" }, email: "" }

// Typed by `defaultValues`, as in TanStack; `render` gets the kit's fields
// through `useAppFields`.
const EmailSection = withForm({
  defaultValues: VALUES,
  props: { title: "" },
  render({ form, title }) {
    expectTypeOf(title).toEqualTypeOf<string>()
    expectTypeOf(form.state.values).toEqualTypeOf<Values>()
    // biome-ignore lint/correctness/useHookAtTopLevel: `withForm` runs `render` inside a component; a .ts file can't return JSX to show it.
    const { InputField } = useAppFields(form)
    InputField({ name: "address.city" })
    // @ts-expect-error — not a path of the form
    InputField({ name: "phone" })
    return null
  },
})

const AddressGroup = withFieldGroup({
  defaultValues: VALUES.address,
  render: () => null,
})

// A section's `form` and a group's `group` carry the fields themselves.
withForm({
  defaultValues: VALUES,
  render: ({ form }) => {
    form.InputField({ name: "address.city" })
    // @ts-expect-error — not a path of the form
    form.InputField({ name: "phone" })
    return null
  },
})

withFieldGroup({
  defaultValues: VALUES.address,
  props: { label: "" },
  render: ({ group, label }) => {
    expectTypeOf(label).toEqualTypeOf<string>()
    expectTypeOf(group.state.values).toEqualTypeOf<Values["address"]>()
    const { InputField } = group
    InputField({ name: "street" })
    // @ts-expect-error — a path of the form, not of the group
    InputField({ name: "address.street" })
    return null
  },
})

test("withForm takes the form useForm returns, with a schema", () => {
  const form = useForm({ onSubmit: () => undefined, schema })
  EmailSection({ form, title: "Email" })
  AddressGroup({ fields: "address", form })
})

test("withForm takes the form useForm returns, with a validation mode", () => {
  const form = useForm({
    onSubmit: () => undefined,
    schema,
    validators: "change",
  })
  EmailSection({ form, title: "Email" })
})

test("withForm takes the form useForm returns, without a schema", () => {
  const form = useForm<Values>({
    defaultValues: VALUES,
    onSubmit: () => undefined,
  })
  EmailSection({ form, title: "Email" })
  AddressGroup({ fields: "address", form })
})

test("withForm still takes the form useAppForm returns", () => {
  const form = useAppForm({ defaultValues: VALUES, onSubmit: () => undefined })
  EmailSection({ form, title: "Email" })
})

test("withForm rejects a form with other values", () => {
  const form = useForm({
    onSubmit: () => undefined,
    schema: z.object({ name: z.string() }),
  })
  // @ts-expect-error — the section needs `email` and `address`
  EmailSection({ form, title: "Email" })
})
