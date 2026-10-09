// The lazy "record a query chain, then replay it inside one RLS transaction"
// client returned by `createSupabaseDrizzle`. Kept separate from `clients.ts`
// because it depends only on the `runTransaction`/`close` callbacks passed in —
// it knows nothing about pools, Supabase, or drizzle.

import { AsyncLocalStorage } from "node:async_hooks"

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

// The `db.transaction(cb)` a statement is awaited inside. `open` turns false
// once the callback and the statements it started have settled, so work it
// scheduled for later (Next's `after()`, a timer) opens its own transaction
// instead of reaching a connection that has committed and gone back to the pool.
type TransactionScope = {
  open: boolean
  pending: Set<Promise<unknown>>
  tx: unknown
}

// Awaiting a recorded chain runs its replay. The statement starts lazily when
// the promise method is *called* (not merely accessed), so probing `.then` for
// thenable-detection never starts a stray transaction. The call returns a real
// promise, so any further `.then`/`.catch`/`.finally` chaining runs on it.
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

// Counts `work` as started inside `scope`, so the transaction waits for it.
function join<T>(scope: TransactionScope, work: Promise<T>): Promise<T> {
  scope.pending.add(work)
  const settle = () => scope.pending.delete(work)
  work.then(settle, settle)
  return work
}

// Waits for every statement in `pending`, including the ones those statements'
// continuations start while it waits.
async function settleAll(pending: Set<Promise<unknown>>): Promise<void> {
  if (pending.size === 0) {
    return
  }
  await Promise.allSettled(pending)
  await settleAll(pending)
}

// Builds the RLS query client returned by `createSupabaseDrizzle`. Querying it
// records the get/apply chain lazily; only when the chain is awaited
// (`.then`/`.catch`/`.finally`) does it replay the chain against an RLS
// transaction's `tx`. Each awaited chain is its own transaction, unless it is
// awaited inside `db.transaction(cb)`, which it then joins. `db.close()`
// releases the pools. The root itself is intentionally not thenable and not
// callable.
export function createRlsQueryClient(
  runTransaction: RunTransaction,
  close: (...args: never[]) => Promise<void>
): unknown {
  // One per handle, so a statement on another handle, which may run as
  // another identity, never joins this handle's transaction.
  const scopes = new AsyncLocalStorage<TransactionScope>()

  // A statement awaited while a `db.transaction` callback runs joins that
  // transaction, even from code that never sees `tx`, such as a server action
  // the callback calls.
  const runStatement: RunTransaction = (statement) => {
    const scope = scopes.getStore()
    if (!scope?.open) {
      return runTransaction(statement)
    }
    return join(scope, (async () => await statement(scope.tx))())
  }

  // Inside another `db.transaction`, this one is a savepoint of it.
  const transaction: RunTransaction = (callback) => {
    const outer = scopes.getStore()
    const runScoped = async (tx: unknown) => {
      const scope: TransactionScope = { open: true, pending: new Set(), tx }
      try {
        return await scopes.run(scope, () => callback(tx))
      } finally {
        // A statement the callback started without awaiting reaches the
        // connection before commit or rollback, never after.
        await settleAll(scope.pending)
        scope.open = false
      }
    }
    return outer?.open
      ? join(
          outer,
          (outer.tx as { transaction: RunTransaction }).transaction(runScoped)
        )
      : runTransaction(runScoped)
  }

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
          return transaction
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
