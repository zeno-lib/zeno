---
"@zeno-lib/forms": patch
---

`EmailField` turns off auto-capitalisation, autocorrect and spell check, each
overridable. `NumberField` sets `inputMode="decimal"` instead of `"numeric"`,
so phone keypads keep the decimal key, and takes an `inputMode` override
(`"numeric"` for whole numbers).
