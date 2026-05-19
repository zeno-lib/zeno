#!/usr/bin/env node
import { spawn } from "node:child_process"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"

const require = createRequire(import.meta.url)
const vitestPkg = require.resolve("vitest/package.json")
const vitestPath = join(dirname(vitestPkg), "vitest.mjs")

const child = spawn(process.execPath, [vitestPath, ...process.argv.slice(2)], {
  cwd: process.cwd(),
  env: process.env,
  stdio: "inherit",
})

child.on("close", (code) => {
  process.exit(code ?? 1)
})
