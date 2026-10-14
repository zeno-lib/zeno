import type { ReactNode } from "react"
import { expectTypeOf, test } from "vitest"
import { z } from "zod"
import { useForm } from "./create-form"
import { createZenoForm } from "./create-zeno-form"

const schema = z.object({
  accept: z.boolean(),
  age: z.number(),
  bio: z.string(),
  email: z.string(),
  notes: z.string(),
  password: z.string(),
  profile: z.object({ nick: z.string() }),
  size: z.string(),
})

test("InputField.name is constrained to DeepKeys<T>", () => {
  const form = useForm({ onSubmit: () => undefined, schema })
  const { InputField } = form
  InputField({ name: "email" })
  InputField({ name: "profile.nick" })
  // @ts-expect-error — not a valid path
  InputField({ name: "nonexistent" })
  // @ts-expect-error — wrong nested path
  InputField({ name: "profile.unknown" })
})

test("NumberField.name is constrained to DeepKeys<T>", () => {
  const form = useForm({ onSubmit: () => undefined, schema })
  form.NumberField({ name: "age" })
  // @ts-expect-error — not a valid path
  form.NumberField({ name: "nonexistent" })
})

test("CheckboxField.name is constrained to DeepKeys<T>", () => {
  const form = useForm({ onSubmit: () => undefined, schema })
  form.CheckboxField({ name: "accept" })
  // @ts-expect-error — not a valid path
  form.CheckboxField({ name: "nonexistent" })
})

test("SelectField.name is constrained to DeepKeys<T>", () => {
  const form = useForm({ onSubmit: () => undefined, schema })
  form.SelectField({ children: null, name: "size" })
  // @ts-expect-error — not a valid path
  form.SelectField({ children: null, name: "nonexistent" })
})

test("TextAreaField.name is constrained to DeepKeys<T>", () => {
  const form = useForm({ onSubmit: () => undefined, schema })
  form.TextAreaField({ name: "notes" })
  // @ts-expect-error — not a valid path
  form.TextAreaField({ name: "nonexistent" })
})

test("EmailField.name is required and constrained to DeepKeys<T>", () => {
  const form = useForm({ onSubmit: () => undefined, schema })
  const { EmailField } = form
  // @ts-expect-error — name is required
  EmailField({})
  EmailField({ name: "email" })
  // @ts-expect-error — not a valid path
  EmailField({ name: "nonexistent" })
})

test("PasswordField.name is required and constrained to DeepKeys<T>", () => {
  const form = useForm({ onSubmit: () => undefined, schema })
  const { PasswordField } = form
  // @ts-expect-error — name is required
  PasswordField({})
  PasswordField({ name: "password" })
})

test("validators prop is accepted on every field wrapper", () => {
  const form = useForm({ onSubmit: () => undefined, schema })
  form.InputField({
    name: "email",
    validators: {
      onChange: () => undefined,
      onChangeAsyncDebounceMs: 300,
    },
  })
  form.SelectField({
    children: null,
    name: "size",
    validators: { onBlur: () => undefined },
  })
})

test("listeners prop is accepted on every field wrapper", () => {
  const form = useForm({ onSubmit: () => undefined, schema })
  form.InputField({
    listeners: { onChange: () => undefined, onChangeDebounceMs: 50 },
    name: "email",
  })
})

test("ControlField types its control with the value at `name`", () => {
  const form = useForm({
    onSubmit: () => undefined,
    schema: z.object({
      phone: z.string().nullable(),
      rating: z.number(),
    }),
  })
  form.ControlField({
    name: "phone",
    render: (control) => {
      expectTypeOf(control.value).toEqualTypeOf<string | null>()
      return null
    },
  })
  form.ControlField({
    name: "rating",
    render: (control) => {
      control.onChange(3)
      // @ts-expect-error — the field holds a number
      control.onChange("3")
      return null
    },
  })
  // @ts-expect-error — not a valid path
  form.ControlField({ name: "nonexistent", render: () => null })
})

test("a field whose `render` takes another argument keeps its own type", () => {
  const { useForm: useListForm } = createZenoForm({
    fieldComponents: {
      ListField: (_: { render: (row: { id: string }) => ReactNode }) => null,
    },
    formComponents: {},
  })
  const form = useListForm({
    onSubmit: () => undefined,
    schema: z.object({ rows: z.array(z.string()) }),
  })
  form.ListField({
    name: "rows",
    render: (row) => {
      expectTypeOf(row).toEqualTypeOf<{ id: string }>()
      return null
    },
  })
})
