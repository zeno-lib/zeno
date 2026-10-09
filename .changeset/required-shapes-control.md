---
"@zeno-lib/forms": minor
---

A field's required-ness now shapes its control, not only its label. A required
control gets `aria-required` (the `*` is `aria-hidden`), a required
`ComboboxField` hides its clear button (an explicit `showClear` still wins),
and a required `DatePickerField` keeps its date when the selected day is
picked again. Required-ness comes from the schema even under
`requiredIndicator: false`, which now hides only the `*`, and the field's
`required` prop overrides it. Custom fields read it with the new
`useIsFieldRequiredBySchema`. Re-add the fields with the shadcn CLI to pick
this up.
