import { test } from "@zeno-lib/test"
import { z } from "zod"
import { useForm } from "./use-form"

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

const schemaNoEmail = z.object({
  contact: z.string(),
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

test("EmailField.name is optional when T has an `email` field", () => {
  const form = useForm({ onSubmit: () => undefined, schema })
  const { EmailField } = form
  // No `name` required.
  EmailField({})
  EmailField({ label: "Email" })
  EmailField({ name: "email" })
})

test("EmailField.name is required when T has no `email` field", () => {
  const form = useForm({ onSubmit: () => undefined, schema: schemaNoEmail })
  // @ts-expect-error — name becomes required without an "email" key on T
  form.EmailField({})
  form.EmailField({ name: "contact" })
})

test("PasswordField.name is optional when T has a `password` field", () => {
  const form = useForm({ onSubmit: () => undefined, schema })
  const { PasswordField } = form
  PasswordField({})
  PasswordField({ name: "password" })
})

test("PasswordField.name is required when T has no `password` field", () => {
  const form = useForm({ onSubmit: () => undefined, schema: schemaNoEmail })
  // @ts-expect-error — name becomes required without a "password" key on T
  form.PasswordField({})
  form.PasswordField({ name: "contact" })
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
