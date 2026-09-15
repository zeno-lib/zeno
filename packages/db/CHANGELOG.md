# @zeno-lib/db

## 0.2.0

### Minor Changes

- 6ab02b3: Breaking: the audit column helpers in `@zeno-lib/db/schema` are functions now,
  so add `()` at every use site: `...timestamps()`, `...authorship()`,
  `...auditColumns()`, `createdBy: createdBy()`, `updatedBy: updatedBy()`.

  They used to be plain objects, which meant every table that spread one shared a
  single Drizzle column builder. Drizzle's builder methods mutate the builder and
  return it, so one table calling `.unique()` or `.references()` on a spread
  column changed that column on every other table too. Each call now returns
  fresh builders.

- f597928: `schema(name)` from `@zeno-lib/db/schema` applies snake_case casing and enables
  RLS, so a second schema behaves like the top-level `table` / `unsecureTable`
  pair instead of like drizzle's bare `pgSchema`.

  It used to be a straight re-export of `pgSchema`. The public `pgSchema(name)`
  overload takes no casing argument, so every column in a second schema was named
  after its TypeScript key while `table` in the same package cased them, and the
  result depended on which factory built the table. Its `.table` also left RLS
  off, which is the mistake `table` exists to prevent.

  ```ts
  const billing = schema("billing");

  billing.table("invoices", { ownerId: uuid() }); // "owner_id", RLS on
  billing.unsecureTable("rates", { ownerId: uuid() }); // "owner_id", RLS off
  ```

  Two things change for an existing call site. Column names in a second schema
  become snake_case, so a table that relied on the verbatim key now generates a
  rename; import `pgSchema` from `drizzle-orm/pg-core` directly to keep it. And
  `schema(...).table` now emits `ENABLE ROW LEVEL SECURITY`; use `.unsecureTable`
  for a table that intentionally has none.

  Everything else on the schema is untouched: `existing()`, `enum()`, `sequence()`,
  `view()` and `materializedView()` behave exactly as drizzle's do, and `isSchema`
  still recognises the result.

- 8cbdc7a: `auth.users` ships in full, from a new `@zeno-lib/db/auth` entrypoint.

  ```ts
  import { authUsers } from "@zeno-lib/db/auth";
  ```

  `drizzle-orm/supabase` exports 8 of the table's 35 columns, so putting `auth` in
  `schemaFilter` made drizzle-kit want to drop the other 27, and every consumer
  needing a foreign key into `auth.users` hand-wrote all 35 and got it wrong in a
  different way. This one is generated with `drizzle-kit pull` and pinned in a
  header comment to Supabase CLI 2.84.1, Postgres 17.6.1.095, GoTrue v2.188.1 and
  `auth.schema_migrations` 20260302000000. A test asserts the column count, so a
  Supabase bump that changes the shape fails loudly instead of drifting.

  **`authUsers` is no longer exported from `@zeno-lib/db/schema`.** Import it from
  `@zeno-lib/db/auth` instead. The other `drizzle-orm/supabase` re-exports
  (`anonRole`, `authenticatedRole`, `authUid`, `realtimeMessages` and the rest) are
  unchanged, and `authUserId()` still references the table for you, so most
  schemas need no import at all.

  The split is not tidiness. `drizzle-kit generate` applies no entity filter: it
  passes `() => true`, and its config schema accepts neither `schemaFilter` nor
  `entities`. Generating against `pgSchema("auth").existing()` with
  `schemaFilter: ["public"]` set still emits `CREATE TABLE "auth"."users"`. The
  only thing that keeps a Supabase-owned table out of your migration is it never
  reaching the files your `schema` glob reads, so it cannot live in the module you
  re-export from your schema barrel. Referencing it from a column stays safe: a
  table reached only through a `references()` thunk is never collected.

  The nine `auth` enums are not shipped. `auth.users` uses none of them (they
  belong to the `mfa_*`, `oauth_*` and `sso_*` tables), and drizzle-kit maps enums
  with no filter and no `existing` equivalent, so an exported one would be
  `CREATE TYPE` in every command.

  Several columns hold credential material (`encryptedPassword`, the `*Token`
  columns). Select the columns you need rather than `select()`.

- 8686804: Author columns are nullable and configurable, so deleting a Supabase user no
  longer fails, and they can reference something other than `auth.users`.

  `authUserId`, `createdBy`, `updatedBy`, `authorship` and `auditColumns` take
  three options, and a new `userId(reference, options?)` points an author column
  at a table of your own:

  | Option      | Default                                         | What it changes                                       |
  | ----------- | ----------------------------------------------- | ----------------------------------------------------- |
  | `reference` | `() => authUsers.id`                            | The foreign key target, or `null` for no foreign key. |
  | `actions`   | `{ onDelete: "set null", onUpdate: "cascade" }` | `onDelete` and `onUpdate` for that foreign key.       |
  | `notNull`   | `false`                                         | Whether the column is required.                       |

  Three things were wrong before. The target was fixed at `auth.users`, which RLS
  policies and PostgREST joins cannot read, so applications mirror it into a
  public `profiles` table and there was no way to say so. `notNull` plus that
  reference meant deleting a user failed, because the audit trail held the row,
  which is the opposite of what an audit trail wants. And there was no way to pass
  `onDelete` or `onUpdate` at all.

  Two changes need action at existing call sites:

  - **`authUserId(name)` takes options now**, so `authUserId("owner_id")` becomes
    `authUserId({ name: "owner_id" })`. Every other configurable helper in this
    package already takes an options object.
  - **Author columns are nullable**, so the next `drizzle-kit generate` emits an
    `ALTER TABLE` dropping `NOT NULL` and adding
    `ON DELETE SET NULL ON UPDATE CASCADE`. Pass `{ notNull: true }` to keep the
    old shape.

  An **ownership** column that an RLS policy keys on should take
  `{ notNull: true }`. `authUserOwns` builds `owner_column = auth.uid()`, which is
  `NULL` rather than `true` for a null owner, so the row would be invisible and
  could not be inserted. Nullable is right for an audit trail and wrong for
  ownership.

  When `notNull` is `true` the default actions become
  `{ onDelete: "restrict", onUpdate: "cascade" }`: `SET NULL` against a `NOT NULL`
  column is a foreign key that can never fire, so it would turn a failed user
  delete into a more confusing one.

  `createdBy` and `updatedBy` keep their `auth.uid()` default. `auth.uid()` is
  already `NULL` without a session, so an admin or `service_role` write records
  `NULL` either way; what changes is that it no longer fails loudly. Reach for
  `{ notNull: true }` when a row must always have an author.

- c5e2edc: Policy helpers for the schemas the owner helpers do not fit.

  The five `authenticatedOwner*Policy` helpers assume `owner_column = auth.uid()`.
  That holds for a single-table demo and stops holding as soon as access depends
  on anything but the row's own owner column, at which point every policy was
  written out by hand and every one repeated `to: authenticatedRole`.

  `authenticatedSelectPolicy(name, config?)`, and the same for insert, update,
  delete and all, preset the role and leave the condition to you:

  ```ts
  authenticatedSelectPolicy("posts_read", {
    using: sql`is_published(posts.id)`,
  });
  ```

  `functionPolicies(columns, options?)` writes all four operations at once, each
  delegating to a `security definer` function, which is the usual answer for
  access that a single column cannot express and the standard advice for keeping
  RLS predicates out of the planner's way:

  ```ts
  export const posts = table("posts", { id: primaryId("uuid") }, (t) =>
    functionPolicies(t, { argument: t.id })
  );
  ```

  ```sql
  CREATE POLICY "can_select_posts" ON "posts" AS PERMISSIVE FOR SELECT
    TO "authenticated" USING ((select "can_select_posts"("posts"."id")));
  -- insert gets WITH CHECK, update gets both, delete gets USING
  ```

  It puts the condition in the clause each operation takes, and wraps the call in
  a `select` so Postgres evaluates it once per statement rather than once per row.
  `argument` is optional, since some such functions take none; `prefix` (default
  `"can"`) and `name` control the generated names. It takes the columns object the
  extra callback gives you rather than the table, because naming a table inside
  its own definition makes its type circular; the table name comes from the
  columns, so it stays right through a rename. You write the functions; this
  writes the policies that call them.

  Nothing is removed. The existing generic and owner helpers are unchanged.

- a024581: `defineDrizzleConfig` stops `drizzle-kit push` dropping Supabase's roles, and
  stops it diffing the `auth` schema.

  `entities.roles.provider: "supabase"` excludes eight role names. A stock
  Supabase project has 26, so drizzle-kit managed the other 18 (`pg_monitor`,
  `pgbouncer`, `postgres`, `supabase_replication_admin` and the rest): it found
  them in the database, could not see them declared, and offered a `DROP ROLE` for
  each. The workaround was a generated `roles.ts` nobody reads, or a
  hand-maintained exclude list that rots as Supabase adds roles. The preset now
  adds them to `entities.roles.exclude`, keeping any excludes of your own, and
  exports the list as `supabaseManagedRoles`.

  `schemaFilter` now defaults to `["public"]`. Without it, `push` and `pull` diff
  `auth`, `storage` and `realtime`, which Supabase owns and changes on upgrades.
  If you have your own non-`public` schema, list it rather than dropping the
  filter:

  ```ts
  export default defineDrizzleConfig({ schemaFilter: ["public", "billing"] });
  ```

  Both settings bind `drizzle-kit push` and `drizzle-kit pull` only.
  `drizzle-kit generate` diffs your schema files against the previous snapshot
  rather than a database, and its config accepts neither `entities` nor
  `schemaFilter`, so it never emitted `DROP ROLE` to begin with and still does not
  filter by schema.

- 7fcc99f: Match the primary key helpers to the tables Supabase creates

  `primaryId(kind)` takes `"sequential"`, `"uuid"` or `"assigned"`, and each kind
  emits the column Supabase itself creates for that choice. It defaults to
  `"sequential"`, the id the table editor gives a new table. When the kind alone
  isn't enough, call `sequentialPrimaryId()`, `uuidPrimaryId()` or
  `assignedPrimaryId()` and pass options.

  Two existing calls now emit different SQL, and both still compile, so nothing
  will warn you:

  | Call                      | Was                                          | Now                                       |
  | ------------------------- | -------------------------------------------- | ----------------------------------------- |
  | `primaryId()`             | `uuid PRIMARY KEY DEFAULT gen_random_uuid()` | `bigint GENERATED BY DEFAULT AS IDENTITY` |
  | `primaryId("sequential")` | `integer GENERATED ALWAYS AS IDENTITY`       | `bigint GENERATED BY DEFAULT AS IDENTITY` |

  The old `"sequential"` matched no table the Supabase dashboard creates.
  `integer` caps at 2.1 billion rows, and `generated always` rejects the
  client-supplied ids that seeds and upserts need. The bare call used to give you
  a UUID key, where the dashboard's own default is an identity column.

  If you have a column from either, the next `drizzle-kit generate` will emit an
  `ALTER TABLE` that changes its type, so check your call sites first. To keep
  what you have, write `uuidPrimaryId()` for the bare call and
  `sequentialPrimaryId({ type: "integer", generated: "always" })` for the other.

  `uuidPrimaryId({ defaultRandom: false })` is also new. It skips the
  `gen_random_uuid()` default, for a table mirroring `auth.users` whose id comes
  from the referenced row. The column becomes required on insert.

- ac9d791: The update-side audit columns are owned by Postgres triggers now, and the
  Drizzle-side hooks are gone.

  `timestamps()` set `updatedAt.$onUpdate(...)` and `updatedBy()` set
  `$onUpdate(() => authUid)`. Both are applied while Drizzle builds its own
  statement, so a write arriving through PostgREST (the `supabase-js` client, the
  dashboard, any REST caller) never ran them, and in a Supabase app that is most
  writes. The columns were right only when you happened to write through Drizzle,
  which is worse than a column you know needs a trigger. Both hooks are removed,
  and `timestamps()` loses its `onUpdate` option with them.

  A new `@zeno-lib/db/triggers` entrypoint returns the SQL that puts the columns
  in Postgres's hands, where every writer reaches them:

  ```ts
  import { auditTriggers } from "@zeno-lib/db/triggers";

  console.log(auditTriggers(posts));
  ```

  Drizzle Kit emits no trigger DDL, so the route is
  `drizzle-kit generate --custom`, which writes an empty migration that is still
  tracked: its snapshot links into the chain, so `drizzle-kit migrate` applies and
  records it. **This is now a required step for any table using `timestamps()`,
  `authorship()` or `auditColumns()`.** Without it, `updated_at` and `updated_by`
  keep their insert values forever.

  `auditTriggers` covers both columns; `updatedAtTrigger` and `updatedByTrigger`
  cover one each. All three read the table's real name and schema, accept a plain
  table name, take `column` / `name` / `schema` overrides, and emit re-runnable
  SQL.

  **Bug fix in the same area:** `createdBy()` and `updatedBy()` defaulted to
  `authUid`, which is `(select auth.uid())`. Postgres rejects a subquery in a
  column `DEFAULT` with "cannot use subquery in DEFAULT expression", so any
  migration containing those columns failed to apply. They default to a bare
  `` sql`auth.uid()` `` now, which is legal and resolves the same claim.

  `timestamps()` also takes `withTimezone` (default `true`) and `precision` (0 to
  6), forwarded by `auditColumns()`.

## 0.1.0

### Minor Changes

- 0cc1ea8: Add `@zeno-lib/db`: Drizzle ORM wrapper for Supabase Postgres. Owns schema, migrations, RLS roles & policies, and typed queries; coexists with `@zeno-lib/supabase` which keeps owning Auth, Storage, and SSR client wiring.

  Public surface:

  - `@zeno-lib/db` — five client factories. Each takes an optional Drizzle config (`{ relations?, logger?, casing? }`) plus an optional `connectionString` that defaults to `SUPABASE_DATABASE_URL` (throwing `"Missing SUPABASE_DATABASE_URL environment variable"` if neither resolves). All clients are queried directly — `await db.select().from(t)`, `await db.query.t.findMany()`, `db.transaction(cb)`, `db.close()`:
    - `createAdminClient(config?)` bypasses RLS (webhooks, admin tasks, background jobs, seeding), running as the connection `postgres` role; no Supabase client needed.
    - `createAuthClient(supabase, config?)` is RLS-scoped to a Supabase client: verified claims are resolved via `supabase.auth.getClaims()` on every query, so it always reflects the live session.
    - `createSupabaseClient(accessToken, config?)` is RLS-scoped to an already-verified, decoded token (`SupabaseToken` — the `role` + `sub` claims).
    - `createAnonClient(config?)` runs every query as `anon`.
    - `createServiceClient(config?)` runs every query as `service_role` (BYPASSRLS) — the only path to `service_role`. User tokens (`createAuthClient` / `createSupabaseClient`) clamp the role to `anon | authenticated`, so a forged `service_role` claim is downgraded to `anon`.
    - Each awaited single statement is recorded and replayed inside its own RLS transaction (claims set via transaction-local `set_config(..., true)`, role via `set local role`); `db.transaction(cb)` runs several statements under one atomic RLS transaction. `relations` (from `defineRelations`) enables the relational query API. Pools are cached per `(kind, connectionString)` and reference-counted by `close()`.
  - `@zeno-lib/db/config` — `defineDrizzleConfig({ schema, ...overrides })` preset for `drizzle.config.ts`. Defaults `out: "./supabase/migrations"`, dialect `postgresql`, reads `SUPABASE_DATABASE_URL`, and sets `entities.roles.provider: "supabase"` so Supabase built-in roles aren't touched.
  - `@zeno-lib/db/schema` — re-exports of `anonRole`, `authenticatedRole`, `serviceRole`, `postgresRole`, `supabaseAuthAdminRole`, `authUsers`, `authUid`, `realtimeMessages`, `realtimeTopic` from `drizzle-orm/supabase`, plus a `timestamps` mixin.

  Peer deps: `drizzle-orm 1.0.0-rc.3`, `drizzle-kit 1.0.0-rc.3`, `postgres >=3.4`.
  Consumers import Drizzle, Drizzle Kit, and `postgres-js` APIs directly from
  those packages.

- 2215066: Add `@zeno-lib/schema`, a pure Drizzle table to Zod helper package. It peers on
  `drizzle-orm@1.0.0-rc.3` and `zod>=4`, exports
  `defineTableSchema(table, options?)`, returning `select`, `insert`, and
  `update` Zod schemas, and re-exports Drizzle ORM's first-party Zod helpers.

  Upgrade `@zeno-lib/db` to expect `drizzle-orm@1.0.0-rc.3` and
  `drizzle-kit@1.0.0-rc.3` as peer dependencies, matching Drizzle's v1 schema and
  Zod documentation.
