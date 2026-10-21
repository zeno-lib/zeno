---
"@zeno-lib/db": minor
---

New column helpers in `@zeno-lib/db/schema`:

- `sequentialId()`: the identity column `sequentialPrimaryId()` builds, without the primary key, for a table keyed on more columns than its id. `sequentialPrimaryId()` is now `sequentialId().primaryKey()`.
- `percentage({ scale, min, max })`: a `numeric` read as a `number`, whose insert and update accept `0` to `1` by default. `scale: "percent"` stores 25 % as `25`, from `0` to `100`, and the bounds are options for a rate that goes negative or a ratio above 100 %.
- `year({ min, max })`: a `smallint`, so a whole number, from `0` to `9999` by default.
- `email()`: a `text` checked as `z.email()` checks it.
