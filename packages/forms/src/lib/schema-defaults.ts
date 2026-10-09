// Extract default values from a Zod schema for `useForm`.
//
// Tier A+ semantics:
//   - `.default(...)` / `.prefault(...)` values flow through.
//   - Strings (and string-format subtypes — email, url, uuid, regex, …) without
//     a default fall back to `""` so React inputs render controlled.
//   - Arrays without a default fall back to `[]`.
//   - Nested `z.object(...)` recurses; emits a sub-record only if at least one
//     leaf produced a value.
//   - Numbers, booleans, dates, enums, unions, intersections, files, literals,
//     etc. are skipped — those carry domain meaning and the user supplies them
//     explicitly via `defaultValues`.
//
// Standard Schema doesn't expose introspection; this is Zod-only and reads
// `_zod.def` (Zod v4). For non-Zod schemas (or unrecognised shapes) every entry
// silently degrades to "skip", and the user's `defaultValues` flows through
// untouched. Async schemas, lazy schemas, and any throw inside the walk also
// degrade to "skip" — never bring the form down.

type SchemaNode = { readonly _zod?: { readonly def?: SchemaDef } }

type SchemaDef = {
  readonly type?: string
  readonly innerType?: SchemaNode
  readonly shape?: Record<string, SchemaNode>
  readonly in?: SchemaNode
  readonly element?: SchemaNode
  readonly defaultValue?: unknown
}

const MAX_WRAPPER_DEPTH = 16

type ExtractResult = { ok: true; value: unknown } | { ok: false }

function getDef(node: SchemaNode | undefined): SchemaDef | undefined {
  return node?._zod?.def
}

function extractDefaultForField(node: SchemaNode): ExtractResult {
  let current: SchemaNode | undefined = node
  for (let depth = 0; depth < MAX_WRAPPER_DEPTH; depth += 1) {
    const def: SchemaDef | undefined = getDef(current)
    if (!def?.type) {
      return { ok: false }
    }
    switch (def.type) {
      case "default":
      case "prefault":
        return { ok: true, value: def.defaultValue }
      case "optional":
      case "nullable":
      case "nonoptional":
      case "readonly":
        current = def.innerType
        continue
      case "pipe":
        current = def.in
        continue
      case "string":
        return { ok: true, value: "" }
      case "array":
        return { ok: true, value: [] }
      case "object": {
        const nested = current ? extractZodDefaults(current) : {}
        return Object.keys(nested).length > 0
          ? { ok: true, value: nested }
          : { ok: false }
      }
      default:
        return { ok: false }
    }
  }
  return { ok: false }
}

function extractZodDefaults(schema: SchemaNode): Record<string, unknown> {
  try {
    const def: SchemaDef | undefined = getDef(schema)
    if (def?.type !== "object" || !def.shape) {
      return {}
    }
    const result: Record<string, unknown> = {}
    for (const [key, field] of Object.entries(def.shape)) {
      const extracted = extractDefaultForField(field)
      if (extracted.ok) {
        result[key] = extracted.value
      }
    }
    return result
  } catch {
    return {}
  }
}

// Step from an object or array schema into its `key` child, through any
// wrapper around it. `null` when there is none.
function childAt(node: SchemaNode, key: PropertyKey): SchemaNode | null {
  let current: SchemaNode | undefined = node
  for (let depth = 0; depth < MAX_WRAPPER_DEPTH; depth += 1) {
    const def: SchemaDef | undefined = getDef(current)
    switch (def?.type) {
      case "object":
        return (typeof key === "string" && def.shape?.[key]) || null
      case "array":
        return (typeof key === "number" && def.element) || null
      case "default":
      case "nonoptional":
      case "nullable":
      case "optional":
      case "prefault":
      case "readonly":
        current = def.innerType
        continue
      case "pipe":
        current = def.in
        continue
      default:
        return null
    }
  }
  return null
}

// The value `extractZodDefaults` starts the field at `keys` at, array rows
// included (`["members", 2, "name"]`). `{ ok: false }` when it gives none.
function extractZodDefaultAt(
  schema: SchemaNode,
  keys: readonly PropertyKey[]
): ExtractResult {
  try {
    let node: SchemaNode | null = schema
    for (const key of keys) {
      node = node && childAt(node, key)
    }
    return node && keys.length > 0
      ? extractDefaultForField(node)
      : { ok: false }
  } catch {
    return { ok: false }
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    Object.getPrototypeOf(value) === Object.prototype
  )
}

// User-supplied values always win on conflict. Plain objects on both sides
// recurse so nested `z.object(...)` defaults aren't clobbered by partial user
// objects. Arrays, dates, class instances are treated atomically (user value
// replaces schema value wholesale). User-explicit `undefined` is preserved as
// an intentional reset.
function deepMergeDefaults(
  schemaDefaults: Record<string, unknown>,
  userDefaults: Record<string, unknown> | undefined
): Record<string, unknown> {
  if (!userDefaults) {
    return schemaDefaults
  }
  const result: Record<string, unknown> = { ...schemaDefaults }
  for (const key of Object.keys(userDefaults)) {
    const userValue = userDefaults[key]
    const schemaValue = schemaDefaults[key]
    if (isPlainObject(schemaValue) && isPlainObject(userValue)) {
      result[key] = deepMergeDefaults(schemaValue, userValue)
    } else {
      result[key] = userValue
    }
  }
  return result
}

export { deepMergeDefaults, extractZodDefaultAt, extractZodDefaults }
