import { randomUUID } from "node:crypto"
import { eq, sql, TransactionRollbackError } from "drizzle-orm"
import type { PgAsyncDatabase } from "drizzle-orm/pg-core"
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js"
import { afterAll, describe, expect, it } from "vitest"
import { authUsers } from "../src/auth-schema"
import { createAdminClient } from "../src/index"
import { expectRlsDenied, rollBackAfter } from "../src/testing"
import { posts } from "./schema"

// Connects for real (SUPABASE_DATABASE_URL from .env.test), so start the local
// stack with `pnpm dev` first.

const db = createAdminClient()

afterAll(async () => {
  await db.close()
})

type Db = PgAsyncDatabase<PostgresJsQueryResultHKT>

// A user and a post of theirs, so the write reaches past one table.
const seedPost = async (tx: Db) => {
  const userId = randomUUID()
  await tx.insert(authUsers).values({ id: userId })
  const [post] = await tx
    .insert(posts)
    .values({ title: "Draft", userId })
    .returning()
  if (!post) {
    throw new Error("Seeding the post failed")
  }
  return post
}

describe("rollBackAfter", () => {
  it("resolves to what run returned, and leaves nothing it wrote behind", async () => {
    const post = await rollBackAfter(db, async (tx) => {
      const seeded = await seedPost(tx)
      expect(
        await tx.select().from(posts).where(eq(posts.id, seeded.id))
      ).toHaveLength(1)
      return seeded
    })

    expect(post.title).toBe("Draft")
    expect(await db.select().from(posts).where(eq(posts.id, post.id))).toEqual(
      []
    )
    expect(
      await db.select().from(authUsers).where(eq(authUsers.id, post.userId))
    ).toEqual([])
  })

  it("rethrows what run throws, after rolling it back", async () => {
    let postId: string | undefined

    await expect(
      rollBackAfter(db, async (tx) => {
        postId = (await seedPost(tx)).id
        throw new Error("run failed")
      })
    ).rejects.toThrow("run failed")

    expect(postId).toBeDefined()
    expect(
      await db
        .select()
        .from(posts)
        .where(eq(posts.id, postId as string))
    ).toEqual([])
  })

  it("rethrows a rollback run asks for, which returns nothing", async () => {
    await expect(
      rollBackAfter(db, (tx) => {
        tx.rollback()
        return Promise.resolve("unreachable")
      })
    ).rejects.toThrow(TransactionRollbackError)
  })
})

describe("expectRlsDenied", () => {
  it("recognises a write a policy refuses", () =>
    rollBackAfter(db, async (tx) => {
      const { userId } = await seedPost(tx)
      await tx.execute(sql`select
        set_config('role', 'authenticated', true),
        set_config('request.jwt.claims', ${JSON.stringify({ role: "authenticated", sub: randomUUID() })}, true)`)

      const error = await expectRlsDenied(
        tx.insert(posts).values({ title: "Not mine", userId })
      )

      expect(error.message).toContain("row-level security policy")
    }))
})
