import { spawnSync } from "node:child_process"
import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

// Runs the real drizzle-kit. No database needed.
// Fails first when a drizzle-kit upgrade stops loading the config in the process that writes the migration.

const PACKAGE_ROOT = join(import.meta.dirname, "..")
const FOLDER = /^\d{14}_posts$/
const SQL_FILE = /^\d{14}_posts\.sql$/

// The file behind the `drizzle-kit` command.
function drizzleKitBin(): string {
  const root = dirname(createRequire(import.meta.url).resolve("drizzle-kit"))
  const manifest = JSON.parse(
    readFileSync(join(root, "package.json"), "utf-8")
  ) as { bin: { "drizzle-kit": string } }
  return join(root, manifest.bin["drizzle-kit"])
}

let projectDir: string

beforeEach(() => {
  projectDir = mkdtempSync(join(tmpdir(), "zeno-db-generate-"))
  // Outside this package, so the imports use full paths.
  const schemaModule = JSON.stringify(join(PACKAGE_ROOT, "src/schema"))
  writeFileSync(
    join(projectDir, "schema.ts"),
    `import { primaryId, table } from ${schemaModule}

export const posts = table("posts", { id: primaryId("uuid") })
`
  )
})

afterEach(() => {
  rmSync(projectDir, { force: true, recursive: true })
})

// Write the config, then run `drizzle-kit generate --custom --name=posts` in the project.
function generate(options: { moveGeneratedSql?: boolean } = {}) {
  const configModule = JSON.stringify(join(PACKAGE_ROOT, "src/config"))
  const config = JSON.stringify({ schema: "./schema.ts", ...options })
  writeFileSync(
    join(projectDir, "drizzle.config.ts"),
    `import { defineDrizzleConfig } from ${configModule}

export default defineDrizzleConfig(${config})
`
  )

  return spawnSync(
    process.execPath,
    [drizzleKitBin(), "generate", "--custom", "--name=posts"],
    { cwd: projectDir, encoding: "utf-8" }
  )
}

// The migrations folder, sorted.
const files = () => readdirSync(join(projectDir, "supabase/migrations")).sort()

describe("drizzle-kit generate with defineDrizzleConfig", () => {
  it("moves the SQL next to its folder", () => {
    const run = generate()

    expect(run.status, run.stderr).toBe(0)
    expect(files()).toEqual([
      expect.stringMatching(FOLDER),
      expect.stringMatching(SQL_FILE),
    ])
    expect(run.stderr).toContain("Moved the generated SQL to")
  }, 30_000)

  it("leaves the SQL in its folder with moveGeneratedSql: false", () => {
    const run = generate({ moveGeneratedSql: false })

    expect(run.status, run.stderr).toBe(0)
    expect(files()).toEqual([expect.stringMatching(FOLDER)])
    const [folder = ""] = files()
    expect(
      readdirSync(join(projectDir, "supabase/migrations", folder)).sort()
    ).toEqual(["migration.sql", "snapshot.json"])
  }, 30_000)
})
