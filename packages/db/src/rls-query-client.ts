// The lazy "record a query chain, then replay it inside one RLS transaction"
// client returned by `createSupabaseDrizzle`. Kept separate from `clients.ts`
// because it depends only on the `runTransaction`/`close` callbacks passed in —
// it knows nothing about pools, Supabase, or drizzle.

// One recorded step of a chained call: `db.select` is a get, the following `()`
// is an apply.
type AsUserChainStep =
  | { kind: "get"; prop: PropertyKey }
  | { kind: "apply"; args: unknown[] }

// Walk the recorded chain against the live transaction `tx`, tracking the
// receiver so methods are invoked with the right `this`. Returns whatever the
// chain produces — a thenable drizzle builder, or a relational query promise.
function replayAsUserChain(tx: unknown, path: AsUserChainStep[]): unknown {
  let receiver: unknown = tx
  let current: unknown = tx
  for (const step of path) {
    if (step.kind === "get") {
      receiver = current
      current = (current as Record<PropertyKey, unknown>)[step.prop]
    } else {
      current = (current as (...args: unknown[]) => unknown).apply(
        receiver,
        step.args
      )
    }
  }
  return current
}

const PROMISE_METHODS = new Set<PropertyKey>(["then", "catch", "finally"])

// Awaiting a recorded chain triggers the transaction + replay. The transaction
// is opened lazily when the promise method is *called* (not merely accessed),
// so probing `.then` for thenable-detection never starts a stray transaction.
// The call returns a real promise, so any further `.then`/`.catch`/`.finally`
// chaining runs on it.
function replayPromiseMethod(
  prop: PropertyKey,
  path: AsUserChainStep[],
  runTransaction: (transaction: (tx: unknown) => unknown) => Promise<unknown>
) {
  return (...promiseArgs: unknown[]) => {
    const promise = runTransaction((tx) => replayAsUserChain(tx, path))
    return (
      promise[prop as keyof Promise<unknown>] as (...args: unknown[]) => unknown
    ).apply(promise, promiseArgs)
  }
}

// Builds the RLS query client returned by `createSupabaseDrizzle`. Querying it
// records the get/apply chain lazily; only when the chain is awaited
// (`.then`/`.catch`/`.finally`) does it open an RLS transaction and replay the
// chain against that transaction's `tx`. Each awaited chain is its own
// transaction. `db.transaction(cb)` runs several statements in one transaction,
// and `db.close()` releases the pools. The root itself is intentionally not
// thenable and not callable.
export function createRlsQueryClient(
  runTransaction: (transaction: (tx: unknown) => unknown) => Promise<unknown>,
  close: (...args: never[]) => Promise<void>
): unknown {
  const build = (path: AsUserChainStep[], isRoot: boolean): unknown => {
    // The proxy target must be callable so the `apply` trap fires for `()`.
    const target = () => undefined
    return new Proxy(target, {
      apply(_target, _thisArg, args: unknown[]) {
        if (isRoot) {
          throw new Error(
            "The createSupabaseDrizzle() client is queried directly (e.g. db.select().from(table)). Use db.transaction(cb) to run multiple statements in one RLS transaction."
          )
        }
        return build([...path, { args, kind: "apply" }], false)
      },
      get(_target, prop) {
        // Multi-statement RLS transaction and pool release live on the root.
        if (isRoot && prop === "transaction") {
          return runTransaction
        }
        if (isRoot && prop === "close") {
          return close
        }
        if (PROMISE_METHODS.has(prop)) {
          // Root stays a plain (non-thenable) object so `await db` / probes
          // never open a stray transaction; recorded chains are awaitable.
          return isRoot
            ? undefined
            : replayPromiseMethod(prop, path, runTransaction)
        }
        // Ignore symbol probes (inspection, `Symbol.toPrimitive`, etc.) so they
        // are not recorded as part of the query chain.
        if (typeof prop === "symbol") {
          return
        }
        return build([...path, { kind: "get", prop }], false)
      },
    })
  }
  return build([], true)
}
