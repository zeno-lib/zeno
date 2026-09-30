---
"@zeno-lib/forms": minor
---

Add `MoneyField`, `PercentageField`, `YearField`, `MultiSelectField` and `CheckboxGroupField` to the `create-form` registry field kit. Money, percentage and year inputs share a new headless, locale-aware number engine on npm (`@zeno-lib/forms/lib/use-formatted-number` and `@zeno-lib/forms/lib/formatted-number`): thousands separators re-inserted while typing with a stable caret, lenient parsing of pasted text, `number | null` values, and clamping on blur. `PercentageField` takes `scale="percent"` (default, `0–100`) or `scale="fraction"` (`0–1`). Bumps `@tanstack/react-form` to 1.33.5.
