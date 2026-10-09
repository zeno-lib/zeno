---
"@zeno-lib/forms": minor
---

`RadioGroupField` stores each item's `value` as is. It converted every value
with `String()`, so `value={true}` or `value={2}` came back as `"true"` or
`"2"`. String items are unchanged. With nothing picked, Base UI now gets
`null` instead of `""`, so an item whose value is `""` no longer shows as
picked.
