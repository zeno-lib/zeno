// Inspect a Standard Schema to discover which field paths it treats as required.
//
// Standard Schema (Zod, Valibot, ArkType, …) doesn't expose introspection — only
// a `validate(value)` function. We probe by validating an empty object: every
// field that is *required* (i.e. not optional, nullable, or defaulted) emits an
// issue with a `path` we can record. Fields with defaults or `.optional()` stay
// silent because the schema considers them satisfied.
//
// A missing parent hides its children (the schema stops at the missing key), so
// the probe descends: when an issue says it expected an object or an array
// (Zod and Valibot both put that on `issue.expected`), the next pass fills that
// path with `{}` / `[{}]` and validates again. Array rows are probed through
// index `0` and recorded index-agnostically, so `members[0].name` in the set
// matches every row's `members[3].name` via `toRequiredPathKey`.
//
// Paths use TanStack Form's field-name syntax: dots for object keys, brackets
// for array indices (`members[0].name`, not `members.0.name`).
//
// Limitations:
//   - Async schemas are skipped (returns an empty set). Required-ness is a
//     visual hint; the validator itself still runs at submit time.
//   - Cross-field refinements that fail on the probe value may flag fields that
//     aren't intrinsically required. In practice this is the same heuristic
//     users would apply by eye.
//   - Schemas whose issues carry no `expected` hint stop at the top level.

type PathPart = PropertyKey | { readonly key: PropertyKey }

type StandardIssue = {
  readonly path?: readonly PathPart[]
  readonly expected?: unknown
}

type StandardSchemaLike = {
  readonly "~standard": {
    readonly validate: (
      value: unknown
    ) =>
      | { readonly value: unknown }
      | { readonly issues: readonly StandardIssue[] }
      | Promise<unknown>
  }
}

const MAX_PROBE_DEPTH = 8

const INDEX_SEGMENT = /^\d+$/

// Matches `[3]` and `.3` index segments in a field name.
const INDEX_IN_NAME = /\[\d+\]|\.(\d+)(?=\.|\[|$)/g

function pathKey(part: PathPart): PropertyKey {
  // biome-ignore lint/suspicious/noUnnecessaryConditions: issue paths come from third-party validators at runtime, and a non-conforming `null` segment would make `in` throw.
  if (typeof part === "object" && part !== null && "key" in part) {
    return part.key
  }
  return part
}

function isIndex(key: PropertyKey): boolean {
  return (
    typeof key === "number" ||
    (typeof key === "string" && INDEX_SEGMENT.test(key))
  )
}

// Render issue path segments as a TanStack field name, with every array index
// normalised to `0` so one entry covers all rows.
function joinPath(keys: readonly PropertyKey[]): string {
  let out = ""
  for (const key of keys) {
    if (isIndex(key)) {
      out += "[0]"
    } else {
      out += out === "" ? String(key) : `.${String(key)}`
    }
  }
  return out
}

/**
 * Normalise a field name (`members[3].name` or `members.3.name`) to the key
 * `getRequiredPaths` records (`members[0].name`).
 */
function toRequiredPathKey(name: string): string {
  return name.replace(INDEX_IN_NAME, "[0]")
}

function probeContainer(expected: unknown): unknown {
  if (typeof expected !== "string") {
    return
  }
  const kind = expected.toLowerCase()
  if (kind === "object") {
    return {}
  }
  return kind === "array" ? [{}] : undefined
}

// Write `value` at `keys` inside `root`, only where nothing is set yet.
function fillAt(
  root: Record<PropertyKey, unknown>,
  keys: readonly PropertyKey[],
  value: unknown
): boolean {
  let node: Record<PropertyKey, unknown> = root
  for (const key of keys.slice(0, -1)) {
    const next = node[key]
    if (typeof next !== "object" || next === null) {
      return false
    }
    node = next as Record<PropertyKey, unknown>
  }
  const last = keys.at(-1) as PropertyKey
  if (node[last] !== undefined) {
    return false
  }
  node[last] = value
  return true
}

function validateSync(
  schema: StandardSchemaLike,
  value: unknown
): readonly StandardIssue[] | undefined {
  let result: ReturnType<StandardSchemaLike["~standard"]["validate"]>
  try {
    result = schema["~standard"].validate(value)
  } catch {
    return
  }
  if (result instanceof Promise) {
    return
  }
  return "issues" in result && result.issues ? result.issues : []
}

function getRequiredPaths(schema: StandardSchemaLike): Set<string> {
  const required = new Set<string>()
  const probe: Record<PropertyKey, unknown> = {}
  for (let depth = 0; depth < MAX_PROBE_DEPTH; depth += 1) {
    const issues = validateSync(schema, probe)
    if (!issues) {
      return required
    }
    let descended = false
    for (const issue of issues) {
      const keys = issue.path?.map(pathKey) ?? []
      if (keys.length === 0) {
        continue
      }
      required.add(joinPath(keys))
      const container = probeContainer(issue.expected)
      if (container !== undefined && fillAt(probe, keys, container)) {
        descended = true
      }
    }
    if (!descended) {
      break
    }
  }
  return required
}

export type { StandardSchemaLike }
export { getRequiredPaths, toRequiredPathKey }
