import { expectTypeOf, test } from "vitest"

import {
  auditColumns,
  authorship,
  authUserId,
  primaryId,
  sequentialPrimaryId,
  table,
  timestamps,
  userId,
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

test("author columns are nullable unless asked to be required", () => {
  const posts = table("posts", { ownerId: authUserId() })
  const required = table("required", {
    ownerId: authUserId({ notNull: true }),
  })

  expectTypeOf<(typeof posts)["$inferSelect"]["ownerId"]>().toEqualTypeOf<
    string | null
  >()
  expectTypeOf<
    (typeof required)["$inferSelect"]["ownerId"]
  >().toEqualTypeOf<string>()
})

test("authorship options reach both columns", () => {
  const audited = table("audited", { ...auditColumns({ notNull: true }) })
  const loose = table("loose", { ...authorship() })

  expectTypeOf<
    (typeof audited)["$inferSelect"]["createdBy"]
  >().toEqualTypeOf<string>()
  expectTypeOf<
    (typeof audited)["$inferSelect"]["updatedBy"]
  >().toEqualTypeOf<string>()
  expectTypeOf<(typeof loose)["$inferSelect"]["createdBy"]>().toEqualTypeOf<
    string | null
  >()
})

test("author columns default on insert, so they stay optional", () => {
  const posts = table("posts", { ...authorship({ notNull: true }) })

  expectTypeOf<(typeof posts)["$inferInsert"]>().toEqualTypeOf<{
    createdBy?: string
    updatedBy?: string
  }>()
})

test("userId narrows the same way against its own reference", () => {
  const profiles = table("profiles", {
    id: uuidPrimaryId({ defaultRandom: false }),
  })
  const posts = table("posts", {
    ownerId: userId(() => profiles.id, { notNull: true }),
  })

  expectTypeOf<
    (typeof posts)["$inferSelect"]["ownerId"]
  >().toEqualTypeOf<string>()
})

test("reference actions are rejected when there is no reference", () => {
  // @ts-expect-error actions are meaningless without a foreign key
  authUserId({ actions: { onDelete: "cascade" }, reference: null })
})

test("timestamps reads a Date by default and a string with mode: string", () => {
  const dated = table("dated", { ...timestamps() })
  const stringly = table("stringly", { ...timestamps({ mode: "string" }) })
  const audited = table("audited_strings", {
    ...auditColumns({ mode: "string" }),
  })

  expectTypeOf<
    (typeof dated)["$inferSelect"]["createdAt"]
  >().toEqualTypeOf<Date>()
  expectTypeOf<
    (typeof stringly)["$inferSelect"]["updatedAt"]
  >().toEqualTypeOf<string>()
  expectTypeOf<
    (typeof audited)["$inferSelect"]["createdAt"]
  >().toEqualTypeOf<string>()
  // Both still have a default, so neither is required on insert.
  expectTypeOf<(typeof stringly)["$inferInsert"]>().toEqualTypeOf<{
    createdAt?: string | undefined
    updatedAt?: string | undefined
  }>()
})
