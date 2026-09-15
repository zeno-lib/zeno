---
"@zeno-lib/db": minor
---

Author columns are nullable and configurable, so deleting a Supabase user no
longer fails, and they can reference something other than `auth.users`.

`authUserId`, `createdBy`, `updatedBy`, `authorship` and `auditColumns` take
three options, and a new `userId(reference, options?)` points an author column
at a table of your own:

| Option | Default | What it changes |
|---|---|---|
| `reference` | `() => authUsers.id` | The foreign key target, or `null` for no foreign key. |
| `actions` | `{ onDelete: "set null", onUpdate: "cascade" }` | `onDelete` and `onUpdate` for that foreign key. |
| `notNull` | `false` | Whether the column is required. |

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
