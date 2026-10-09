---
"@zeno-lib/forms": patch
---

The registry fields now take their control, description and error ids from
`useId()` instead of the field name. Two forms on one page with the same field
name, such as a page form and a dialog form, used to render duplicate ids, so
the dialog's label focused the page's control and its textbox lost its
accessible name. `useFormDialog().open({ focus })` now finds the control through
the field's label. Re-add the fields with the shadcn CLI to pick this up.
