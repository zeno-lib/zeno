---
"@zeno-lib/forms": patch
---

`ComboboxField` and `DatePickerField` take `disabled`. The combobox disables
its input and buttons, and the date picker its trigger. Neither had a way to
be disabled before; the date picker's `calendarProps.disabled` only disables
days.
