---
"@zeno-lib/db": minor
---

`functionPolicies` takes a per-operation argument, a qualified function name,
and stops spelling out a redundant `WITH CHECK`.

`argument` was a single `AnyPgColumn` passed to all four functions, so a schema
whose functions do not share one signature could not use the helper at all. The
common shape is that the row-scoped operations take the row and `insert` takes
nothing, there being no row yet to authorise, only the caller:

```
can_select_deals(id character varying)
can_update_deals(id character varying)
can_delete_deals(id character varying)
can_insert_deals()
```

`argument: t.id` emitted `can_insert_deals(deals.id)`, which does not exist;
omitting it dropped the argument from the other three. It now takes a record as
well, and an array for a function that takes several columns:

```ts
functionPolicies(t, { argument: { delete: t.id, select: t.id, update: t.id } })
functionPolicies(t, { argument: [t.profileId, t.organisationId] })
```

An operation missing from the record, or set to `null`, is called with no
arguments. A bare column still applies to all four, so existing calls are
unchanged.

`schema` qualifies the function name. It was emitted bare, so it had to be
reachable through whatever `search_path` was in effect when the `CREATE POLICY`
ran, which left out every helper living in its table's own schema:

```ts
const bexio = schema("bexio")

export const bills = bexio.table("bills", { id: primaryId("uuid") }, (t) =>
  functionPolicies(t, { schema: "bexio" })
)
```

```sql
CREATE POLICY "can_select_bills" ON "bexio"."bills" AS PERMISSIVE FOR SELECT
  TO "authenticated" USING ((select "bexio"."can_select_bills"()));
```

The default stays unqualified.

The `update` policy is now `USING`-only. It carried the same expression in both
`USING` and `WITH CHECK`, and Postgres reuses `USING` for the check when
`WITH CHECK` is omitted, so the two spellings reject the same statement. The
copy was visible in `pg_policy`, which matters when the schema being described
already exists: `drizzle-kit pull` against a database whose update policies were
written `USING`-only produces `USING`-only Drizzle, and switching those tables
to `functionPolicies` then added a `polwithcheck` the database did not have.

This changes the SQL generated for existing `functionPolicies` update policies,
so the next `drizzle-kit generate` will propose dropping that `WITH CHECK`.
