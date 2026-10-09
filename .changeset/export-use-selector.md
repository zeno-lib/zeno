---
"@zeno-lib/forms": minor
---

Export TanStack's `useSelector` from `@zeno-lib/forms`, so a component can read
form state in a hook, for example
`useSelector(form.store, (state) => state.values.country)`, without depending
on `@tanstack/react-form` itself. The registry `create-form` re-exports it.
