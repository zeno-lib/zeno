import { getTableColumns, sql } from "drizzle-orm"
import {
  getTableConfig,
  isPgEnum,
  isPgMaterializedView,
  isPgSchema,
  isPgSequence,
  isPgView,
  pgEnum,
  pgMaterializedView,
  pgPolicy,
  pgRole,
  pgSchema,
  pgSequence,
  pgTableCreator,
  pgView,
  text,
  uuid,
} from "drizzle-orm/pg-core"
import { camelCase, snakeCase } from "drizzle-orm/pg-core/casing"
import { describe, expect, it } from "vitest"
import { createAdminClient } from "./clients.ts"
import { defineDrizzleConfig } from "./config.ts"
import {
  allPolicy,
  auditColumns,
  authenticatedOwnerDeletePolicy,
  authenticatedOwnerInsertPolicy,
  authenticatedOwnerSelectPolicy,
  authenticatedOwnerUpdatePolicy,
  authenticatedRole,
  authorship,
  authUid,
  authUserId,
  authUsers,
  createdBy,
  deletePolicy,
  enum as enum_,
  insertPolicy,
  isEnum,
  isMaterializedView,
  isSchema,
  isSequence,
  isView,
  materializedView,
  policy,
  primaryId,
  role,
  schema,
  selectPolicy,
  sequence,
  table,
  tableCreator,
  timestamps,
  unsecureTable,
  updatedBy,
  updatePolicy,
  view,
} from "./schema.ts"

describe("default casing", () => {
  it("leaves casing to Drizzle table constructors", () => {
    expect(defineDrizzleConfig()).not.toHaveProperty("casing")
  })

  it("works with Drizzle's snake_case table builders", async () => {
    const posts = snakeCase.table("posts", {
      displayName: text(),
      ownerId: uuid(),
    })
    const db = createAdminClient()

    expect(db.select().from(posts).toSQL().sql).toContain('"display_name"')
    expect(db.select().from(posts).toSQL().sql).toContain('"owner_id"')

    await db.close({ timeout: 0 })
  })

  it("allows callers to opt into camelCase table builders", async () => {
    const posts = camelCase.table("posts", {
      displayName: text(),
    })
    const db = createAdminClient()

    expect(db.select().from(posts).toSQL().sql).toContain('"displayName"')

    await db.close({ timeout: 0 })
  })

  it("exports an RLS-enabled snake_case table helper", async () => {
    const posts = table("posts", {
      displayName: text(),
      ownerId: uuid(),
    })
    const db = createAdminClient()

    expect(db.select().from(posts).toSQL().sql).toContain('"display_name"')
    expect(db.select().from(posts).toSQL().sql).toContain('"owner_id"')
    expect(getTableConfig(posts).enableRLS).toBe(true)

    await db.close({ timeout: 0 })
  })

  it("exports an explicit non-RLS snake_case table helper", async () => {
    const auditEvents = unsecureTable("audit_events", {
      displayName: text(),
      ownerId: uuid(),
    })
    const db = createAdminClient()

    expect(db.select().from(auditEvents).toSQL().sql).toContain(
      '"display_name"'
    )
    expect(db.select().from(auditEvents).toSQL().sql).toContain('"owner_id"')
    expect(getTableConfig(auditEvents).enableRLS).toBe(false)

    await db.close({ timeout: 0 })
  })

  it("re-exports likely pg-prefixed schema builders without the pg prefix", () => {
    expect(enum_).toBe(pgEnum)
    expect(isEnum).toBe(isPgEnum)
    expect(isMaterializedView).toBe(isPgMaterializedView)
    expect(isSchema).toBe(isPgSchema)
    expect(isSequence).toBe(isPgSequence)
    expect(isView).toBe(isPgView)
    expect(materializedView).toBe(pgMaterializedView)
    expect(policy).toBe(pgPolicy)
    expect(role).toBe(pgRole)
    expect(schema).toBe(pgSchema)
    expect(sequence).toBe(pgSequence)
    expect(tableCreator).toBe(pgTableCreator)
    expect(view).toBe(pgView)
  })

  it("exports common ID and Supabase auth-user column helpers", () => {
    const posts = table("posts", {
      id: primaryId("uuid"),
      ownerId: authUserId(),
      sequentialId: primaryId("sequential"),
    })
    const columns = getTableColumns(posts)
    const config = getTableConfig(posts)

    expect(columns.id.getSQLType()).toBe("uuid")
    expect(columns.id.primary).toBe(true)
    expect(columns.id.default).toBeDefined()
    expect(columns.sequentialId.getSQLType()).toBe("integer")
    expect(columns.sequentialId.primary).toBe(true)
    expect(columns.sequentialId.generatedIdentity?.type).toBe("always")
    expect(columns.ownerId.getSQLType()).toBe("uuid")
    expect(columns.ownerId.notNull).toBe(true)
    expect(config.foreignKeys).toHaveLength(1)
    expect(config.foreignKeys[0]?.reference().foreignTable).toBe(authUsers)
  })

  it("exports audit timestamp and auth-user column helpers with runtime defaults", () => {
    const posts = table("posts", {
      createdBy,
      updatedBy,
      ...timestamps,
    })
    const columns = getTableColumns(posts)
    const config = getTableConfig(posts)

    expect(columns.createdAt.name).toBe("created_at")
    expect(columns.createdAt.notNull).toBe(true)
    expect(columns.createdAt.default).toBeDefined()
    expect(columns.createdAt.onUpdateFn).toBeUndefined()
    expect(columns.updatedAt.name).toBe("updated_at")
    expect(columns.updatedAt.notNull).toBe(true)
    expect(columns.updatedAt.default).toBeDefined()
    expect(columns.updatedAt.onUpdateFn?.()).toBeInstanceOf(Date)
    expect(columns.createdBy.name).toBe("created_by")
    expect(columns.createdBy.notNull).toBe(true)
    expect(columns.createdBy.default).toBe(authUid)
    expect(columns.createdBy.onUpdateFn).toBeUndefined()
    expect(columns.updatedBy.name).toBe("updated_by")
    expect(columns.updatedBy.notNull).toBe(true)
    expect(columns.updatedBy.default).toBe(authUid)
    expect(columns.updatedBy.onUpdateFn?.()).toBe(authUid)
    expect(config.foreignKeys).toHaveLength(2)
    expect(
      config.foreignKeys.map(
        (foreignKey) => foreignKey.reference().foreignTable
      )
    ).toEqual([authUsers, authUsers])
  })

  it("exports grouped audit column mixins", () => {
    expect(Object.keys(timestamps)).toEqual(["createdAt", "updatedAt"])
    expect(Object.keys(authorship)).toEqual(["createdBy", "updatedBy"])
    expect(Object.keys(auditColumns)).toEqual([
      "createdAt",
      "updatedAt",
      "createdBy",
      "updatedBy",
    ])

    const posts = table("posts", {
      id: primaryId("uuid"),
      ...auditColumns,
    })
    const columns = getTableColumns(posts)

    expect(columns.createdAt.name).toBe("created_at")
    expect(columns.updatedAt.name).toBe("updated_at")
    expect(columns.createdBy.name).toBe("created_by")
    expect(columns.updatedBy.name).toBe("updated_by")
  })

  it("exports generic policy helpers that set the policy operation", () => {
    const condition = sql`true`

    expect(selectPolicy("select_posts", { using: condition }).for).toBe(
      "select"
    )
    expect(insertPolicy("insert_posts", { withCheck: condition }).for).toBe(
      "insert"
    )
    expect(updatePolicy("update_posts", { using: condition }).for).toBe(
      "update"
    )
    expect(deletePolicy("delete_posts", { using: condition }).for).toBe(
      "delete"
    )
    expect(allPolicy("all_posts", { using: condition }).for).toBe("all")
  })

  it("exports authenticated owner policy helpers for common Supabase RLS", () => {
    const posts = table(
      "posts",
      {
        id: primaryId("uuid"),
        userId: authUserId(),
      },
      (t) => [
        authenticatedOwnerSelectPolicy("posts_owner_select", t.userId),
        authenticatedOwnerInsertPolicy("posts_owner_insert", t.userId),
        authenticatedOwnerUpdatePolicy("posts_owner_update", t.userId),
        authenticatedOwnerDeletePolicy("posts_owner_delete", t.userId),
      ]
    )
    const policies = getTableConfig(posts).policies

    expect(policies.map((rlsPolicy) => rlsPolicy.for)).toEqual([
      "select",
      "insert",
      "update",
      "delete",
    ])
    expect(policies.map((rlsPolicy) => rlsPolicy.to)).toEqual([
      authenticatedRole,
      authenticatedRole,
      authenticatedRole,
      authenticatedRole,
    ])
    expect(policies[0]?.using).toBeDefined()
    expect(policies[1]?.withCheck).toBeDefined()
    expect(policies[2]?.using).toBeDefined()
    expect(policies[2]?.withCheck).toBeDefined()
    expect(policies[3]?.using).toBeDefined()
  })
})
