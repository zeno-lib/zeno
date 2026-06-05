import { spawnSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "@zeno-lib/test"

const packageJson = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../package.json"),
    "utf8"
  )
) as {
  bin?: Record<string, string>
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..")

describe("@zeno-lib/db package surface", () => {
  it("owns the Drizzle and postgres dependencies consumers need", () => {
    expect(packageJson.dependencies).toMatchObject({
      "drizzle-kit": expect.any(String),
      "drizzle-orm": expect.any(String),
      postgres: expect.any(String),
    })
    expect(packageJson.peerDependencies).toBeUndefined()
  })

  it("ships a drizzle-kit binary shim", () => {
    expect(packageJson.bin).toEqual({
      "drizzle-kit": "./bin/drizzle-kit.mjs",
    })
  })

  it("runs the drizzle-kit binary shim", () => {
    const result = spawnSync(
      process.execPath,
      [join(packageRoot, "bin/drizzle-kit.mjs"), "--version"],
      {
        encoding: "utf8",
      }
    )

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("drizzle-kit: v0.31.5")
  })

  it("re-exports the Drizzle APIs used in schema files", async () => {
    const ormImportPath = "@zeno-lib/db/drizzle-orm"
    const pgCoreImportPath = "@zeno-lib/db/pg-core"
    const postgresImportPath = "@zeno-lib/db/postgres"

    const [orm, pgCore, postgres] = await Promise.all([
      import(ormImportPath),
      import(pgCoreImportPath),
      import(postgresImportPath),
    ])

    expect(orm.sql).toEqual(expect.any(Function))
    expect(pgCore.pgTable).toEqual(expect.any(Function))
    expect(pgCore.pgPolicy).toEqual(expect.any(Function))
    expect(postgres.default).toEqual(expect.any(Function))
  })
})
