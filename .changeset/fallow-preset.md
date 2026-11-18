---
"@zeno-lib/fallow": minor
---

New package: `@zeno-lib/fallow` is the [fallow](https://fallow.tools) preset for a Next.js, Supabase and Drizzle monorepo. Extend it in `.fallowrc.jsonc` with `"extends": "npm:@zeno-lib/fallow"`. It needs fallow 3.43.1 or later.

- It credits what fallow misses: next-intl's `i18n/request.ts` default export, the `image-loader.ts` of the `@zeno-lib/supabase` Storage loader, Vitest type tests (`*.test-d.ts`), and the `postcss-load-config` type in the PostCSS config of `create-next-app`.
- It raises the Next.js, cycle, dependency and suppression rules to `error`, and turns CRAP findings off until CI writes a coverage report.
- It sets no array that an app writes, because fallow replaces the preset's array with the app's. Its credits are plugins in `framework`, so an app never sets `framework` and writes its own plugins in `.fallow/plugins/`.
