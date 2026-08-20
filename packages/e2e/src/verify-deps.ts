import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

export type VerifyAppDepsOptions = {
  /** Directory containing the apps, e.g. `../../apps`. */
  appsDir: string
  /** Directory containing one folder per app that has e2e tests, e.g. `./tests`. */
  testsDir: string
  /** package.json whose deps must list every tested app, e.g. `./package.json`. */
  packageJsonPath: string
}

export type VerifyAppDepsResult = {
  /** True when every app with tests is listed as a dependency. */
  ok: boolean
  /** Number of apps-with-tests that were checked. */
  checked: number
  /** Sorted package names of tested apps missing from the deps. */
  missing: string[]
}

type PackageJson = {
  name?: string
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

/** Read and parse a package.json, wrapping failures with the offending path. */
function readPackageJson(path: string): PackageJson {
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as PackageJson
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(`Could not read ${path}: ${reason}`)
  }
}

/** True if `path` is a directory, treating missing/dangling entries as false. */
function isDirectory(path: string): boolean {
  return statSync(path, { throwIfNoEntry: false })?.isDirectory() ?? false
}

/**
 * Verify that every app under `appsDir` with a matching test folder under
 * `testsDir` is listed in the dependencies (or devDependencies) of `packageJsonPath`.
 *
 * Listing tested apps as workspace deps keeps a task runner's build graph
 * honest, so each app is built before its e2e tests run (Turborepo's `^build`,
 * for example, builds dependencies first). The union of dependencies and
 * devDependencies is checked, so it does not matter which field an app is
 * listed under.
 *
 * Pure: it returns a result and never calls `process.exit`. It throws only when
 * a package.json cannot be read or parsed, or a tested app has no `name`. See
 * the `zeno-e2e verify-deps` command for the CLI wrapper.
 */
export function verifyAppDeps(
  options: VerifyAppDepsOptions
): VerifyAppDepsResult {
  const { appsDir, testsDir, packageJsonPath } = options

  const testDirs = existsSync(testsDir)
    ? readdirSync(testsDir).filter((name) => isDirectory(join(testsDir, name)))
    : []

  // Collected in a Set so duplicate package names count once, then sorted so
  // the result (and the CLI's output) is stable across platforms.
  const appDirs = existsSync(appsDir) ? readdirSync(appsDir) : []
  const appNames = new Set<string>()
  for (const name of appDirs) {
    const pkgPath = join(appsDir, name, "package.json")
    if (
      !(
        testDirs.includes(name) &&
        isDirectory(join(appsDir, name)) &&
        existsSync(pkgPath)
      )
    ) {
      continue
    }
    const pkgName = readPackageJson(pkgPath).name
    if (typeof pkgName !== "string") {
      throw new Error(
        `${pkgPath} has no "name" field, so the app cannot be listed as a dependency`
      )
    }
    appNames.add(pkgName)
  }
  const appsWithTests = [...appNames].sort()

  const pkg = readPackageJson(packageJsonPath)
  const deps = new Set([
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {}),
  ])

  const missing = appsWithTests.filter((app) => !deps.has(app))

  return { checked: appsWithTests.length, missing, ok: missing.length === 0 }
}
