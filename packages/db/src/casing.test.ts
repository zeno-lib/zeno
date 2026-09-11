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
  assignedPrimaryId,
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
  sequentialPrimaryId,
  table,
  tableCreator,
  timestamps,
  unsecureTable,
  updatedBy,
  updatePolicy,
  uuidPrimaryId,
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

    await db.close()
  })

  it("allows callers to opt into camelCase table builders", async () => {
    const posts = camelCase.table("posts", {
      displayName: text(),
    })
    const db = createAdminClient()

    expect(db.select().from(posts).toSQL().sql).toContain('"displayName"')

    await db.close()
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

    await db.close()
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

    await db.close()
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

  it("exports a Supabase auth-user column helper", () => {
    const posts = table("posts", {
      id: primaryId("uuid"),
      ownerId: authUserId(),
    })
    const columns = getTableColumns(posts)
    const config = getTableConfig(posts)

    expect(columns.ownerId.getSQLType()).toBe("uuid")
    expect(columns.ownerId.notNull).toBe(true)
    expect(config.foreignKeys).toHaveLength(1)
    expect(config.foreignKeys[0]?.reference().foreignTable).toBe(authUsers)
  })

  // Each helper gets its own table: all three name the column "id" by default,
  // and Drizzle's setName returns early once a name is set, so two of them in
  // one table would silently share the name.
  it("builds a random-UUID primary key", () => {
    const columns = getTableColumns(table("posts", { id: primaryId("uuid") }))

    expect(columns.id.name).toBe("id")
    expect(columns.id.getSQLType()).toBe("uuid")
    expect(columns.id.primary).toBe(true)
    expect(columns.id.default).toBeDefined()
    expect(columns.id.generatedIdentity).toBeUndefined()
  })

  it("builds a UUID primary key without a default", () => {
    const columns = getTableColumns(
      table("profiles", { id: uuidPrimaryId({ defaultRandom: false }) })
    )

    expect(columns.id.getSQLType()).toBe("uuid")
    expect(columns.id.primary).toBe(true)
    expect(columns.id.hasDefault).toBe(false)
    expect(columns.id.default).toBeUndefined()
  })

  it("defaults a sequential primary key to Supabase's bigint by-default shape", () => {
    const columns = getTableColumns(
      table("posts", { id: primaryId("sequential") })
    )

    expect(columns.id.name).toBe("id")
    expect(columns.id.getSQLType()).toBe("bigint")
    expect(columns.id.primary).toBe(true)
    expect(columns.id.generatedIdentity?.type).toBe("byDefault")
  })

  it("builds always-generated, integer, and bigint-mode sequential keys", () => {
    const always = getTableColumns(
      table("always", { id: sequentialPrimaryId({ generated: "always" }) })
    )
    const int = getTableColumns(
      table("int", { id: sequentialPrimaryId({ type: "integer" }) })
    )
    const big = getTableColumns(
      table("big", { id: sequentialPrimaryId({ mode: "bigint" }) })
    )

    expect(always.id.getSQLType()).toBe("bigint")
    expect(always.id.generatedIdentity?.type).toBe("always")
    expect(int.id.getSQLType()).toBe("integer")
    expect(int.id.generatedIdentity?.type).toBe("byDefault")
    expect(big.id.getSQLType()).toBe("bigint")
    expect(big.id.generatedIdentity?.type).toBe("byDefault")
  })

  it("builds an application-assigned primary key with no default", () => {
    const columns = getTableColumns(
      table("invoices", { id: primaryId("assigned") })
    )
    const sized = getTableColumns(
      table("sized", { id: assignedPrimaryId({ length: 32 }) })
    )

    expect(columns.id.name).toBe("id")
    expect(columns.id.getSQLType()).toBe("varchar")
    expect(columns.id.primary).toBe(true)
    expect(columns.id.default).toBeUndefined()
    expect(columns.id.generatedIdentity).toBeUndefined()
    expect(sized.id.getSQLType()).toBe("varchar(32)")
  })

  it("lets every primary key helper override the column name", () => {
    const columns = getTableColumns(
      table("posts", {
        assignedKey: assignedPrimaryId({ name: "assigned_key" }),
        sequentialKey: sequentialPrimaryId({ name: "sequential_key" }),
        uuidKey: uuidPrimaryId({ name: "uuid_key" }),
      })
    )

    expect(columns.uuidKey.name).toBe("uuid_key")
    expect(columns.sequentialKey.name).toBe("sequential_key")
    expect(columns.assignedKey.name).toBe("assigned_key")
  })

  it("keeps a UUID key chainable into a cascading auth.users reference", () => {
    const profiles = table("profiles", {
      id: uuidPrimaryId({ defaultRandom: false }).references(
        () => authUsers.id,
        {
          onDelete: "cascade",
          onUpdate: "cascade",
        }
      ),
    })
    const columns = getTableColumns(profiles)
    const foreignKey = getTableConfig(profiles).foreignKeys[0]

    expect(columns.id.primary).toBe(true)
    expect(columns.id.notNull).toBe(true)
    expect(columns.id.default).toBeUndefined()
    expect(foreignKey?.reference().foreignTable).toBe(authUsers)
    expect(foreignKey?.onDelete).toBe("cascade")
    expect(foreignKey?.onUpdate).toBe("cascade")
  })

  it("keeps the random default when a UUID key also references auth.users", () => {
    const profiles = table("profiles", {
      id: uuidPrimaryId().references(() => authUsers.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    })
    const columns = getTableColumns(profiles)
    const foreignKey = getTableConfig(profiles).foreignKeys[0]

    expect(columns.id.primary).toBe(true)
    expect(columns.id.default).toBeDefined()
    expect(foreignKey?.reference().foreignTable).toBe(authUsers)
    expect(foreignKey?.onDelete).toBe("cascade")
  })

  it("routes every primaryId kind to its dedicated helper", () => {
    const selected = {
      assigned: getTableColumns(table("t", { id: primaryId("assigned") })).id,
      sequential: getTableColumns(table("t", { id: primaryId("sequential") }))
        .id,
      uuid: getTableColumns(table("t", { id: primaryId("uuid") })).id,
    }
    const direct = {
      assigned: getTableColumns(table("t", { id: assignedPrimaryId() })).id,
      sequential: getTableColumns(table("t", { id: sequentialPrimaryId() })).id,
      uuid: getTableColumns(table("t", { id: uuidPrimaryId() })).id,
    }

    for (const kind of ["uuid", "sequential", "assigned"] as const) {
      expect(selected[kind].getSQLType()).toBe(direct[kind].getSQLType())
      expect(selected[kind].primary).toBe(direct[kind].primary)
      expect(selected[kind].hasDefault).toBe(direct[kind].hasDefault)
      expect(selected[kind].generatedIdentity?.type).toBe(
        direct[kind].generatedIdentity?.type
      )
    }

    // The bare call is Supabase's own default for a new table.
    expect(
      getTableColumns(table("t", { id: primaryId() })).id.getSQLType()
    ).toBe("bigint")
  })

  it("exports audit timestamp and auth-user column helpers with runtime defaults", () => {
    const posts = table("posts", {
      createdBy: createdBy(),
      updatedBy: updatedBy(),
      ...timestamps(),
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
    expect(Object.keys(timestamps())).toEqual(["createdAt", "updatedAt"])
    expect(Object.keys(authorship())).toEqual(["createdBy", "updatedBy"])
    expect(Object.keys(auditColumns())).toEqual([
      "createdAt",
      "updatedAt",
      "createdBy",
      "updatedBy",
    ])

    const posts = table("posts", {
      id: primaryId("uuid"),
      ...auditColumns(),
    })
    const columns = getTableColumns(posts)

    expect(columns.createdAt.name).toBe("created_at")
    expect(columns.updatedAt.name).toBe("updated_at")
    expect(columns.createdBy.name).toBe("created_by")
    expect(columns.updatedBy.name).toBe("updated_by")
  })

  it("builds a fresh column builder on every audit mixin call", () => {
    expect(timestamps().createdAt).not.toBe(timestamps().createdAt)
    expect(authorship().createdBy).not.toBe(authorship().createdBy)
    expect(createdBy()).not.toBe(createdBy())
    expect(updatedBy()).not.toBe(updatedBy())
  })

  it("keeps tables built from separate audit mixin calls independent", () => {
    const postsAuthorship = authorship()
    const commentsAuthorship = authorship()
    const posts = table("posts", {
      ...postsAuthorship,
      createdBy: postsAuthorship.createdBy.unique(),
    })
    const comments = table("comments", { ...commentsAuthorship })

    expect(getTableColumns(posts).createdBy.isUnique).toBe(true)
    expect(getTableColumns(comments).createdBy.isUnique).toBe(false)
  })

  it("does not share foreign keys between audit mixin calls", () => {
    const profiles = table("profiles", { id: primaryId("uuid") })
    const postsAudit = auditColumns()
    const commentsAudit = auditColumns()
    const posts = table("posts", {
      ...postsAudit,
      createdBy: postsAudit.createdBy.references(() => profiles.id),
    })
    const comments = table("comments", { ...commentsAudit })

    expect(getTableConfig(posts).foreignKeys).toHaveLength(3)
    expect(getTableConfig(comments).foreignKeys).toHaveLength(2)
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
