import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { moveGeneratedSql } from "./move-generated-sql.ts"

const POSTS = "20260102030405_posts"
const COMMENTS = "20260102030406_comments"

let migrationsDir: string

beforeEach(() => {
  migrationsDir = mkdtempSync(join(tmpdir(), "zeno-db-migrations-"))
})

afterEach(() => {
  rmSync(migrationsDir, { force: true, recursive: true })
})

// Write `<name>/migration.sql` and `<name>/snapshot.json`, as `drizzle-kit generate` does.
function generated(name: string): void {
  mkdirSync(join(migrationsDir, name))
  writeFileSync(join(migrationsDir, name, "migration.sql"), `-- ${name}`)
  writeFileSync(join(migrationsDir, name, "snapshot.json"), "{}")
}

// The migrations folder, sorted.
const files = () => readdirSync(migrationsDir).sort()

const read = (name: string) => readFileSync(join(migrationsDir, name), "utf-8")

describe("moveGeneratedSql", () => {
  it("moves migration.sql next to its folder", () => {
    generated(POSTS)

    moveGeneratedSql({ migrationsDir })

    expect(files()).toEqual([POSTS, `${POSTS}.sql`])
    expect(readdirSync(join(migrationsDir, POSTS))).toEqual(["snapshot.json"])
    expect(read(`${POSTS}.sql`)).toBe(`-- ${POSTS}`)
  })

  it("returns the new paths in name order", () => {
    generated(COMMENTS)
    generated(POSTS)

    expect(moveGeneratedSql({ migrationsDir })).toEqual({
      moved: [
        join(migrationsDir, `${POSTS}.sql`),
        join(migrationsDir, `${COMMENTS}.sql`),
      ],
    })
  })

  it("moves nothing on a second run", () => {
    generated(POSTS)
    moveGeneratedSql({ migrationsDir })

    expect(moveGeneratedSql({ migrationsDir })).toEqual({ moved: [] })
  })

  it("leaves a hand-written .sql file alone", () => {
    generated(POSTS)
    writeFileSync(join(migrationsDir, "20260102030407_grants.sql"), "grant;")

    moveGeneratedSql({ migrationsDir })

    expect(files()).toEqual([
      POSTS,
      `${POSTS}.sql`,
      "20260102030407_grants.sql",
    ])
    expect(read("20260102030407_grants.sql")).toBe("grant;")
  })

  it("throws before moving anything when a .sql file is in the way", () => {
    generated(POSTS)
    generated(COMMENTS)
    writeFileSync(join(migrationsDir, `${COMMENTS}.sql`), "-- edited by hand")

    expect(() => moveGeneratedSql({ migrationsDir })).toThrow(`${COMMENTS}.sql`)
    expect(files()).toEqual([POSTS, COMMENTS, `${COMMENTS}.sql`])
    expect(read(`${COMMENTS}.sql`)).toBe("-- edited by hand")
  })

  it("returns nothing for a missing folder", () => {
    expect(
      moveGeneratedSql({ migrationsDir: join(migrationsDir, "missing") })
    ).toEqual({ moved: [] })
  })
})
