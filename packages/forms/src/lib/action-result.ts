// The result shape a server action returns to a form. Declared here rather
// than imported so `@zeno-lib/forms` has no dependency on a server package:
// `defineFormAction` in `@zeno-lib/db/next` returns the same shape, and any
// action that resolves to it (hand-written or from another library) works
// with `submitAction`. The types are read-only so a producer's mutable arrays
// are assignable.

type ActionError = {
  // Keyed by TanStack Form field name: `address.city`, `owners[0].percentage`.
  readonly fieldErrors: Readonly<Record<string, readonly string[]>>
  // Messages with no field (a whole-object refinement, a closed record).
  readonly formErrors: readonly string[]
}

type ActionResult<TData> =
  | { readonly ok: true; readonly data: TData }
  | { readonly ok: false; readonly error: ActionError }

// A Standard Schema issue, reduced to what the path mapping reads.
type ActionIssue = {
  readonly message: string
  readonly path?:
    | ReadonlyArray<PropertyKey | { readonly key: PropertyKey }>
    | undefined
}

// `["owners", 0, "percentage"]` → `owners[0].percentage`, the name the field
// was registered under. An empty path yields `""`.
function toFieldName(path: ActionIssue["path"]): string {
  let name = ""
  for (const segment of path ?? []) {
    const key = typeof segment === "object" ? segment.key : segment
    if (typeof key === "number") {
      name += `[${key}]`
    } else {
      const part = typeof key === "symbol" ? (key.description ?? "") : key
      name += name === "" ? part : `.${part}`
    }
  }
  return name
}

// Group issues by field name; a path-less issue goes to `formErrors`.
function toActionError(issues: readonly ActionIssue[]): ActionError {
  const fieldErrors: Record<string, string[]> = {}
  const formErrors: string[] = []
  for (const issue of issues) {
    const name = toFieldName(issue.path)
    if (name === "") {
      formErrors.push(issue.message)
    } else {
      const messages = fieldErrors[name] ?? []
      messages.push(issue.message)
      fieldErrors[name] = messages
    }
  }
  return { fieldErrors, formErrors }
}

export type { ActionError, ActionIssue, ActionResult }
export { toActionError, toFieldName }
