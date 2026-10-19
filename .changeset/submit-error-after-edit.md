---
"@zeno-lib/forms": patch
---

A submit that throws now shows its `FormError` message even when the user
edited the form while it ran. Before, `useForm` dropped the failure as stale,
so the submit button came back with no message, as after a success, though
nothing was saved. A reset or a newer submit while it runs still drops it,
now also when a later submit brings the attempt count back to the same number.
