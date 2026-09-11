import { expectTypeOf, test } from "vitest"

import {
  primaryId,
  sequentialPrimaryId,
  table,
  uuidPrimaryId,
} from "./schema.ts"

test("primaryId infers each kind, and falls back to sequential", () => {
  const fallback = table("fallback", { id: primaryId() })
  const sequential = table("sequential", { id: primaryId("sequential") })
  const uuid = table("uuid", { id: primaryId("uuid") })
  const assigned = table("assigned", { id: primaryId("assigned") })

  // Sequential keys are `number`, not `bigint`, because PostgREST serialises
  // to JSON numbers. The bare call is sequential, matching the dashboard.
  expectTypeOf<
    (typeof fallback)["$inferSelect"]["id"]
  >().toEqualTypeOf<number>()
  expectTypeOf<
    (typeof sequential)["$inferSelect"]["id"]
  >().toEqualTypeOf<number>()
  expectTypeOf<(typeof uuid)["$inferSelect"]["id"]>().toEqualTypeOf<string>()
  expectTypeOf<
    (typeof assigned)["$inferSelect"]["id"]
  >().toEqualTypeOf<string>()
})

test("sequential options change the inferred JavaScript type", () => {
  const int = table("int", { id: sequentialPrimaryId({ type: "integer" }) })
  const big = table("big", { id: sequentialPrimaryId({ mode: "bigint" }) })
  const always = table("always", {
    id: sequentialPrimaryId({ generated: "always" }),
  })

  expectTypeOf<(typeof int)["$inferSelect"]["id"]>().toEqualTypeOf<number>()
  expectTypeOf<(typeof big)["$inferSelect"]["id"]>().toEqualTypeOf<bigint>()
  expectTypeOf<(typeof always)["$inferSelect"]["id"]>().toEqualTypeOf<number>()
})

test("mode is rejected for integer, which has one JavaScript representation", () => {
  // @ts-expect-error mode applies to bigint only
  sequentialPrimaryId({ mode: "bigint", type: "integer" })
})

test("dropping the random default makes a uuid key required on insert", () => {
  const posts = table("posts", { id: primaryId("uuid") })
  const profiles = table("profiles", {
    id: uuidPrimaryId({ defaultRandom: false }),
  })

  // gen_random_uuid() supplies the id, so callers may omit it.
  expectTypeOf<(typeof posts)["$inferInsert"]>().toEqualTypeOf<{
    id?: string
  }>()
  // An auth.users mirror takes its id from the referenced row.
  expectTypeOf<(typeof profiles)["$inferInsert"]>().toEqualTypeOf<{
    id: string
  }>()
})
