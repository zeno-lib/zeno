import {
  createRequestDb,
  type RequestContext,
  UnauthenticatedError,
} from "@zeno-lib/db/next"
import { z } from "zod"

// Real definitions from `@zeno-lib/db`. Nothing here touches `db`, and
// postgres-js connects on the first query only, so the URL is never dialled.
const { defineAction, defineFormAction, defineQuery, getBearerContext } =
  createRequestDb({
    bearer: {
      client: (clientId) => (clientId === "claude" ? "Claude" : null),
      supabase: () =>
        ({
          auth: {
            // "good" is user-1's token, "other" user-2's.
            getClaims: (token?: string) => {
              const sub = { good: "user-1", other: "user-2" }[token ?? ""]
              return Promise.resolve(
                sub
                  ? {
                      data: {
                        claims: {
                          client_id: "claude",
                          role: "authenticated",
                          sub,
                        },
                      },
                      error: null,
                    }
                  : { data: null, error: new UnauthenticatedError("bad token") }
              )
            },
            getUser: () => Promise.reject(new Error("not used")),
          },
        }) as never,
    },
    connectionString: "postgres://user:password@127.0.0.1:1/unused",
    supabase: () => ({
      auth: { getClaims: () => Promise.resolve({ data: null, error: null }) },
    }),
  })

export { getBearerContext }

export const context: RequestContext = {
  claims: { sub: "user-1" } as RequestContext["claims"],
  db: undefined as never,
  via: "AI assistant",
}

/** Records what each `run` received, to assert the definition parsed once. */
export const received: unknown[] = []

// The output (a number) is not valid input (a string): a second parse fails.
const idSchema = z.object({ id: z.string().transform(Number) })

export const getPost = defineQuery({
  description: "Read one post.",
  name: "get_post",
  run: (_db, input) => {
    received.push(input)
    return { id: input.id, title: "Draft" }
  },
  schema: idSchema,
})

export const listPosts = defineQuery({
  description: "List posts.",
  name: "list_posts",
  paged: true,
  run: (_db, input) => {
    received.push(input)
    return { hasMore: false, items: [], total: 0 }
  },
  schema: z
    .object({ status: z.enum(["draft", "published"]).optional() })
    .strict(),
})

export const getHiddenPost = defineQuery({
  description: "Read a post the user can't see.",
  name: "get_hidden_post",
  run: () => {
    throw new Error("No post 9 for this user")
  },
  schema: z.object({}),
})

// A schema whose check throws instead of reporting an issue: a refinement
// that looks something up and fails, say.
export const getCheckedPost = defineQuery({
  description: "Read a post after a check that fails.",
  name: "get_checked_post",
  run: () => {
    received.push("ran")
    return null
  },
  schema: z.object({}).superRefine(() => {
    throw new Error("Lookup unavailable")
  }),
})

export const renamePost = defineAction({
  describeChange: (_db, input) => ({
    changes: [{ field: "title", from: "Draft", to: input.title }],
    entity: `Post ${input.id}`,
  }),
  description: "Rename a post.",
  name: "rename_post",
  run: (_db, input) => {
    received.push(input)
    return { renamed: input.id }
  },
  schema: z.object({ id: z.string().transform(Number), title: z.string() }),
})

/** Each post's title, which `retitlePost` reads and writes. */
export const titles = new Map<number, string>()

export const retitlePost = defineAction({
  describeChange: (_db, input) => ({
    changes: [
      { field: "title", from: titles.get(input.id) ?? null, to: input.title },
    ],
    entity: `Post ${input.id}`,
  }),
  description: "Retitle a post.",
  name: "retitle_post",
  run: (_db, input) => {
    received.push(input)
    titles.set(input.id, input.title)
    return { retitled: input.id }
  },
  schema: z.object({ id: z.string().transform(Number), title: z.string() }),
})

let stamps = 0

/**
 * Like `retitlePost`, but its `describeChange` computes a value on each read,
 * as a timestamp would be, and names the record with it.
 */
export const stampPost = defineAction({
  describeChange: (_db, input) => {
    stamps += 1
    return {
      changes: [
        { field: "title", from: titles.get(input.id) ?? null, to: input.title },
        { field: "stamp", from: null, to: stamps },
      ],
      entity: `Post ${input.id} (read ${stamps})`,
    }
  },
  description: "Retitle a post and stamp it.",
  name: "stamp_post",
  run: (_db, input) => {
    received.push(input)
    return { stamped: input.id }
  },
  schema: z.object({ id: z.string().transform(Number), title: z.string() }),
})

export const hiddenPost = defineAction({
  describeChange: () => {
    throw new Error("No post 9 for this user")
  },
  description: "Rename a post the user can't see.",
  name: "rename_hidden_post",
  run: () => {
    received.push("ran")
    return null
  },
  schema: z.object({}),
})

export const undescribedWrite = defineFormAction({
  description: "Save a post.",
  name: "save_post",
  run: () => null,
  schema: z.object({}),
})
