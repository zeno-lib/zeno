---
"@zeno-lib/forms": minor
---

A `withForm` section's `form` and a `withFieldGroup`'s `group` carry the
typed fields, as `useForm`'s form does, so every form writes a field the same
way:

```tsx
const AddressFields = withFieldGroup({
  defaultValues: { city: "", street: "" },
  render: ({ group }) => (
    <>
      <group.InputField label="Street" name="street" />
      <group.InputField label="City" name="city" />
    </>
  ),
})
```

- A group's fields are named relative to the group and typed by its own
  values, so `name` takes `"street"`, never the form's `"billing.street"`.
  Before, each field needed `<group.AppField name="street">{(field) =>
  <field.InputField />}</group.AppField>`.
- A section needs no `useAppFields(form)` any more. `useAppFields` stays for a
  form typed some other way.
- A form from `useAppForm`, which has no named fields, gets them when a
  section renders it. A form from `useForm` keeps its own, so its fields never
  change component.
- A group passed on as another group's `form` still infers its values.
