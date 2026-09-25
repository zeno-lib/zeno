import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { createRlsTestHarness, idsSeen } from "@zeno-lib/test/supabase"
import { defineRelations, eq, inArray, sql } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import {
  createAdminClient,
  createAnonClient,
  createAuthClient,
  createServiceClient,
  createSupabaseClient,
  type SupabaseToken,
} from "../src/index"
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

// Real auth users are created via the GoTrue admin API so `posts.user_id` FKs to
// genuine auth.users rows. IDs are assigned in beforeAll (random), so anything
// that embeds them in a test table must read them through a thunk.
let USER_A: string
let USER_B: string

// Relations enable the relational query API (`db.query.<table>.findMany()`).
const relations = defineRelations(schema)
const adminDb = createAdminClient({ relations })

const clientOptions = {
  auth: { autoRefreshToken: false, persistSession: false },
}

// Creates real users through the Auth admin API (service_role), signs them in
// on a publishable-key client, and exposes `db`: one createAuthClient handle
// bound to that client, so it follows whoever is signed in. `cleanUp()` deletes
// the users, retrying transient Auth errors, and closes the handle.
const harness = createRlsTestHarness({
  admin: createClient(API_URL, SERVICE_ROLE_KEY, clientOptions),
  client: createClient(API_URL, ANON_KEY, clientOptions),
  createDb: (client) => createAuthClient(client, { relations }),
})

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

// Distinct owners visible to a read — RLS is about *which rows* a role sees,
// so we assert on the owning user_ids.
const owners = (read: () => PromiseLike<readonly { userId: string }[]>) =>
  idsSeen(read, (row) => row.userId)

beforeAll(async () => {
  USER_A = (await harness.createUser()).id
  USER_B = (await harness.createUser()).id
  // Seeded via admin so the rows exist regardless of RLS — one post per owner.
  await adminDb.insert(posts).values([
    { title: "A's post", userId: USER_A },
    { title: "B's post", userId: USER_B },
  ])
})

afterAll(async () => {
  // Posts first: `posts.user_id` is not null, so deleting an owner that still
  // has posts fails.
  const userIds = harness.users.map((user) => user.id)
  if (userIds.length > 0) {
    await adminDb.delete(posts).where(inArray(posts.userId, userIds))
  }
  await harness.cleanUp()
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
    expect(await owners(() => makeDb().select().from(posts))).toEqual(
      new Set(visible())
    )
  })
})

// service_role (BYPASSRLS grant) and admin (postgres) ignore policies entirely.
describe("RLS bypass", () => {
  it.each([
    { makeDb: () => createServiceClient({ relations }), name: "service_role" },
    { makeDb: () => adminDb, name: "admin" },
  ])("$name sees every owner's rows", async ({ makeDb }) => {
    const seen = await owners(() => makeDb().select().from(posts))
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
    const { db } = harness
    const user = await harness.createUser()
    await adminDb.insert(posts).values({ title: "e2e post", userId: user.id })

    // Signed out, the same handle is anon: no policy grants it SELECT.
    expect(await owners(() => db.select().from(posts))).toEqual(new Set())

    await harness.signIn(user)
    // Real getClaims() resolves the live session; RLS scopes to this owner.
    expect(await owners(() => db.select().from(posts))).toEqual(
      new Set([user.id])
    )

    // The owner policy still blocks forging another user's row.
    await expect(
      db.insert(posts).values({ title: "forge", userId: USER_A })
    ).rejects.toThrow()

    await harness.signOut()
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

describe("audit triggers", () => {
  // The Drizzle-side `$onUpdateFn` only fires for statements Drizzle builds, so
  // it misses PostgREST, the dashboard and psql. The `moddatetime` trigger from
  // `supabase/migrations/*_posts_updated_at_trigger.sql` covers those, and this
  // asserts it, because a trigger that silently stops firing looks exactly like
  // one that works.
  it("refreshes updated_at for a write Drizzle never sees", async () => {
    // A fixed past value, not the insert's `now()`: the insert and the update
    // can land in the same millisecond, and `updated_at` reads back at
    // millisecond precision, so "later" would be flaky.
    const seededAt = new Date("2000-01-01T00:00:00.000Z")
    const db = createAdminClient()
    const [created] = await db
      .insert(posts)
      .values({ title: "trigger seed", updatedAt: seededAt, userId: USER_A })
      .returning({ id: posts.id, updatedAt: posts.updatedAt })

    if (!created) {
      throw new Error("insert returned no row")
    }

    // Raw SQL, exactly the shape PostgREST issues. `updated_at` is not in the
    // SET list, so only the trigger can move it.
    await db.execute(
      sql`update posts set title = 'changed by raw sql' where id = ${created.id}`
    )
    const [after] = await db
      .select({ updatedAt: posts.updatedAt })
      .from(posts)
      .where(eq(posts.id, created.id))

    expect(after?.updatedAt.getTime()).toBeGreaterThan(
      created.updatedAt.getTime()
    )

    await db.delete(posts).where(eq(posts.id, created.id))
    await db.close()
  })

  it("stamps updated_by with the acting user, not the admin connection", async () => {
    const admin = createAdminClient()
    const [created] = await admin
      .insert(posts)
      .values({ title: "authored", userId: USER_A })
      .returning({ id: posts.id, updatedBy: posts.updatedBy })

    if (!created) {
      throw new Error("insert returned no row")
    }

    // Seeded by the admin client, which has no session, so auth.uid() is null.
    expect(created.updatedBy).toBeNull()

    // User A edits their own row through the RLS client.
    await authClient(USER_A)
      .update(posts)
      .set({ title: "edited by A" })
      .where(eq(posts.id, created.id))

    const [after] = await admin
      .select({ updatedBy: posts.updatedBy })
      .from(posts)
      .where(eq(posts.id, created.id))

    expect(after?.updatedBy).toBe(USER_A)

    await admin.delete(posts).where(eq(posts.id, created.id))
    await admin.close()
  })
})
