import type { JwtPayload } from "@supabase/supabase-js"
import { expectTypeOf, test } from "vitest"
import { z } from "zod"
import type { DrizzleClient } from "./clients.ts"
import {
  type ActionError,
  type ActionResult,
  type ChangeDescription,
  createRequestDb,
} from "./next.ts"

const { defineAction, defineFormAction, defineQuery } = createRequestDb({
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

test("a result that may be undefined resolves to null instead", () => {
  const action = defineAction(z.number(), (_db, input) =>
    Promise.resolve(input > 0 ? { id: input } : undefined)
  )

  expectTypeOf(action).returns.toEqualTypeOf<Promise<{ id: number } | null>>()
})

test("a handler with no result resolves to null", () => {
  const action = defineAction(z.number(), async () => {
    await Promise.resolve()
  })

  expectTypeOf(action).returns.toEqualTypeOf<Promise<null>>()
})

test("defineFormAction takes the schema's input and resolves to an ActionResult", () => {
  const schema = z.object({ id: z.string().transform(Number) })
  const action = defineFormAction(schema, (db, input) => {
    expectTypeOf(db).toEqualTypeOf<DrizzleClient>()
    expectTypeOf(input).toEqualTypeOf<{ id: number }>()
    return Promise.resolve({ saved: input.id })
  })

  expectTypeOf(action).parameter(0).toEqualTypeOf<{ id: string }>()
  expectTypeOf(action).returns.toEqualTypeOf<
    Promise<ActionResult<{ saved: number }>>
  >()
})

test("an ActionResult narrows on ok", async () => {
  const action = defineFormAction(z.number(), (_db, input) => input > 0)
  const result = await action(1)

  if (result.ok) {
    expectTypeOf(result.data).toEqualTypeOf<boolean>()
  } else {
    expectTypeOf(result.error).toEqualTypeOf<ActionError>()
    expectTypeOf(result.error.fieldErrors).toEqualTypeOf<
      Record<string, string[]>
    >()
  }
})

test("the object form types its handler from the schema and keeps the action's types", () => {
  const schema = z.object({ id: z.string().transform(Number) })
  const action = defineAction({
    describeChange: (_db, input) => {
      expectTypeOf(input).toEqualTypeOf<{ id: number }>()
      return {
        changes: [{ field: "id", from: null, to: input.id }],
        entity: "Row",
      }
    },
    description: "Save a row.",
    name: "save_row",
    run: (db, input, context) => {
      expectTypeOf(db).toEqualTypeOf<DrizzleClient>()
      expectTypeOf(input).toEqualTypeOf<{ id: number }>()
      expectTypeOf(context.via).toEqualTypeOf<string | null>()
      return Promise.resolve(input.id)
    },
    schema,
  })

  expectTypeOf(action).parameter(0).toEqualTypeOf<{ id: string }>()
  expectTypeOf(action).returns.toEqualTypeOf<Promise<number>>()
  expectTypeOf(action.definition.invoke).returns.toEqualTypeOf<
    Promise<number>
  >()
  expectTypeOf(action.definition.readOnly).toEqualTypeOf<false>()
  expectTypeOf(action.definition.describe).returns.toEqualTypeOf<
    Promise<ChangeDescription | null>
  >()
})

test("a write's definition has describeChange only when it was given", () => {
  const described = defineAction({
    describeChange: () => ({ changes: [], entity: "Row" }),
    description: "Save a row.",
    name: "save_row",
    run: (_db, input) => input,
    schema: z.number(),
  })
  const undescribed = defineFormAction({
    description: "Save a row.",
    name: "save_row",
    run: (_db, input) => input,
    schema: z.number(),
  })

  expectTypeOf<undefined>().not.toExtend<
    typeof described.definition.describeChange
  >()
  expectTypeOf<undefined>().toExtend<
    typeof undescribed.definition.describeChange
  >()
})

test("a query's definition is read-only and has no describeChange", () => {
  const query = defineQuery({
    description: "Read a row.",
    name: "get_row",
    run: (_db, input) => input,
    schema: z.number(),
  })

  expectTypeOf(query.definition.readOnly).toEqualTypeOf<true>()
  expectTypeOf(query.definition).not.toHaveProperty("describeChange")
  expectTypeOf(query.definition).not.toHaveProperty("describe")
})

test("a paged query hands run limit and offset, and must resolve to a page", () => {
  const query = defineQuery({
    description: "List rows.",
    name: "list_rows",
    paged: true,
    run: (_db, input) => {
      expectTypeOf(input).toEqualTypeOf<
        { status?: string } & {
          readonly limit: number
          readonly offset: number
        }
      >()
      return { hasMore: false, items: [input.status], total: 1 }
    },
    schema: z.object({ status: z.string().optional() }),
  })

  expectTypeOf(query)
    .parameter(0)
    .toExtend<{ limit?: number; offset?: number }>()
  expectTypeOf(query.definition.paged.maxLimit).toEqualTypeOf<number>()

  defineQuery({
    description: "List rows.",
    name: "list_rows",
    // @ts-expect-error: a paged read resolves to `{ items, total, hasMore }`
    paged: true,
    run: () => [1, 2],
    schema: z.object({}),
  })
})

test("a paged query takes bounds declared as const", () => {
  const bounds = { maxLimit: 10 } as const
  defineQuery({
    description: "List rows.",
    name: "list_rows",
    paged: bounds,
    run: (_db, { limit, offset }) => ({
      hasMore: false,
      items: [],
      total: limit + offset,
    }),
    schema: z.object({}),
  })
})

test("the object form of defineFormAction resolves to an ActionResult", () => {
  const action = defineFormAction({
    description: "Save a row.",
    name: "save_row",
    run: (_db, input) => ({ saved: input }),
    schema: z.number(),
  })

  expectTypeOf(action.definition.invoke).returns.toEqualTypeOf<
    Promise<ActionResult<{ saved: number }>>
  >()
})

test("a positional action carries no definition", () => {
  const action = defineAction(z.number(), (_db, input) => input)

  // @ts-expect-error: only the object form has one
  expectTypeOf(action.definition).toBeUnknown()
})
