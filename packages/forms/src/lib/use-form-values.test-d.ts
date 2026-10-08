import { expectTypeOf, test } from "vitest"
import { z } from "zod"
import { useForm } from "../create-form"
import { useFormValues } from "./use-form-values"

test("useFormValues is typed from the form", () => {
  const schema = z.object({ count: z.number(), name: z.string().optional() })
  const form = useForm({ schema })

  expectTypeOf(useFormValues(form)).toEqualTypeOf<{
    count: number
    name?: string | undefined
  }>()
})
