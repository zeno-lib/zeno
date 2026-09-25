import { getTableColumns, is, type SQL, sql } from "drizzle-orm"
import {
  bigint,
  getTableConfig,
  isPgEnum,
  isPgMaterializedView,
  isPgSchema,
  isPgSequence,
  isPgView,
  PgDialect,
  PgTimestampString,
  pgEnum,
  pgMaterializedView,
  pgPolicy,
  pgRole,
  pgSequence,
  pgTableCreator,
  pgView,
  text,
  uuid,
} from "drizzle-orm/pg-core"
import { camelCase, snakeCase } from "drizzle-orm/pg-core/casing"
import { describe, expect, it } from "vitest"
import { authUsers } from "./auth-schema.ts"
import { createAdminClient } from "./clients.ts"
import { defineDrizzleConfig, supabaseManagedRoles } from "./config.ts"
import {
  allPolicy,
  assignedPrimaryId,
  auditColumns,
  authenticatedAllPolicy,
  authenticatedDeletePolicy,
  authenticatedInsertPolicy,
  authenticatedOwnerDeletePolicy,
  authenticatedOwnerInsertPolicy,
  authenticatedOwnerSelectPolicy,
  authenticatedOwnerUpdatePolicy,
  authenticatedRole,
  authenticatedSelectPolicy,
  authenticatedUpdatePolicy,
  authorship,
  authUserId,
  createdBy,
  deletePolicy,
  enum as enum_,
  functionPolicies,
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
  userId,
  uuidPrimaryId,
  view,
} from "./schema.ts"

describe("default casing", () => {
  it("leaves casing to Drizzle table constructors", () => {
    expect(defineDrizzleConfig()).not.toHaveProperty("casing")
  })

  it("excludes every Supabase-managed role from the role diff", () => {
    const roles = defineDrizzleConfig().entities?.roles

    expect(roles).toMatchObject({ provider: "supabase" })
    expect(typeof roles === "object" ? roles.exclude : []).toEqual(
      expect.arrayContaining([...supabaseManagedRoles])
    )
  })

  it("keeps a caller's own excluded roles alongside the Supabase ones", () => {
    const roles = defineDrizzleConfig({
      entities: { roles: { exclude: ["my_reporting_role"] } },
    }).entities?.roles
    const exclude = typeof roles === "object" ? (roles.exclude ?? []) : []

    expect(exclude).toContain("my_reporting_role")
    expect(exclude).toContain("supabase_replication_admin")
    expect(roles).toMatchObject({ provider: "supabase" })
  })

  it("diffs only the public schema unless told otherwise", () => {
    expect(defineDrizzleConfig().schemaFilter).toEqual(["public"])
    expect(
      defineDrizzleConfig({ schemaFilter: ["public", "billing"] }).schemaFilter
    ).toEqual(["public", "billing"])
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
    const foreignKey = config.foreignKeys[0]

    expect(columns.ownerId.getSQLType()).toBe("uuid")
    // Nullable so deleting the user blanks the author instead of failing.
    expect(columns.ownerId.notNull).toBe(false)
    expect(config.foreignKeys).toHaveLength(1)
    expect(foreignKey?.reference().foreignTable).toBe(authUsers)
    expect(foreignKey?.onDelete).toBe("set null")
    expect(foreignKey?.onUpdate).toBe("cascade")
  })

  it("restricts the delete when an author column is required", () => {
    const posts = table("posts", { ownerId: authUserId({ notNull: true }) })
    const foreignKey = getTableConfig(posts).foreignKeys[0]

    expect(getTableColumns(posts).ownerId.notNull).toBe(true)
    // `set null` against a NOT NULL column is a foreign key that can never
    // fire, so a required author restricts instead.
    expect(foreignKey?.onDelete).toBe("restrict")
    expect(foreignKey?.onUpdate).toBe("cascade")
  })

  it("takes an explicit column name and reference actions", () => {
    const posts = table("posts", {
      ownerId: authUserId({
        actions: { onDelete: "cascade", onUpdate: "no action" },
        name: "owner_id",
      }),
    })
    const foreignKey = getTableConfig(posts).foreignKeys[0]

    expect(getTableColumns(posts).ownerId.name).toBe("owner_id")
    expect(foreignKey?.onDelete).toBe("cascade")
    expect(foreignKey?.onUpdate).toBe("no action")
  })

  it("drops the foreign key entirely when the reference is null", () => {
    const posts = table("posts", {
      ownerId: authUserId({ reference: null }),
      ...authorship({ reference: null }),
    })

    expect(getTableConfig(posts).foreignKeys).toHaveLength(0)
    expect(getTableColumns(posts).ownerId.getSQLType()).toBe("uuid")
    expect(getTableColumns(posts).createdBy.name).toBe("created_by")
  })

  it("points author columns at a public profiles mirror", () => {
    const profiles = table("profiles", {
      id: uuidPrimaryId({ defaultRandom: false }),
    })
    const posts = table("posts", {
      ownerId: userId(() => profiles.id),
      ...authorship({ reference: () => profiles.id }),
    })
    const foreignKeys = getTableConfig(posts).foreignKeys

    expect(foreignKeys).toHaveLength(3)
    for (const foreignKey of foreignKeys) {
      expect(foreignKey.reference().foreignTable).toBe(profiles)
      expect(foreignKey.onDelete).toBe("set null")
    }
    expect(getTableColumns(posts).ownerId.notNull).toBe(false)
  })

  it("builds the same column through userId as through authUserId", () => {
    const viaAuth = table("a", { ownerId: authUserId({ notNull: true }) })
    const viaUserId = table("b", {
      ownerId: userId(() => authUsers.id, { notNull: true }),
    })
    const authForeignKey = getTableConfig(viaAuth).foreignKeys[0]
    const userForeignKey = getTableConfig(viaUserId).foreignKeys[0]

    expect(getTableColumns(viaUserId).ownerId.notNull).toBe(
      getTableColumns(viaAuth).ownerId.notNull
    )
    expect(userForeignKey?.reference().foreignTable).toBe(
      authForeignKey?.reference().foreignTable
    )
    expect(userForeignKey?.onDelete).toBe(authForeignKey?.onDelete)
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
    expect(columns.updatedAt.onUpdateFn).toBeUndefined()
    expect(columns.createdBy.name).toBe("created_by")
    // Nullable by default so a user delete blanks the author, not fails.
    expect(columns.createdBy.notNull).toBe(false)
    expect(columns.createdBy.default).toBeDefined()
    expect(columns.createdBy.onUpdateFn).toBeUndefined()
    expect(columns.updatedBy.name).toBe("updated_by")
    expect(columns.updatedBy.notNull).toBe(false)
    expect(columns.updatedBy.default).toBeDefined()
    expect(columns.updatedBy.onUpdateFn).toBeUndefined()
    expect(config.foreignKeys).toHaveLength(2)
    expect(
      config.foreignKeys.map(
        (foreignKey) => foreignKey.reference().foreignTable
      )
    ).toEqual([authUsers, authUsers])
  })

  it("applies one options object to both author columns", () => {
    const posts = table("posts", {
      ...auditColumns({ notNull: true }),
    })
    const columns = getTableColumns(posts)
    const foreignKeys = getTableConfig(posts).foreignKeys

    expect(columns.createdBy.notNull).toBe(true)
    expect(columns.updatedBy.notNull).toBe(true)
    expect(foreignKeys.map((foreignKey) => foreignKey.onDelete)).toEqual([
      "restrict",
      "restrict",
    ])
    // Timestamps are unaffected by the authorship options.
    expect(columns.createdAt.notNull).toBe(true)
  })

  it("does not add updated_at to an UPDATE Drizzle builds", async () => {
    const posts = table("posts", { title: text(), ...timestamps() })
    const db = createAdminClient()
    const { params, sql: statement } = db
      .update(posts)
      .set({ title: "hello" })
      .toSQL()

    // Drizzle no longer touches the column, so the trigger is the only thing
    // that sets it and every writer gets the same behaviour.
    expect(statement).not.toContain('"updated_at"')
    expect(params).toEqual(["hello"])

    await db.close()
  })

  it("leaves the update side of the audit columns to Postgres", () => {
    const posts = table("posts", { ...auditColumns() })
    const columns = getTableColumns(posts)

    // No Drizzle-side hooks at all: `$onUpdateFn` is applied while Drizzle
    // builds its own statement, so it would miss every PostgREST write. The
    // triggers in @zeno-lib/db/triggers own these columns instead.
    expect(columns.updatedAt.onUpdateFn).toBeUndefined()
    expect(columns.updatedBy.onUpdateFn).toBeUndefined()

    // The insert side stays real SQL, so it covers every writer.
    expect(columns.createdAt.default).toBeDefined()
    expect(columns.updatedAt.default).toBeDefined()
    expect(columns.createdBy.default).toBeDefined()
    expect(columns.updatedBy.default).toBeDefined()
  })

  it("passes timezone and precision through to the column type", () => {
    const naive = table("naive", { ...timestamps({ withTimezone: false }) })
    const precise = table("precise", { ...timestamps({ precision: 3 }) })
    const audited = table("audited", {
      ...auditColumns({ precision: 0, withTimezone: false }),
    })

    expect(getTableColumns(naive).createdAt.getSQLType()).toBe("timestamp")
    expect(getTableColumns(precise).updatedAt.getSQLType()).toBe(
      "timestamp (3) with time zone"
    )
    expect(getTableColumns(audited).createdAt.getSQLType()).toBe(
      "timestamp (0)"
    )
  })

  it("reads timestamps back as strings with mode: string, emitting the same type", () => {
    const dated = getTableColumns(table("dated", { ...timestamps() }))
    const stringly = getTableColumns(
      table("stringly", { ...timestamps({ mode: "string", precision: 6 }) })
    )
    const audited = getTableColumns(
      table("audited", { ...auditColumns({ mode: "string" }) })
    )

    expect(is(dated.createdAt, PgTimestampString)).toBe(false)
    expect(is(stringly.createdAt, PgTimestampString)).toBe(true)
    expect(is(stringly.updatedAt, PgTimestampString)).toBe(true)
    expect(is(audited.createdAt, PgTimestampString)).toBe(true)
    // drizzle spaces the precision differently per mode ("timestamp (6)" vs
    // "timestamp(6)"); Postgres reads both as the same type.
    expect(stringly.createdAt.getSQLType().replace(" (", "(")).toBe(
      "timestamp(6) with time zone"
    )
    expect(stringly.updatedAt.notNull).toBe(true)
    expect(stringly.updatedAt.default).toBeDefined()
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

  it("cases column names in a non-public schema", async () => {
    const billing = schema("billing")
    const invoices = billing.table("invoices", {
      displayName: text(),
      ownerId: uuid(),
    })
    const db = createAdminClient()

    expect(db.select().from(invoices).toSQL().sql).toContain('"display_name"')
    expect(db.select().from(invoices).toSQL().sql).toContain('"owner_id"')
    expect(getTableConfig(invoices).schema).toBe("billing")

    await db.close()
  })

  it("enables RLS on a schema table and leaves unsecureTable alone", () => {
    const billing = schema("billing")

    expect(
      getTableConfig(billing.table("invoices", { ownerId: uuid() })).enableRLS
    ).toBe(true)
    expect(
      getTableConfig(billing.unsecureTable("rates", { ownerId: uuid() }))
        .enableRLS
    ).toBe(false)
  })

  it("stays a drizzle schema so the rest of its builders still work", () => {
    const billing = schema("billing")

    expect(isSchema(billing)).toBe(true)
    expect(billing.schemaName).toBe("billing")
    expect(billing.existing().isExisting).toBe(true)
    expect(isEnum(billing.enum("plan", ["free", "paid"]))).toBe(true)
    expect(isSequence(billing.sequence("invoice_no"))).toBe(true)
  })

  it("presets the authenticated role and leaves the condition to the caller", () => {
    const condition = sql`true`
    const presets = [
      authenticatedSelectPolicy("s", { using: condition }),
      authenticatedInsertPolicy("i", { withCheck: condition }),
      authenticatedUpdatePolicy("u", { using: condition }),
      authenticatedDeletePolicy("d", { using: condition }),
      authenticatedAllPolicy("a", { using: condition }),
    ]

    expect(presets.map((preset) => preset.for)).toEqual([
      "select",
      "insert",
      "update",
      "delete",
      "all",
    ])
    for (const preset of presets) {
      expect(preset.to).toBe(authenticatedRole)
    }
    // No owner check is assumed; the caller's condition is what lands.
    expect(presets[0]?.using).toBe(condition)
    expect(presets[1]?.withCheck).toBe(condition)
  })

  it("delegates each operation to a security definer function", async () => {
    const posts = table("posts", { id: primaryId("uuid") }, (t) =>
      functionPolicies(t, { argument: t.id })
    )
    const policies = getTableConfig(posts).policies
    const db = createAdminClient()

    expect(policies.map((rlsPolicy) => rlsPolicy.name)).toEqual([
      "can_select_posts",
      "can_insert_posts",
      "can_update_posts",
      "can_delete_posts",
    ])
    for (const rlsPolicy of policies) {
      expect(rlsPolicy.to).toBe(authenticatedRole)
    }
    // using for select, update and delete, withCheck for insert. update takes
    // both clauses, but Postgres reuses using for the check, so spelling out a
    // second identical expression would only add a polwithcheck that a
    // hand-written USING-only policy does not have.
    expect(policies[0]?.using).toBeDefined()
    expect(policies[0]?.withCheck).toBeUndefined()
    expect(policies[1]?.using).toBeUndefined()
    expect(policies[1]?.withCheck).toBeDefined()
    expect(policies[2]?.using).toBeDefined()
    expect(policies[2]?.withCheck).toBeUndefined()
    expect(policies[3]?.using).toBeDefined()
    expect(policies[3]?.withCheck).toBeUndefined()

    const dialect = new PgDialect()

    // The shape the issue asks for: the call wrapped in a select, with the
    // column passed through.
    expect(dialect.sqlToQuery(policies[0]?.using as SQL).sql).toBe(
      '(select "can_select_posts"("posts"."id"))'
    )
    expect(dialect.sqlToQuery(policies[2]?.using as SQL).sql).toBe(
      '(select "can_update_posts"("posts"."id"))'
    )

    expect(db.select().from(posts).toSQL().sql).toBeDefined()
    await db.close()
  })

  it("calls the function with no argument when none is given", () => {
    const tags = table("tags", { id: primaryId("uuid") }, (t) =>
      functionPolicies(t)
    )
    const policies = getTableConfig(tags).policies

    expect(policies).toHaveLength(4)
    expect(new PgDialect().sqlToQuery(policies[0]?.using as SQL).sql).toBe(
      '(select "can_select_tags"())'
    )
  })

  it("takes a prefix and a policy name override", () => {
    const posts = table("posts", { id: primaryId("uuid") }, (t) =>
      functionPolicies(t, {
        name: (operation, tableName) => `${tableName}_${operation}`,
        prefix: "may",
      })
    )

    expect(getTableConfig(posts).policies.map((p) => p.name)).toEqual([
      "posts_select",
      "posts_insert",
      "posts_update",
      "posts_delete",
    ])
  })

  it("varies the argument per operation, insert usually taking none", () => {
    const projects = table(
      "projects",
      { id: primaryId("assigned"), ownerId: uuid() },
      (t) => functionPolicies(t, { argument: { delete: t.id, select: t.id } })
    )
    const policies = getTableConfig(projects).policies
    const dialect = new PgDialect()

    // select and delete get the row; insert and update fall to no arguments,
    // insert because a missing key means "called with none" and update because
    // it was left out of the record too.
    expect(dialect.sqlToQuery(policies[0]?.using as SQL).sql).toBe(
      '(select "can_select_projects"("projects"."id"))'
    )
    expect(dialect.sqlToQuery(policies[1]?.withCheck as SQL).sql).toBe(
      '(select "can_insert_projects"())'
    )
    expect(dialect.sqlToQuery(policies[2]?.using as SQL).sql).toBe(
      '(select "can_update_projects"())'
    )
    expect(dialect.sqlToQuery(policies[3]?.using as SQL).sql).toBe(
      '(select "can_delete_projects"("projects"."id"))'
    )
  })

  it("reads an explicit null as a call with no arguments", () => {
    const projects = table("projects", { id: primaryId("assigned") }, (t) =>
      functionPolicies(t, { argument: { insert: null, select: t.id } })
    )
    const policies = getTableConfig(projects).policies

    expect(new PgDialect().sqlToQuery(policies[1]?.withCheck as SQL).sql).toBe(
      '(select "can_insert_projects"())'
    )
  })

  it("passes several columns to a function that takes several", () => {
    const memberships = table(
      "memberships",
      {
        id: primaryId("uuid"),
        organisationId: bigint({ mode: "number" }),
        profileId: uuid(),
      },
      (t) => functionPolicies(t, { argument: [t.profileId, t.organisationId] })
    )
    const policies = getTableConfig(memberships).policies

    expect(new PgDialect().sqlToQuery(policies[0]?.using as SQL).sql).toBe(
      '(select "can_select_memberships"("memberships"."profile_id", "memberships"."organisation_id"))'
    )
  })

  it("qualifies the function with a schema when one is given", () => {
    const billing = schema("billing")
    const invoices = billing.table("invoices", { id: primaryId("uuid") }, (t) =>
      functionPolicies(t, { schema: "billing" })
    )
    const policies = getTableConfig(invoices).policies

    expect(new PgDialect().sqlToQuery(policies[0]?.using as SQL).sql).toBe(
      '(select "billing"."can_select_invoices"())'
    )
  })
})
