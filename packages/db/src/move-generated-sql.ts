import { existsSync, readdirSync, renameSync } from "node:fs"
import { join } from "node:path"
import { styleText } from "node:util"

export type MoveGeneratedSqlOptions = {
  /** drizzle-kit writes migrations to this folder. */
  migrationsDir: string
}

export type MoveGeneratedSqlResult = {
  /** The new paths of the SQL files, sorted by name. */
  moved: string[]
}

const GENERATED_SQL = "migration.sql"

/**
 * Move each `<name>/migration.sql` to `<name>.sql`,
 * because the Supabase CLI only reads `.sql` files at the top of the folder.
 * Throws if a `<name>.sql` already exists.
 */
export function moveGeneratedSql(
  options: MoveGeneratedSqlOptions
): MoveGeneratedSqlResult {
  const { migrationsDir } = options

  const names = existsSync(migrationsDir)
    ? readdirSync(migrationsDir)
        .filter((name) => existsSync(join(migrationsDir, name, GENERATED_SQL)))
        .sort()
    : []

  const taken = names
    .map((name) => join(migrationsDir, `${name}.sql`))
    .filter((target) => existsSync(target))
  if (taken.length > 0) {
    throw new Error(
      `Cannot move the generated SQL, because these files already exist: ${taken.join(", ")}`
    )
  }

  const moved = names.map((name) => {
    const target = join(migrationsDir, `${name}.sql`)
    renameSync(join(migrationsDir, name, GENERATED_SQL), target)
    return target
  })

  return { moved }
}

/** Run `moveGeneratedSql` when `drizzle-kit generate` exits. */
export function moveGeneratedSqlAfterGenerate(
  options: MoveGeneratedSqlOptions
): void {
  // drizzle-kit loads the config for every command.
  // Only `generate` writes a migration.
  if (process.argv[2] !== "generate") {
    return
  }

  process.once("exit", (code) => {
    if (code !== 0) {
      return
    }

    // Print to stderr, so the JSON from `--output json` on stdout stays valid.
    try {
      const check = styleText("green", "✓", { stream: process.stderr })
      for (const path of moveGeneratedSql(options).moved) {
        console.error(`${check} Moved the generated SQL to ${path}`)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(
        styleText("red", `✗ ${message}`, { stream: process.stderr })
      )
      process.exitCode = 1
    }
  })
}
