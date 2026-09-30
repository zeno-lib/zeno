/**
 * The serializable validation failure a form action returns instead of
 * throwing. Next.js redacts a thrown error's message in production, so a
 * `ZodError` thrown by a server action reaches the browser as an opaque
 * failure; a returned value survives the round trip intact.
 *
 * `fieldErrors` is keyed by TanStack Form field name (`address.city`,
 * `owners[0].percentage`); `formErrors` holds the issues with no path.
 * `@zeno-lib/forms` declares the same shape on its side and matches it
 * structurally, so neither package depends on the other.
 */
export interface ActionError {
  readonly fieldErrors: Record<string, string[]>
  readonly formErrors: string[]
}

/** What a form action resolves to: the handler's result, or the failure. */
export type ActionResult<TData> =
  | { readonly ok: true; readonly data: TData }
  | { readonly ok: false; readonly error: ActionError }

/** A Standard Schema issue, reduced to what the mapping reads. */
export interface ActionIssue {
  readonly message: string
  readonly path?:
    | ReadonlyArray<PropertyKey | { readonly key: PropertyKey }>
    | undefined
}

type FieldMessages = string | readonly string[]

function toMessages(messages: FieldMessages): string[] {
  return typeof messages === "string" ? [messages] : [...messages]
}

/**
 * Thrown from a `defineFormAction` handler to reject the input for a reason
 * only the server can see (a uniqueness conflict, a stale reference). The
 * action catches it and returns `{ ok: false, error }` in the same shape a
 * schema failure produces. Keys are TanStack Form field names.
 *
 * Thrown inside `db.transaction(...)`, it rolls the transaction back like any
 * other error before the action converts it. From a plain `defineAction`
 * handler it is an ordinary error and stays thrown.
 */
export class FieldValidationError extends Error {
  readonly fieldErrors: Record<string, string[]>
  readonly formErrors: string[]

  constructor(
    fieldErrors: Readonly<Record<string, FieldMessages>>,
    options: { formErrors?: FieldMessages; message?: string } = {}
  ) {
    super(options.message ?? "Validation failed")
    this.name = "FieldValidationError"
    this.fieldErrors = Object.fromEntries(
      Object.entries(fieldErrors).map(([name, messages]) => [
        name,
        toMessages(messages),
      ])
    )
    this.formErrors =
      options.formErrors === undefined ? [] : toMessages(options.formErrors)
  }

  /** The error as the returned failure shape. */
  toActionError(): ActionError {
    return { fieldErrors: this.fieldErrors, formErrors: this.formErrors }
  }
}

/**
 * Formats an issue path the way TanStack Form names fields: object keys joined
 * with `.`, array indices in brackets (`["owners", 0, "percentage"]` becomes
 * `owners[0].percentage`). An empty path yields `""`.
 */
export function toFieldName(path: ActionIssue["path"]): string {
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

/**
 * Groups Standard Schema issues into an `ActionError`: each issue lands under
 * its field name, in order, and an issue without a path goes to `formErrors`.
 */
export function toActionError(issues: readonly ActionIssue[]): ActionError {
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
