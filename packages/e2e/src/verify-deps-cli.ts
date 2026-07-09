#!/usr/bin/env node
import { parseArgs, styleText } from "node:util"
import { verifyAppDeps } from "./verify-deps.ts"

const { values } = parseArgs({
  options: {
    "apps-dir": { default: "../../apps", type: "string" },
    "package-json": { default: "./package.json", type: "string" },
    "tests-dir": { default: "./tests", type: "string" },
  },
})

const result = verifyAppDeps({
  appsDir: values["apps-dir"] ?? "../../apps",
  packageJsonPath: values["package-json"] ?? "./package.json",
  testsDir: values["tests-dir"] ?? "./tests",
})

if (result.ok) {
  const check = styleText("green", "✓")
  const detail = styleText("dim", `(${result.checked} checked)`)
  console.log(`${check} All tested apps are listed as dependencies ${detail}`)
} else {
  // Style against stderr, where these lines are printed, so color is only
  // emitted when stderr itself is a color-capable TTY.
  const red = (text: string) =>
    styleText("red", text, { stream: process.stderr })
  const dim = (text: string) =>
    styleText("dim", text, { stream: process.stderr })

  console.error(
    red(
      "✗ These apps have e2e tests but are not dependencies of the e2e package:"
    )
  )
  console.error("")
  for (const app of result.missing) {
    console.error(`  ${red(app)}`)
  }
  console.error("")
  console.error("Add them to the package's devDependencies:")
  console.error("")
  console.error(dim('  "devDependencies": {'))
  for (const app of result.missing) {
    console.error(dim(`    "${app}": "workspace:*",`))
  }
  console.error(dim("  }"))
  console.error("")
  console.error(
    dim(
      "Listing them as dependencies lets your task runner rebuild each app before its e2e tests run."
    )
  )
  process.exit(1)
}
