import { describe, expect, it } from "vitest"
import { createRlsQueryClient } from "./rls-query-client"

type Row = { txid: number }
type FakeTx = { execute: () => Promise<Row> }
type FakeDb = FakeTx & {
  transaction: <T>(callback: (tx: FakeTx) => T) => Promise<Awaited<T>>
}

// Stands in for drizzle: each transaction gets the next txid, and `execute`
// reports it a few milliseconds later, like a round trip.
function createFakeDb(): FakeDb {
  let txid = 0
  const runTransaction = (transaction: (tx: unknown) => unknown) => {
    txid += 1
    const tx: FakeTx = {
      execute: () =>
        new Promise((resolve) => setTimeout(() => resolve({ txid }), 5)),
    }
    return Promise.resolve(transaction(tx))
  }
  return createRlsQueryClient(runTransaction, () => Promise.resolve()) as FakeDb
}

describe("db.transaction scope", () => {
  it("waits for a statement the callback started without awaiting", async () => {
    const db = createFakeDb()
    const order: string[] = []

    await db.transaction(() => {
      db.execute().then(() => order.push("statement"))
    })
    order.push("transaction")

    expect(order).toEqual(["statement", "transaction"])
  })

  it("gives a statement started after the callback ended its own transaction", async () => {
    const db = createFakeDb()

    // The timer inherits the callback's async context but fires once the
    // transaction has ended, as Next's `after()` would.
    const late = await new Promise<Row>((resolve) => {
      db.transaction(() => {
        setTimeout(() => db.execute().then(resolve), 0)
      })
    })

    expect(late).toEqual({ txid: 2 })
  })
})
