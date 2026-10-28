---
"@zeno-lib/forms": minor
---

`PercentageField` with no column to bound it now clamps to 0 and 100 % of its `scale` (`0`–`1` with `scale="fraction"`, `0`–`100` otherwise), the bounds a `percentage()` column has by default. It used to take any value above that, so `150` typed into a fraction field stored `1.5`. Pass `max` for a ratio that can exceed 100 %, or a `min` below 0 for a rate that can go negative. A field bound to a `percentage()` column is unchanged.

Re-add the `create-form` item with the shadcn CLI, or carry the change into your own `percentage-field.tsx`.
