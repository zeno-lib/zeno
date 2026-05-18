import { execFile } from "node:child_process"
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

const repoRoot = process.cwd()
const packagesDir = path.join(repoRoot, "packages")
const changesetDir = path.join(repoRoot, ".changeset")

function requiredEnv(name) {
  const value = process.env[name]

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

function parseLabels(rawLabels) {
  if (!rawLabels) {
    return []
  }

  try {
    const parsed = JSON.parse(rawLabels)

    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed
      .map((label) => {
        if (typeof label === "string") {
          return label
        }

        if (
          label &&
          typeof label === "object" &&
          typeof label.name === "string"
        ) {
          return label.name
        }

        return null
      })
      .filter((label) => typeof label === "string")
  } catch {
    return []
  }
}

function selectReleaseType(labels) {
  const normalizedLabels = new Set(labels.map((label) => label.toLowerCase()))

  if (
    normalizedLabels.has("changeset:none") ||
    normalizedLabels.has("release:none") ||
    normalizedLabels.has("skip changeset")
  ) {
    return null
  }

  if (
    normalizedLabels.has("changeset:major") ||
    normalizedLabels.has("release:major")
  ) {
    return "major"
  }

  if (
    normalizedLabels.has("changeset:minor") ||
    normalizedLabels.has("release:minor")
  ) {
    return "minor"
  }

  if (
    normalizedLabels.has("changeset:patch") ||
    normalizedLabels.has("release:patch")
  ) {
    return "patch"
  }

  return "patch"
}

function isPublishablePackage(packageJson) {
  if (
    typeof packageJson.name !== "string" ||
    typeof packageJson.version !== "string"
  ) {
    return false
  }

  return (
    packageJson.private !== true ||
    packageJson.publishConfig?.access === "public"
  )
}

async function getWorkspacePackages() {
  const entries = await readdir(packagesDir, { withFileTypes: true })
  const packages = []

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue
    }

    const packageRoot = path.join(packagesDir, entry.name)
    const packageJsonPath = path.join(packageRoot, "package.json")

    try {
      const packageJsonContent = await readFile(packageJsonPath, "utf8")
      const packageJson = JSON.parse(packageJsonContent)

      if (!isPublishablePackage(packageJson)) {
        continue
      }

      packages.push({
        name: packageJson.name,
        relativeRoot: path.posix.join("packages", entry.name),
      })
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        continue
      }

      throw error
    }
  }

  return packages.sort(
    (left, right) => right.relativeRoot.length - left.relativeRoot.length
  )
}

async function getChangedFiles(baseSha, headSha) {
  const { stdout } = await execFileAsync("git", [
    "--no-pager",
    "diff",
    "--name-only",
    "--diff-filter=ACDMRT",
    `${baseSha}...${headSha}`,
  ])

  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((filePath) => filePath.split(path.sep).join(path.posix.sep))
}

function detectChangedPackages(changedFiles, workspacePackages) {
  const matchedPackages = new Set()

  for (const filePath of changedFiles) {
    for (const workspacePackage of workspacePackages) {
      if (
        filePath === workspacePackage.relativeRoot ||
        filePath.startsWith(`${workspacePackage.relativeRoot}/`)
      ) {
        matchedPackages.add(workspacePackage.name)
        break
      }
    }
  }

  return [...matchedPackages].sort((left, right) => left.localeCompare(right))
}

function quotePackageName(packageName) {
  return `'${packageName.replaceAll("'", "\\'")}'`
}

function escapeBody(value) {
  return value.replaceAll("\r\n", "\n").trim()
}

function formatGithubHandle(value) {
  return value.startsWith("@") ? value : `@${value}`
}

function buildChangesetContent(packageNames, releaseType, summary) {
  const frontmatter = packageNames
    .map((packageName) => `${quotePackageName(packageName)}: ${releaseType}`)
    .join("\n")

  return `---\n${frontmatter}\n---\n\n${escapeBody(summary)}\n`
}

async function removeGeneratedChangeset(filePath) {
  await rm(filePath, { force: true })
  console.log(
    `Removed generated changeset: ${path.relative(repoRoot, filePath)}`
  )
}

async function main() {
  const prNumber = requiredEnv("GITHUB_PR_NUMBER")
  const prTitle = requiredEnv("GITHUB_PR_TITLE")
  const prAuthor = requiredEnv("GITHUB_PR_AUTHOR")
  const prUrl = requiredEnv("GITHUB_PR_URL")
  const baseSha = requiredEnv("GITHUB_BASE_SHA")
  const headSha = requiredEnv("GITHUB_HEAD_SHA")
  const labels = parseLabels(process.env.GITHUB_PR_LABELS)
  const releaseType = selectReleaseType(labels)
  const generatedChangesetPath = path.join(changesetDir, `pr-${prNumber}.md`)

  if (releaseType === null) {
    await removeGeneratedChangeset(generatedChangesetPath)
    return
  }

  const workspacePackages = await getWorkspacePackages()
  const changedFiles = await getChangedFiles(baseSha, headSha)
  const changedPackages = detectChangedPackages(changedFiles, workspacePackages)

  if (changedPackages.length === 0) {
    await removeGeneratedChangeset(generatedChangesetPath)
    return
  }

  const summary = `${prTitle} (${formatGithubHandle(prAuthor)} in ${prUrl})`
  const content = buildChangesetContent(changedPackages, releaseType, summary)

  await mkdir(changesetDir, { recursive: true })
  await writeFile(generatedChangesetPath, content, "utf8")

  console.log(
    `Generated ${path.relative(repoRoot, generatedChangesetPath)} for ${changedPackages.join(", ")}`
  )
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
