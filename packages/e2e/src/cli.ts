#!/usr/bin/env node
import { styleText } from "node:util"
import { runVerifyDeps } from "./commands/verify-deps.ts"

const USAGE = `Usage: zeno-e2e <command> [options]

Commands:
  verify-deps   Check that every tested app is a dependency of the e2e package

Run \`zeno-e2e verify-deps --help\` for a command's options.
`

function fail(message: string): never {
  console.error(styleText("red", message, { stream: process.stderr }))
  process.exit(1)
}

function main(): void {
  const [command, ...args] = process.argv.slice(2)

  switch (command) {
    case "verify-deps":
      runVerifyDeps(args)
      break
    case "help":
      // `help <command>` shows that command's help; bare `help` shows the list.
      if (args[0] === "verify-deps") {
        runVerifyDeps(["--help"])
      } else {
        process.stdout.write(USAGE)
      }
      break
    case undefined:
    case "-h":
    case "--help":
      process.stdout.write(USAGE)
      break
    default:
      fail(`✗ Unknown command '${command}'\n\n${USAGE}`)
  }
}

try {
  main()
} catch (error) {
  fail(`✗ ${error instanceof Error ? error.message : String(error)}`)
}
