import type { SupabaseClient } from "@supabase/supabase-js"
import {
  createAdminClient,
  createAnonClient,
  createAuthClient,
  createServiceClient,
  createSupabaseClient,
  type SupabaseToken,
} from "@zeno-lib/db"
import { defineRelations, inArray, sql } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
// biome-ignore lint/performance/noNamespaceImport: drizzle schema needs every table
import * as schema from "./schema"
import { posts } from "./schema"

// SUPABASE_DATABASE_URL is loaded from .env.test (local Supabase on 54322).
// These tests connect for real, so start the stack with `pnpm dev` first.

const LOCAL_DB_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
// Two distinct owners. `posts.user_id` FKs to auth.users, so these must exist as
// real auth users before any post can reference them (seeded in beforeAll).
const USER_A = "11111111-1111-1111-1111-111111111111"
const USER_B = "22222222-2222-2222-2222-222222222222"

// Relations enable the relational query API (`db.query.<table>.findMany()`).
const relations = defineRelations(schema)
const adminDb = createAdminClient({ relations })

function token(sub: string): SupabaseToken {
  return { role: "authenticated", sub }
}

function createSupabase(claims: Record<string, unknown>): SupabaseClient {
  return {
    auth: {
      getClaims: vi.fn(async () => ({
        data: { claims },
        error: null,
      })),
    },
  } as unknown as SupabaseClient
}

// Request-scoped RLS client whose live session resolves to `sub`.
function authClient(sub: string) {
  return createAuthClient(createSupabase(token(sub)), { relations })
}

// Distinct owners visible in a result set — RLS is about *which rows* a role
// sees, so we assert on the owning user_ids.
function owners(rows: { userId: string }[]) {
  return new Set(rows.map((row) => row.userId))
}

beforeAll(async () => {
  // auth.users rows are the FK targets for posts.user_id. The admin connection
  // (postgres) is the only one that may write the auth schema.
  await adminDb.execute(sql`
    insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
    values
      ('00000000-0000-0000-0000-000000000000', ${USER_A}, 'authenticated', 'authenticated', 'rls-a@example.test', now(), now()),
      ('00000000-0000-0000-0000-000000000000', ${USER_B}, 'authenticated', 'authenticated', 'rls-b@example.test', now(), now())
    on conflict (id) do nothing
  `)
  // Seeded via admin so the rows exist regardless of RLS — one post per owner.
  await adminDb.insert(posts).values([
    { title: "A's post", userId: USER_A },
    { title: "B's post", userId: USER_B },
  ])
})

afterAll(async () => {
  await adminDb.delete(posts).where(inArray(posts.userId, [USER_A, USER_B]))
  await adminDb.execute(
    sql`delete from auth.users where id in (${USER_A}, ${USER_B})`
  )
  await adminDb.close({ timeout: 0 })
})

// The posts_owner_select policy (USING user_id = auth.uid(), TO authenticated)
// is the real contract: each role sees exactly the rows it is entitled to.
describe("RLS select enforcement", () => {
  it.each([
    {
      makeDb: () => authClient(USER_A),
      name: "authenticated user A sees only their own rows",
      visible: [USER_A],
    },
    {
      makeDb: () => authClient(USER_B),
      name: "authenticated user B sees only their own rows",
      visible: [USER_B],
    },
    {
      makeDb: () => createSupabaseClient(token(USER_A), { relations }),
      name: "createSupabaseClient (decoded token) scopes to the token owner",
      visible: [USER_A],
    },
    {
      makeDb: () => createAnonClient({ relations }),
      name: "anon sees nothing (no policy grants it SELECT)",
      visible: [],
    },
    {
      makeDb: () =>
        createAuthClient(
          createSupabase({ role: "service_role", sub: USER_A }),
          {
            relations,
          }
        ),
      name: "a forged service_role token is clamped to anon and sees nothing",
      visible: [],
    },
  ])("$name", async ({ makeDb, visible }) => {
    const rows = await makeDb().select().from(posts)
    expect(owners(rows)).toEqual(new Set(visible))
  })
})

// service_role (BYPASSRLS grant) and admin (postgres) ignore policies entirely.
describe("RLS bypass", () => {
  it.each([
    { makeDb: () => createServiceClient({ relations }), name: "service_role" },
    { makeDb: () => adminDb, name: "admin" },
  ])("$name sees every owner's rows", async ({ makeDb }) => {
    const seen = owners(await makeDb().select().from(posts))
    expect(seen.has(USER_A)).toBe(true)
    expect(seen.has(USER_B)).toBe(true)
  })
})

// posts_owner_insert (WITH CHECK user_id = auth.uid()) — a user may only create
// rows they own.
describe("RLS insert enforcement", () => {
  it("authenticated user can insert a row they own", async () => {
    const inserted = await authClient(USER_A)
      .insert(posts)
      .values({ title: "A owns this", userId: USER_A })
      .returning()

    expect(inserted).toHaveLength(1)
    expect(inserted[0]?.userId).toBe(USER_A)
  })

  it("authenticated user cannot insert a row owned by someone else", async () => {
    await expect(
      authClient(USER_A)
        .insert(posts)
        .values({ title: "A forging B", userId: USER_B })
    ).rejects.toThrow()
  })
})

describe("createAuthClient (claims hardening)", () => {
  it("normalizes request.jwt.claims role to the enforced session role", async () => {
    const db = createAuthClient(
      createSupabase({ role: "service_role", sub: USER_A }),
      { relations }
    )
    const result = await db.execute(
      sql`select current_user as role, current_setting('request.jwt.claims', true) as claims`
    )
    const row = result[0] as { role: string; claims: string }
    // Connection role was downgraded to anon, and the claims a policy would read
    // via auth.jwt() agree with it instead of leaking the rejected service_role.
    expect(row.role).toBe("anon")
    expect((JSON.parse(row.claims) as { role: string }).role).toBe("anon")
  })

  it("scopes role and claims to the transaction (does not leak)", async () => {
    await authClient(USER_A).execute(sql`select 1`)
    // The admin client is never role-switched, and the claim was never set on it
    // (transaction-local context resets at commit).
    const result = await adminDb.execute(
      sql`select current_user as role, current_setting('request.jwt.claims', true) as claims`
    )
    expect(result[0]).toEqual({ claims: null, role: "postgres" })
  })
})

describe("createAdminClient", () => {
  it("accepts an explicit connectionString override", async () => {
    const db = createAdminClient({ connectionString: LOCAL_DB_URL })
    const result = await db.execute(sql`select 1 as ok`)

    expect(result[0]).toEqual({ ok: 1 })

    await db.close({ timeout: 0 })
  })
})

describe("db.transaction (multi-statement)", () => {
  it("runs several statements under one role-switched transaction", async () => {
    const result = await authClient(USER_A).transaction(async (tx) => {
      const role = await tx.execute(sql`select current_user as role`)
      const uid = await tx.execute(sql`select auth.uid() as uid`)
      return { role: role[0], uid: uid[0] }
    })

    // Both statements observed the same authenticated, sub-bearing context.
    expect(result.role).toEqual({ role: "authenticated" })
    expect(result.uid).toEqual({ uid: USER_A })
  })
})
