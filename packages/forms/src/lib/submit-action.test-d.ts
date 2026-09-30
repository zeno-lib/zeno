import { expectTypeOf, test } from "vitest"
import { z } from "zod"
import { useForm } from "../create-form"
import type { ActionResult } from "./action-result"
import { submitAction } from "./submit-action"

const schema = z.object({
  name: z.string(),
  percentage: z.string().transform(Number),
})
type Values = z.input<typeof schema>

// What `defineFormAction` in `@zeno-lib/db/next` produces, restated here so
// the structural contract is pinned without depending on that package.
type ServerActionError = {
  readonly fieldErrors: Record<string, string[]>
  readonly formErrors: string[]
}
type ServerActionResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: ServerActionError }

declare function saveShare(input: {
  name: string
  percentage: number
}): Promise<ServerActionResult<{ id: number }>>
declare function saveRaw(input: Values): Promise<ServerActionResult<Values>>

test("infers the data type from the action, with no explicit generics", () => {
  useForm({
    defaultValues: { name: "", percentage: "" },
    onSubmit: async (submit) => {
      const result = await submitAction(submit, saveShare, { schema })
      expectTypeOf(result).toEqualTypeOf<ActionResult<{ id: number }>>()
      if (result.ok) {
        expectTypeOf(result.data).toEqualTypeOf<{ id: number }>()
      }
    },
  })
})

test("without a schema the action must accept the form values", () => {
  useForm({
    defaultValues: { name: "", percentage: "" },
    onSubmit: (submit) => submitAction(submit, saveRaw, { reset: true }),
  })
  useForm({
    defaultValues: { name: "", percentage: "" },
    // @ts-expect-error: the action wants `percentage: number`; pass `schema` to transform.
    onSubmit: (submit) => submitAction(submit, saveShare),
  })
})

test("with a schema the action receives the schema output", () => {
  useForm({
    defaultValues: { name: "", percentage: "" },
    onSubmit: (submit) =>
      // @ts-expect-error: the schema outputs `percentage: number`, the action wants a string.
      submitAction(submit, saveRaw, { schema }),
  })
})

test("reset: true is only offered when the data has the form's shape", () => {
  useForm({
    defaultValues: { name: "", percentage: "" },
    onSubmit: (submit) =>
      // @ts-expect-error: `{ id: number }` is not the form's values.
      submitAction(submit, saveShare, { reset: true, schema }),
  })
  useForm({
    defaultValues: { name: "", percentage: "" },
    onSubmit: (submit) =>
      submitAction(submit, saveShare, { reset: "values", schema }),
  })
  useForm({
    defaultValues: { name: "", percentage: "" },
    onSubmit: (submit) =>
      submitAction(submit, saveShare, {
        reset: (data) => ({ name: String(data.id), percentage: "" }),
        schema,
      }),
  })
})
