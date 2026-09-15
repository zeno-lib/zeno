---
"@zeno-lib/db": minor
---

Policy helpers for the schemas the owner helpers do not fit.

The five `authenticatedOwner*Policy` helpers assume `owner_column = auth.uid()`.
That holds for a single-table demo and stops holding as soon as access depends
on anything but the row's own owner column, at which point every policy was
written out by hand and every one repeated `to: authenticatedRole`.

`authenticatedSelectPolicy(name, config?)`, and the same for insert, update,
delete and all, preset the role and leave the condition to you:

```ts
authenticatedSelectPolicy("posts_read", { using: sql`is_published(posts.id)` })
```

`functionPolicies(columns, options?)` writes all four operations at once, each
delegating to a `security definer` function, which is the usual answer for
access that a single column cannot express and the standard advice for keeping
RLS predicates out of the planner's way:

```ts
export const posts = table("posts", { id: primaryId("uuid") }, (t) =>
  functionPolicies(t, { argument: t.id })
)
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
