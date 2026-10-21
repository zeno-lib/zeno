import type { Table } from "drizzle-orm"

// What `table()` from `@zeno-lib/db/schema` records on a drizzle table that
// has no column rules. This package can't import db, whose own tests build
// real Zeno tables and cover the rules.
export const zenoTable = <TTable extends Table>(table: TTable) =>
  Object.defineProperty(table, "~zeno", {
    value: { columns: {} },
  }) as TTable & {
    readonly "~zeno": { readonly columns: Record<never, never> }
  }
