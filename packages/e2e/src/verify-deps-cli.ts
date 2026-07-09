#!/usr/bin/env node
import { parseArgs, styleText } from "node:util"
import { verifyAppDeps } from "./verify-deps.ts"

const DEFAULTS = {
  appsDir: "../../apps",
  packageJson: "./package.json",
  testsDir: "./tests",
}

const USAGE = `Usage: zeno-verify-app-deps [options]

Check that every app with an e2e test folder is a dependency of the e2e
package, so a task runner rebuilds it before its tests run.

Options:
  --apps-dir <dir>       Apps directory (default: ${DEFAULTS.appsDir})
  --tests-dir <dir>      Test folders, one per app (default: ${DEFAULTS.testsDir})
  --package-json <file>  package.json to check (default: ${DEFAULTS.packageJson})
  -h, --help             Show this help
`

function main(): void {
  const { values } = parseArgs({
    options: {
      "apps-dir": { default: DEFAULTS.appsDir, type: "string" },
      help: { short: "h", type: "boolean" },
      "package-json": { default: DEFAULTS.packageJson, type: "string" },
      "tests-dir": { default: DEFAULTS.testsDir, type: "string" },
    },
  })

  if (values.help) {
    process.stdout.write(USAGE)
    return
  }

  const result = verifyAppDeps({
    appsDir: values["apps-dir"] ?? DEFAULTS.appsDir,
    packageJsonPath: values["package-json"] ?? DEFAULTS.packageJson,
    testsDir: values["tests-dir"] ?? DEFAULTS.testsDir,
  })

  if (result.ok) {
    const check = styleText("green", "✓")
    const detail = styleText("dim", `(${result.checked} checked)`)
    console.log(`${check} All tested apps are listed as dependencies ${detail}`)
    return
  }

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

try {
  main()
} catch (error) {
  const reason = error instanceof Error ? error.message : String(error)
  console.error(styleText("red", `✗ ${reason}`, { stream: process.stderr }))
  process.exit(1)
}
