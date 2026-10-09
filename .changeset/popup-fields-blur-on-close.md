---
"@zeno-lib/forms": patch
---

`SelectField` and `DatePickerField` mark the field touched when their popup
closes, not when it opens. Opening moved focus into the popup, and the
trigger's blur showed a required field's error while the user was still
choosing. Leaving the closed trigger still counts, as before.
