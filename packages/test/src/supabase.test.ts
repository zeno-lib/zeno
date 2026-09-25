import type { SupabaseClient, User } from "@supabase/supabase-js"
import { describe, expect, expectTypeOf, it, vi } from "vitest"
import {
  createRlsTestHarness,
  deleteAuthUser,
  type HarnessAdminClient,
  type HarnessClient,
  idsSeen,
  isRetryableAuthError,
  signInAs,
  TestCleanupError,
} from "./supabase"

// Fakes only the Auth API boundary. Their results are the documented
// `{ data, error }` shapes; the casts are because the real types are unions
// over every Auth response variant.
type AuthApi = SupabaseClient["auth"]

const fakeUser = (id: string, email: string) =>
  ({ app_metadata: {}, aud: "authenticated", email, id }) as unknown as User

const retryable = { name: "AuthRetryableFetchError", status: 0 }
const notFound = { code: "user_not_found", name: "AuthApiError", status: 404 }
const fatal = { name: "AuthApiError", status: 401 }
const RANDOM_EMAIL = /^zeno-test-.+@example\.test$/

function createFakes() {
  let nextId = 0

  const createUser = vi.fn((attributes: { email?: string }) => {
    nextId += 1
    return Promise.resolve({
      data: { user: fakeUser(`user-${nextId}`, attributes.email ?? "") },
      error: null,
    })
  })
  const deleteUser = vi.fn(
    (id: string): Promise<{ data: { user: User | null }; error: unknown }> =>
      Promise.resolve({ data: { user: fakeUser(id, "") }, error: null })
  )
  const admin = {
    auth: { admin: { createUser, deleteUser } },
  } as unknown as HarnessAdminClient & {
    auth: {
      admin: { createUser: typeof createUser; deleteUser: typeof deleteUser }
    }
  }

  const signInWithPassword = vi.fn(({ email }: { email: string }) => {
    const user = fakeUser(`signed-in:${email}`, email)
    return Promise.resolve({ data: { session: { user }, user }, error: null })
  })
  const signOut = vi.fn(async () => ({ error: null }))
  const getUser = vi.fn(async () => ({ data: { user: null }, error: null }))
  const client = {
    auth: { getUser, signInWithPassword, signOut },
  } as unknown as HarnessClient & {
    auth: {
      signInWithPassword: typeof signInWithPassword
      signOut: typeof signOut
    }
  }

  return { admin, client, deleteUser, signInWithPassword, signOut }
}

describe("createRlsTestHarness", () => {
  it("creates confirmed users with a random email and the default password", async () => {
    const { admin, client } = createFakes()
    const harness = createRlsTestHarness({ admin, client })

    const a = await harness.createUser()
    const b = await harness.createUser({ email: "fixed@example.test" })

    expect(a.email).toMatch(RANDOM_EMAIL)
    expect(a.password).toBe("zeno-test-password")
    expect(b.email).toBe("fixed@example.test")
    expect(admin.auth.admin.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ email_confirm: true })
    )
    expect(harness.users.map((user) => user.id)).toEqual(["user-1", "user-2"])
  })

  it("lets per-call attributes override createUserAttributes and password", async () => {
    const { admin, client } = createFakes()
    const harness = createRlsTestHarness({
      admin,
      client,
      createUserAttributes: () => ({ user_metadata: { name: "Random" } }),
      password: "suite-pw",
    })

    await harness.createUser({ user_metadata: { name: "Given" } })

    expect(admin.auth.admin.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        password: "suite-pw",
        user_metadata: { name: "Given" },
      })
    )
  })

  it("hands options to onCreateUser and keeps the user tracked if it throws", async () => {
    const { admin, client } = createFakes()
    const seen: unknown[] = []
    const harness = createRlsTestHarness({
      admin,
      client,
      onCreateUser: (user, options: { roles?: string[] } | undefined) => {
        seen.push([user.id, options])
        if (options?.roles?.includes("BROKEN")) {
          throw new Error("role insert failed")
        }
      },
    })

    await harness.createUser({ options: { roles: ["ADMIN"] } })
    await expect(
      harness.createUser({ options: { roles: ["BROKEN"] } })
    ).rejects.toThrow("role insert failed")

    expect(seen).toEqual([
      ["user-1", { roles: ["ADMIN"] }],
      ["user-2", { roles: ["BROKEN"] }],
    ])
    expect(harness.users).toHaveLength(2)
    // `options` is typed from the onCreateUser annotation.
    expectTypeOf(harness.createUser)
      .parameter(0)
      .exclude<undefined>()
      .toHaveProperty("options")
      .toEqualTypeOf<{ roles?: string[] } | undefined>()
  })

  it("tracks the signed-in user through sign-in and local sign-out", async () => {
    const { admin, client, signOut } = createFakes()
    const harness = createRlsTestHarness({ admin, client })

    const user = await harness.createUserAndSignIn()
    expect(harness.currentUser?.email).toBe(user.email)

    await harness.signOut()
    expect(harness.currentUser).toBeUndefined()
    expect(signOut).toHaveBeenCalledWith({ scope: "local" })
  })

  it("builds db once from the client and closes it on cleanUp", async () => {
    const { admin, client } = createFakes()
    const close = vi.fn(async () => undefined)
    const createDb = vi.fn((bound: HarnessClient) => ({ bound, close }))
    const harness = createRlsTestHarness({ admin, client, createDb })

    expect(createDb).toHaveBeenCalledOnce()
    expect(harness.db.bound).toBe(client)

    await harness.cleanUp()
    expect(close).toHaveBeenCalledOnce()
  })

  it("cleanUp deletes every user and still signs out and closes db when a delete fails", async () => {
    const { admin, client, deleteUser, signOut } = createFakes()
    const close = vi.fn(async () => undefined)
    const harness = createRlsTestHarness({
      admin,
      client,
      createDb: () => ({ close }),
    })
    await harness.createUser()
    await harness.createUser()
    await harness.createUser()
    deleteUser.mockImplementation(async (id: string) => ({
      data: { user: fakeUser(id, "") },
      error: id === "user-2" ? fatal : null,
    }))

    await expect(harness.cleanUp()).rejects.toBe(fatal)

    expect(deleteUser).toHaveBeenCalledTimes(3)
    expect(harness.users.map((user) => user.id)).toEqual(["user-2"])
    expect(signOut).toHaveBeenCalled()
    expect(close).toHaveBeenCalled()
  })

  it("collects several cleanup failures into one TestCleanupError", async () => {
    const { admin, client, deleteUser } = createFakes()
    const harness = createRlsTestHarness({ admin, client })
    await harness.createUser()
    await harness.createUser()
    deleteUser.mockImplementation(async () => ({
      data: { user: null },
      error: fatal,
    }))

    const error = await harness
      .cleanUpUsers()
      .catch((thrown: unknown) => thrown)

    expect(error).toBeInstanceOf(TestCleanupError)
    expect((error as TestCleanupError).errors).toEqual([fatal, fatal])
  })
})

describe("deleteAuthUser", () => {
  const adminWith = (
    deleteUser: (id: string) => Promise<{ error: unknown }>
  ): HarnessAdminClient =>
    ({ auth: { admin: { deleteUser } } }) as unknown as HarnessAdminClient

  it("retries a retryable error, returned or thrown, then succeeds", async () => {
    const deleteUser = vi
      .fn<(id: string) => Promise<{ error: unknown }>>()
      .mockResolvedValueOnce({ error: retryable })
      .mockRejectedValueOnce(retryable)
      .mockResolvedValueOnce({ error: null })

    await deleteAuthUser(adminWith(deleteUser), "u", { delayMs: 0 })

    expect(deleteUser).toHaveBeenCalledTimes(3)
  })

  it("gives up after the configured attempts", async () => {
    const deleteUser = vi.fn(async () => ({ error: retryable }))

    await expect(
      deleteAuthUser(adminWith(deleteUser), "u", { attempts: 2, delayMs: 0 })
    ).rejects.toBe(retryable)
    expect(deleteUser).toHaveBeenCalledTimes(2)
  })

  it("does not retry a non-retryable error", async () => {
    const deleteUser = vi.fn(async () => ({ error: fatal }))

    await expect(
      deleteAuthUser(adminWith(deleteUser), "u", { delayMs: 0 })
    ).rejects.toBe(fatal)
    expect(deleteUser).toHaveBeenCalledOnce()
  })

  it("treats an already-deleted user as deleted", async () => {
    const deleteUser = vi.fn(async () => ({ error: notFound }))

    await expect(
      deleteAuthUser(adminWith(deleteUser), "u")
    ).resolves.toBeUndefined()
  })
})

describe("isRetryableAuthError", () => {
  it.each([
    [retryable, true],
    [{ status: 503 }, true],
    [{ status: 429 }, true],
    [{ status: 500 }, false],
    [fatal, false],
    [new Error("boom"), false],
    [null, false],
  ])("%o -> %s", (error, expected) => {
    expect(isRetryableAuthError(error)).toBe(expected)
  })
})

describe("signInAs", () => {
  it("signs out and stays signed out for null (anon)", async () => {
    const { admin, client, signOut, signInWithPassword } = createFakes()
    const harness = createRlsTestHarness({ admin, client })

    await expect(signInAs(harness, null)).resolves.toBeUndefined()
    expect(signOut).toHaveBeenCalledOnce()
    expect(signInWithPassword).not.toHaveBeenCalled()
  })

  it("signs in as a fresh user carrying the options", async () => {
    const { admin, client } = createFakes()
    const onCreateUser = vi.fn()
    const harness = createRlsTestHarness({
      admin,
      client,
      onCreateUser: (user, options: { roles: string[] } | undefined) =>
        onCreateUser(user.id, options),
    })

    const first = await signInAs(harness, { roles: ["ADMIN"] })
    const second = await signInAs(harness, { roles: ["ADMIN"] })

    expect(first?.id).not.toBe(second?.id)
    expect(onCreateUser).toHaveBeenLastCalledWith("user-2", {
      roles: ["ADMIN"],
    })
    expect(harness.currentUser?.email).toBe(second?.email)
  })
})

describe("idsSeen", () => {
  it("collects ids by default", async () => {
    const seen = await idsSeen(async () => [{ id: 1 }, { id: 2 }, { id: 1 }])
    expect(seen).toEqual(new Set([1, 2]))
    expectTypeOf(seen).toEqualTypeOf<Set<number>>()
  })

  it("collects a picked key", async () => {
    const seen = await idsSeen(
      async () => [{ userId: "a" }, { userId: "b" }],
      (row) => row.userId
    )
    expect(seen).toEqual(new Set(["a", "b"]))
  })
})

// A real client satisfies the harness's structural slices.
expectTypeOf<SupabaseClient>().toExtend<HarnessClient>()
expectTypeOf<SupabaseClient>().toExtend<HarnessAdminClient>()
expectTypeOf<AuthApi>().toHaveProperty("signInWithPassword")
