import type { JwtPayload } from "@supabase/supabase-js"
import { expectTypeOf, test } from "vitest"
import { z } from "zod"
import type { DrizzleClient } from "./clients.ts"
import { createRequestDb } from "./next.ts"

const { defineAction } = createRequestDb({
  supabase: () => ({
    auth: {
      getClaims: () => Promise.resolve({ data: null, error: null }),
    },
  }),
})

test("the action takes the schema's input and resolves to the handler's result", () => {
  const schema = z.object({ id: z.string().transform(Number) })
  const action = defineAction(schema, (db, input, context) => {
    expectTypeOf(db).toEqualTypeOf<DrizzleClient>()
    expectTypeOf(input).toEqualTypeOf<{ id: number }>()
    expectTypeOf(context.claims).toEqualTypeOf<JwtPayload>()
    return Promise.resolve(input.id)
  })

  expectTypeOf(action).parameter(0).toEqualTypeOf<{ id: string }>()
  expectTypeOf(action).returns.toEqualTypeOf<Promise<number>>()
})

test("a synchronous handler still yields an async action", () => {
  const action = defineAction(z.number(), (_db, input) => input > 0)

  expectTypeOf(action).returns.toEqualTypeOf<Promise<boolean>>()
})
