---
"@zeno-lib/forms": patch
---

`zod` is now an optional peer dependency, since the package reads schemas
through Standard Schema and never imports zod. The unused
`@tanstack/react-form-nextjs` dependency is gone, along with the
`decode-formdata` it pulled into every install.
