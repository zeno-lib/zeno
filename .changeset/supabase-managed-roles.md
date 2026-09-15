---
"@zeno-lib/db": minor
---

`defineDrizzleConfig` stops `drizzle-kit push` dropping Supabase's roles, and
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
export default defineDrizzleConfig({ schemaFilter: ["public", "billing"] })
```

Both settings bind `drizzle-kit push` and `drizzle-kit pull` only.
`drizzle-kit generate` diffs your schema files against the previous snapshot
rather than a database, and its config accepts neither `entities` nor
`schemaFilter`, so it never emitted `DROP ROLE` to begin with and still does not
filter by schema.
