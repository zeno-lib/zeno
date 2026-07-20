# @zeno-lib/web

The first product surface built on the Zeno packages (`@zeno-lib/db`,
`@zeno-lib/schema`, `@zeno-lib/supabase`, `@zeno-lib/ui`).

## Development

```sh
pnpm --filter @zeno-lib/web dev
```

Runs on port 5003. Requires a local Supabase stack and a `.env` with
`SUPABASE_DATABASE_URL` and the `NEXT_PUBLIC_SUPABASE_*` keys.
