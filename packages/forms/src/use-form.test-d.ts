import { expectTypeOf, test } from "vitest"
import { z } from "zod"
import { useForm } from "./use-form"

const stringSchema = z.object({
  age: z.number(),
  email: z.string(),
  profile: z.object({ nick: z.string() }),
  tags: z.array(z.string()),
})

type Schema = z.infer<typeof stringSchema>

test("schema path: defaultValues is PartialFormData (deep partial for plain objects)", () => {
  // Plain object keys are optional…
  useForm({
    defaultValues: { email: "x" },
    onSubmit: () => undefined,
    schema: stringSchema,
  })
  useForm({
    defaultValues: {},
    onSubmit: () => undefined,
    schema: stringSchema,
  })
  // Nested object keys are partial…
  useForm({
    defaultValues: { profile: { nick: "x" } },
    onSubmit: () => undefined,
    schema: stringSchema,
  })
  useForm({
    defaultValues: { profile: {} },
    onSubmit: () => undefined,
    schema: stringSchema,
  })
  // Arrays remain atomic (no per-element relaxation).
  useForm({
    defaultValues: { tags: ["a", "b"] },
    onSubmit: () => undefined,
    schema: stringSchema,
  })
  useForm({
    // @ts-expect-error — array element type still enforced (number ≠ string)
    defaultValues: { tags: [1] },
    onSubmit: () => undefined,
    schema: stringSchema,
  })
})

test("schema path: validationLogic is forbidden (type never)", () => {
  // Error lands on the overall call argument, not on `validationLogic`:
  // `validationLogic: never` makes the whole options object incompatible.
  // @ts-expect-error — validationLogic is `never` on the schema path
  useForm({
    onSubmit: () => undefined,
    schema: stringSchema,
    validationLogic: () => undefined,
  })
})

test("schema path: validators rejects the native object shape", () => {
  // @ts-expect-error — object form is not allowed on the schema path
  useForm({
    onSubmit: () => undefined,
    schema: stringSchema,
    validators: { onChange: () => undefined },
  })
})

test("schema path: validators accepts a ValidationMode string", () => {
  useForm({
    onSubmit: () => undefined,
    schema: stringSchema,
    validators: "change",
  })
  useForm({
    onSubmit: () => undefined,
    schema: stringSchema,
    validators: "blur",
  })
  useForm({
    onSubmit: () => undefined,
    schema: stringSchema,
    validators: "submit",
  })
  useForm({
    onSubmit: () => undefined,
    schema: stringSchema,
    validators: "blur-then-change",
  })
})

test("schema path: validators rejects unknown string values", () => {
  useForm({
    onSubmit: () => undefined,
    schema: stringSchema,
    // @ts-expect-error — must be a ValidationMode
    validators: "bogus",
  })
})

test("schema path: onSubmit `value` is typed from the schema output", () => {
  useForm({
    onSubmit: ({ value }) => {
      expectTypeOf(value).toEqualTypeOf<Schema>()
    },
    schema: stringSchema,
  })
})

test("manual path: defaultValues accepts the full TFormData shape", () => {
  // Note: the wrapper applies `PartialFormData<TFormData>` on both branches
  // via `ZenoFormExtras`, so omitting keys typechecks here too. This test
  // documents that the full shape is always accepted; the *required* shape
  // contract is enforced by TanStack's runtime, not the wrapper's types.
  useForm<{ a: string; b: number }>({
    defaultValues: { a: "x", b: 1 },
    onSubmit: () => undefined,
  })
})

test("manual path: validators string requires the schema path", () => {
  // Supplying a `validators: "change"` string narrows the union to the
  // schema branch, which then demands `schema`. The error lands on the
  // overall call (no `schema` provided), not on the `validators` line.
  // @ts-expect-error — schema becomes required when validators is a string
  useForm({
    defaultValues: { a: "" },
    onSubmit: () => undefined,
    validators: "change",
  })
})

test("manual path: validationLogic is accepted (native function shape)", () => {
  useForm({
    defaultValues: { a: "" },
    onSubmit: () => undefined,
    validationLogic: () => undefined,
  })
})

test("returned form retains the TanStack Form API surface", () => {
  const form = useForm({
    onSubmit: () => undefined,
    schema: stringSchema,
  })
  expectTypeOf(form.handleSubmit).toBeFunction()
  expectTypeOf(form.reset).toBeFunction()
  expectTypeOf(form.setFieldValue).toBeFunction()
  expectTypeOf(form.state).not.toBeNever()
})
