---
"@zeno-lib/forms": minor
---

With a Zod `schema`, a form keeps only the values its schema describes, so an
edit form can open with a record as read. Before, a row's extra keys (`id`,
`createdAt`, …) stayed in the form's values, and a `.strict()` schema rejected
them on every submit with "Unrecognized key", so each form needed a mapper that
picked the schema's keys.

- `useForm({ defaultValues })` drops the keys the schema doesn't describe, at
  every depth and in every array row, before the schema's own defaults fill
  the keys left out. A `FormDialog` session opened with
  `open({ defaultValues: row })` goes through the same path.
- `submitAction`'s `reset: true`, or a `reset` function, rebases the form on
  the returned data kept to the form's schema the same way, so a saved row's
  `updatedAt` doesn't fail the next save. `reset: "values"` already had the
  form's shape.
- An object keeps the keys in its shape, an array maps its element over every
  row, and `optional`, `nullable`, `default`, `prefault`, `nonoptional`,
  `readonly` and a pipe's input (a `.transform`) unwrap. Where the schema
  doesn't say which keys belong (a union, a record, a loose or catchall object,
  `any`, `unknown`) or the value doesn't fit it (`null`, a string where an
  object is expected), the value is kept as is. A key the value lacks stays
  absent.
- `onSubmit`'s `value` no longer carries keys outside the schema. Its type
  never had them; code that read one anyway (a row's `id`) should read it from
  the record.

Without a schema, or with a non-Zod one, `defaultValues` are used as they are.
