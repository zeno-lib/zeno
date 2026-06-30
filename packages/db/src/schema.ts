// https://orm.drizzle.team/docs/rls#using-with-supabase  (re-exported roles, authUsers, authUid, realtimeMessages)
import { sql } from "drizzle-orm"
import {
  type AnyPgColumn,
  integer,
  type PgPolicyConfig,
  pgPolicy,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"
import { snakeCase } from "drizzle-orm/pg-core/casing"
import { authenticatedRole, authUid, authUsers } from "drizzle-orm/supabase"

// Curated pg-core aliases for schema primitives that otherwise repeat the pg
// prefix at every call site. `table` is Zeno's RLS-by-default helper below.
// biome-ignore lint/performance/noBarrelFile: intentional public re-export surface
export {
  isPgEnum as isEnum,
  isPgMaterializedView as isMaterializedView,
  isPgSchema as isSchema,
  isPgSequence as isSequence,
  isPgView as isView,
  pgEnum as enum,
  pgMaterializedView as materializedView,
  pgPolicy as policy,
  pgRole as role,
  pgSchema as schema,
  pgSequence as sequence,
  pgTableCreator as tableCreator,
  pgView as view,
} from "drizzle-orm/pg-core"

// Curated Supabase primitives from drizzle-orm/supabase so consumers can import
// roles, the auth.users table, and helpers from one Zeno-owned schema entrypoint.
export {
  anonRole,
  authenticatedRole,
  authUid,
  authUsers,
  postgresRole,
  realtimeMessages,
  realtimeTopic,
  serviceRole,
  supabaseAuthAdminRole,
} from "drizzle-orm/supabase"

// Reusable created_at / updated_at columns — spread into a pgTable column map.
export const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}

export const authUserId = (name?: string) =>
  uuid(name)
    .notNull()
    .references(() => authUsers.id)

export const createdBy = authUserId("created_by").default(authUid)
export const updatedBy = authUserId("updated_by")
  .default(authUid)
  .$onUpdate(() => authUid)

export const authorship = {
  createdBy,
  updatedBy,
}

export const auditColumns = {
  ...timestamps,
  ...authorship,
}

const uuidPrimaryId = () => uuid("id").primaryKey().defaultRandom()
const sequentialPrimaryId = () =>
  integer("id").primaryKey().generatedAlwaysAsIdentity()

export function primaryId(kind?: "uuid"): ReturnType<typeof uuidPrimaryId>
export function primaryId(
  kind: "sequential"
): ReturnType<typeof sequentialPrimaryId>
export function primaryId(kind: "uuid" | "sequential" = "uuid") {
  return kind === "sequential" ? sequentialPrimaryId() : uuidPrimaryId()
}

type PolicyOptions = Omit<PgPolicyConfig, "for">
type PolicyOperation = NonNullable<PgPolicyConfig["for"]>

function operationPolicy(
  name: string,
  operation: PolicyOperation,
  config: PolicyOptions = {}
) {
  return pgPolicy(name, { ...config, for: operation })
}

export const selectPolicy = (name: string, config: PolicyOptions = {}) =>
  operationPolicy(name, "select", config)

export const insertPolicy = (name: string, config: PolicyOptions = {}) =>
  operationPolicy(name, "insert", config)

export const updatePolicy = (name: string, config: PolicyOptions = {}) =>
  operationPolicy(name, "update", config)

export const deletePolicy = (name: string, config: PolicyOptions = {}) =>
  operationPolicy(name, "delete", config)

export const allPolicy = (name: string, config: PolicyOptions = {}) =>
  operationPolicy(name, "all", config)

export const authUserOwns = (ownerColumn: AnyPgColumn) =>
  sql`${ownerColumn} = ${authUid}`

type OwnerPolicyOptions = Omit<PgPolicyConfig, "for" | "to">

export const authenticatedOwnerSelectPolicy = (
  name: string,
  ownerColumn: AnyPgColumn,
  config: OwnerPolicyOptions = {}
) =>
  selectPolicy(name, {
    ...config,
    to: authenticatedRole,
    using: config.using ?? authUserOwns(ownerColumn),
  })

export const authenticatedOwnerInsertPolicy = (
  name: string,
  ownerColumn: AnyPgColumn,
  config: OwnerPolicyOptions = {}
) =>
  insertPolicy(name, {
    ...config,
    to: authenticatedRole,
    withCheck: config.withCheck ?? authUserOwns(ownerColumn),
  })

export const authenticatedOwnerUpdatePolicy = (
  name: string,
  ownerColumn: AnyPgColumn,
  config: OwnerPolicyOptions = {}
) => {
  const ownerCondition = authUserOwns(ownerColumn)
  return updatePolicy(name, {
    ...config,
    to: authenticatedRole,
    using: config.using ?? ownerCondition,
    withCheck: config.withCheck ?? ownerCondition,
  })
}

export const authenticatedOwnerDeletePolicy = (
  name: string,
  ownerColumn: AnyPgColumn,
  config: OwnerPolicyOptions = {}
) =>
  deletePolicy(name, {
    ...config,
    to: authenticatedRole,
    using: config.using ?? authUserOwns(ownerColumn),
  })

export const authenticatedOwnerAllPolicy = (
  name: string,
  ownerColumn: AnyPgColumn,
  config: OwnerPolicyOptions = {}
) => {
  const ownerCondition = authUserOwns(ownerColumn)
  return allPolicy(name, {
    ...config,
    to: authenticatedRole,
    using: config.using ?? ownerCondition,
    withCheck: config.withCheck ?? ownerCondition,
  })
}

// Default table helper for application-owned tables: TypeScript columns stay
// camelCase, database identifiers become snake_case, and RLS is enabled.
export const table = snakeCase.table.withRLS

// Escape hatch for intentionally non-RLS tables such as seed/reference data.
export const unsecureTable = snakeCase.table
