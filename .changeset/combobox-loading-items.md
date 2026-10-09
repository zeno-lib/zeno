---
"@zeno-lib/forms": patch
---

`ComboboxField` no longer shows a stored value as raw text when `items` has
no item for it, such as an id while its options are still loading. With
`{ value, label }` items the input stays empty until the item arrives, then
shows its label. A plain string or number item is still its own label.
