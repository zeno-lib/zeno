import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import {
  createAdminClient,
  createAnonClient,
  createAuthClient,
  createServiceClient,
  createSupabaseClient,
  type SupabaseToken,
} from "@zeno-lib/db"
import { defineRelations, eq, inArray, sql } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
// biome-ignore lint/performance/noNamespaceImport: drizzle schema needs every table
import * as schema from "./schema"
import { posts } from "./schema"

// SUPABASE_DATABASE_URL is loaded from .env.test (local Supabase on 54322).
// These tests connect for real, so start the stack with `pnpm dev` first.
const LOCAL_DB_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"

// Local Supabase Auth (GoTrue). The keys are the public, universal local-dev
// demo keys printed by `supabase start` (issuer "supabase-demo") — not secrets.
const API_URL = "http://127.0.0.1:54321"
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"
const PASSWORD = "rls-integration-pw"

// Real auth users are created via the GoTrue admin API so `posts.user_id` FKs to
// genuine auth.users rows. IDs are assigned in beforeAll (random), so anything
// that embeds them in a test table must read them through a thunk.
let USER_A: string
let USER_B: string

// Relations enable the relational query API (`db.query.<table>.findMany()`).
const relations = defineRelations(schema)
const adminDb = createAdminClient({ relations })

// service_role client over the Auth admin API (creates/deletes real users).
const supabaseAdmin = createClient(API_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function createAuthUser(email: string): Promise<string> {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    email_confirm: true,
    password: PASSWORD,
  })
  if (error) {
    throw error
  }
  return data.user.id
}

function token(sub: string): SupabaseToken {
  return { role: "authenticated", sub }
}

// Fakes only the dependency boundary: `getClaims()` is Supabase Auth's job, not
// this package's. Used to drive the claim-clamping matrix — including forged
// claims a real signed-in session can never produce. The real getClaims() chain
// is covered by the "real Supabase session" suite below.
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
  USER_A = await createAuthUser("rls-a@example.test")
  USER_B = await createAuthUser("rls-b@example.test")
  // Seeded via admin so the rows exist regardless of RLS — one post per owner.
  await adminDb.insert(posts).values([
    { title: "A's post", userId: USER_A },
    { title: "B's post", userId: USER_B },
  ])
})

afterAll(async () => {
  await adminDb.delete(posts).where(inArray(posts.userId, [USER_A, USER_B]))
  await supabaseAdmin.auth.admin.deleteUser(USER_A)
  await supabaseAdmin.auth.admin.deleteUser(USER_B)
  await adminDb.close()
})

// The posts_owner_select policy (USING user_id = auth.uid(), TO authenticated)
// is the real contract: each role sees exactly the rows it is entitled to.
describe("RLS select enforcement", () => {
  it.each([
    {
      makeDb: () => authClient(USER_A),
      name: "authenticated user A sees only their own rows",
      visible: () => [USER_A],
    },
    {
      makeDb: () => authClient(USER_B),
      name: "authenticated user B sees only their own rows",
      visible: () => [USER_B],
    },
    {
      makeDb: () => createSupabaseClient(token(USER_A), { relations }),
      name: "createSupabaseClient (decoded token) scopes to the token owner",
      visible: () => [USER_A],
    },
    {
      makeDb: () => createAnonClient({ relations }),
      name: "anon sees nothing (no policy grants it SELECT)",
      visible: () => [],
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
      visible: () => [],
    },
  ])("$name", async ({ makeDb, visible }) => {
    const rows = await makeDb().select().from(posts)
    expect(owners(rows)).toEqual(new Set(visible()))
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

// End-to-end: a real GoTrue session (sign-in → real getClaims()) must scope RLS
// to the signed-in user. This is the only path that exercises the actual claims
// shape getClaims() returns, which the mocked matrix above cannot.
describe("createAuthClient (real Supabase session)", () => {
  it("scopes RLS to the signed-in user via real getClaims()", async () => {
    const email = "rls-e2e@example.test"
    const userId = await createAuthUser(email)
    try {
      await adminDb.insert(posts).values({ title: "e2e post", userId })

      const supabase = createClient(API_URL, ANON_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: PASSWORD,
      })
      expect(error).toBeNull()

      const db = createAuthClient(supabase, { relations })
      // Real getClaims() resolves the live session; RLS scopes to this owner.
      expect(owners(await db.select().from(posts))).toEqual(new Set([userId]))

      // The owner policy still blocks forging another user's row.
      await expect(
        db.insert(posts).values({ title: "forge", userId: USER_A })
      ).rejects.toThrow()
    } finally {
      await adminDb.delete(posts).where(eq(posts.userId, userId))
      await supabaseAdmin.auth.admin.deleteUser(userId)
    }
  })
})

describe("createAdminClient", () => {
  it("accepts an explicit connectionString override", async () => {
    const db = createAdminClient({ connectionString: LOCAL_DB_URL })
    const result = await db.execute(sql`select 1 as ok`)

    expect(result[0]).toEqual({ ok: 1 })

    await db.close()
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
