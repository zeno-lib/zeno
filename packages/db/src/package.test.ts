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
  devDependencies?: Record<string, string>
  exports?: Record<string, string>
  peerDependencies?: Record<string, string>
}

describe("@zeno-lib/db package surface", () => {
  it("expects consumers to provide the Drizzle and postgres dependencies", () => {
    expect(packageJson.peerDependencies).toEqual({
      "drizzle-kit": "1.0.0-rc.3",
      "drizzle-orm": "1.0.0-rc.3",
      postgres: expect.any(String),
    })

    expect(packageJson.dependencies ?? {}).not.toHaveProperty("drizzle-kit")
    expect(packageJson.dependencies ?? {}).not.toHaveProperty("drizzle-orm")
    expect(packageJson.dependencies ?? {}).not.toHaveProperty("postgres")
    expect(packageJson.devDependencies).toEqual(
      expect.objectContaining({
        "drizzle-kit": "1.0.0-rc.3",
        "drizzle-orm": "1.0.0-rc.3",
        postgres: expect.any(String),
      })
    )
  })

  it("keeps Drizzle Kit CLI ownership in the consumer package", () => {
    expect(packageJson.bin).toBeUndefined()
  })

  it("exports only Zeno-owned DB entrypoints", () => {
    expect(packageJson.exports).toEqual({
      ".": "./src/index.ts",
      "./clients": "./src/clients.ts",
      "./config": "./src/config.ts",
      "./schema": "./src/schema.ts",
    })
  })

  it("relies on the peer drizzle-kit binary", () => {
    const result = spawnSync("drizzle-kit", ["--version"], {
      encoding: "utf8",
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("drizzle-kit: v1.0.0-rc.3")
  })

  it("keeps peer package surfaces outside the DB helper exports", async () => {
    const importPeerSurface = (importPath: string) =>
      import(/* @vite-ignore */ importPath)

    await expect(importPeerSurface("@zeno-lib/db/drizzle-orm")).rejects.toThrow(
      '"./drizzle-orm" is not exported'
    )
    await expect(importPeerSurface("@zeno-lib/db/pg-core")).rejects.toThrow(
      '"./pg-core" is not exported'
    )
    await expect(importPeerSurface("@zeno-lib/db/drizzle-kit")).rejects.toThrow(
      '"./drizzle-kit" is not exported'
    )
    await expect(importPeerSurface("@zeno-lib/db/postgres")).rejects.toThrow(
      '"./postgres" is not exported'
    )
  })
})
