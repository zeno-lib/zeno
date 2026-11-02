// The `@zeno-lib/db/auth` entry. `auth-schema.ts` is generated, so hand-written
// code lives here.
import { sql } from "drizzle-orm"
import { authUsers } from "./auth-schema.ts"
import type { SessionRevocationContext } from "./clients.ts"

// biome-ignore lint/performance/noBarrelFile: the entry re-exports the generated schema, which can't hold hand-written code.
export { authSchema, authUsers } from "./auth-schema.ts"

const UUID_PUNCTUATION = /[{}-]/gu
const UUID_DIGITS = /^[\da-f]{32}$/u

// Postgres reads a uuid with or without braces and hyphens, so a `sub` is
// normalised first, or an odd spelling of a banned id would pass.
const toUuid = (sub: string) => {
  const hex = sub.replace(UUID_PUNCTUATION, "").toLowerCase()
  return UUID_DIGITS.test(hex) ? hex : undefined
}

/**
 * A `sessionRevocation` that refuses what Supabase Auth refuses: a banned user
 * (`user_banned`) and a deleted one (`user_not_found`). A `sub` that isn't a
 * uuid passes.
 */
export const authUserRevocation = ({ sub }: SessionRevocationContext) => {
  const id = toUuid(sub)
  return id
    ? sql<
        string | null
      >`(select case when ${authUsers.id} is null then 'user_not_found' when ${authUsers.bannedUntil} > now() then 'user_banned' end from (select ${id}::uuid as id) as token left join ${authUsers} on ${authUsers.id} = token.id and ${authUsers.deletedAt} is null)`
    : sql<string | null>`null`
}
