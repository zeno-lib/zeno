// https://orm.drizzle.team/docs/seed-overview
import "dotenv/config"
import { createDb } from "@zeno-lib/db/client"
import { authUsers } from "@zeno-lib/db/schema"
import { seed } from "drizzle-seed"
import { posts } from "./schema.ts"

// Seeding auth.users directly is fine on a local Supabase instance: `id` is the
// only NOT NULL column without a default. Do NOT run this against a real
const schema = { authUsers, posts }

async function main() {
  const db = createDb({ schema })

  // await reset(db, schema)
  await seed(db, schema).refine((f) => ({
    authUsers: {
      count: 3,
      with: { posts: 5 },
    },
    posts: {
      columns: {
        title: f.loremIpsum({ sentencesCount: 1 }),
      },
    },
  }))

  console.log("Seeded 3 users with 5 posts each")
}

main()
