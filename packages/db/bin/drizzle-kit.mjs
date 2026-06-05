#!/usr/bin/env node
import { spawn } from "node:child_process"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"

const require = createRequire(import.meta.url)
const drizzleKitEntry = require.resolve("drizzle-kit")
const drizzleKitPath = join(dirname(drizzleKitEntry), "bin.cjs")

const child = spawn(
  process.execPath,
  [drizzleKitPath, ...process.argv.slice(2)],
  {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  }
)

child.on("close", (code) => {
  process.exit(code ?? 1)
})
