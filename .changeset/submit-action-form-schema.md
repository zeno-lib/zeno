---
"@zeno-lib/forms": minor
---

`submitAction` parses the values with the form's own `schema`, so a form that
submits to a server action no longer passes its schema twice:

```tsx
const form = useForm({
  defaultValues,
  onSubmit: (submit) => submitAction(submit, saveAction, { reset: true }),
  schema,
})
```

The action gets the schema's output (trimmed strings, coerced numbers) where it
used to get the raw values whenever the call left `schema` out. A `schema`
passed to `submitAction` still replaces the form's, for an action that takes a
different schema. A form with no `schema` (`useForm` without one, or
`useAppForm`) still sends its values as they are.
