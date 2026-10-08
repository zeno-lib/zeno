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

type RunTransaction = (
  transaction: (tx: unknown) => unknown
) => Promise<unknown>

// An awaited chain waiting for the batch it joined to run.
type PendingStatement = {
  reject: (reason: unknown) => void
  resolve: (value: unknown) => void
  statement: (tx: unknown) => unknown
}

// Thrown inside a shared transaction to roll it back once a statement failed.
const STATEMENT_FAILED = Symbol("statementFailed")

// `setImmediate` runs once the current task's microtasks have drained, so a
// batch collects every chain awaited by code that resumed from the same I/O
// event, such as parallel loaders all waiting on one session lookup.
const scheduleFlush = (flush: () => void) => {
  if (typeof globalThis.setImmediate === "function") {
    globalThis.setImmediate(flush)
  } else {
    setTimeout(flush, 0)
  }
}

// The statement in a transaction of its own, as if it had never been batched.
function runAlone(runTransaction: RunTransaction, pending: PendingStatement) {
  runTransaction(pending.statement).then(pending.resolve, pending.reject)
}

// Runs the batch's statements concurrently in one transaction, which the
// driver pipelines on its connection. A failed statement aborts the whole
// transaction, so the others' results are discarded with it, and every
// statement runs again alone: only the failing one rejects, and none of them
// keeps a write the rollback undid.
async function runShared(
  runTransaction: RunTransaction,
  batch: PendingStatement[]
) {
  let values: unknown[]
  try {
    values = (await runTransaction(async (tx) => {
      const results = await Promise.allSettled(
        batch.map(async ({ statement }) => await statement(tx))
      )
      if (results.some((result) => result.status === "rejected")) {
        throw STATEMENT_FAILED
      }
      return results.map(
        (result) => (result as PromiseFulfilledResult<unknown>).value
      )
    })) as unknown[]
  } catch {
    for (const pending of batch) {
      runAlone(runTransaction, pending)
    }
    return
  }
  for (const [index, pending] of batch.entries()) {
    pending.resolve(values[index])
  }
}

// Coalesces the chains awaited in the same task into one RLS transaction, so a
// page that loads its reads in parallel opens one transaction, not one per read.
function batchStatements(runTransaction: RunTransaction): RunTransaction {
  let batch: PendingStatement[] | undefined
  return (statement) =>
    new Promise((resolve, reject) => {
      if (!batch) {
        const current: PendingStatement[] = []
        batch = current
        scheduleFlush(() => {
          batch = undefined
          const [only] = current
          if (current.length === 1 && only) {
            runAlone(runTransaction, only)
          } else {
            runShared(runTransaction, current)
          }
        })
      }
      batch.push({ reject, resolve, statement })
    })
}

// Awaiting a recorded chain queues its replay. The statement is queued lazily
// when the promise method is *called* (not merely accessed), so probing
// `.then` for thenable-detection never starts a stray transaction. The call
// returns a real promise, so any further `.then`/`.catch`/`.finally` chaining
// runs on it.
function replayPromiseMethod(
  prop: PropertyKey,
  path: AsUserChainStep[],
  runStatement: RunTransaction
) {
  return (...promiseArgs: unknown[]) => {
    const promise = runStatement((tx) => replayAsUserChain(tx, path))
    return (
      promise[prop as keyof Promise<unknown>] as (...args: unknown[]) => unknown
    ).apply(promise, promiseArgs)
  }
}

// Builds the RLS query client returned by `createSupabaseDrizzle`. Querying it
// records the get/apply chain lazily; only when the chain is awaited
// (`.then`/`.catch`/`.finally`) does it replay the chain against an RLS
// transaction's `tx`. The chains awaited in the same task share one
// transaction (see `batchStatements`). `db.transaction(cb)` runs several
// statements in one transaction of their own, and `db.close()` releases the
// pools. The root itself is intentionally not thenable and not callable.
export function createRlsQueryClient(
  runTransaction: RunTransaction,
  close: (...args: never[]) => Promise<void>
): unknown {
  const runStatement = batchStatements(runTransaction)
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
            : replayPromiseMethod(prop, path, runStatement)
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
