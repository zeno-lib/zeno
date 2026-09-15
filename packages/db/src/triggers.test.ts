import { describe, expect, it } from "vitest"
import { schema, table, timestamps } from "./schema.ts"
import {
  auditTriggers,
  moddatetimeExtension,
  updatedAtTrigger,
  updatedByTrigger,
} from "./triggers.ts"

describe("updatedAtTrigger", () => {
  const posts = table("posts", { ...timestamps() })

  it("targets the table's real name and schema", () => {
    const sql = updatedAtTrigger(posts)

    expect(sql).toContain('before update on "public"."posts"')
    expect(sql).toContain('execute function "extensions".moddatetime')
    expect(sql).toContain('("updated_at")')
  })

  it("follows a table into a non-public schema", () => {
    const invoices = schema("billing").table("invoices", { ...timestamps() })

    expect(updatedAtTrigger(invoices)).toContain(
      'before update on "billing"."invoices"'
    )
  })

  it("accepts a bare table name", () => {
    expect(updatedAtTrigger("posts")).toContain(
      'before update on "public"."posts"'
    )
    expect(updatedAtTrigger("invoices", { schema: "billing" })).toContain(
      'before update on "billing"."invoices"'
    )
  })

  it("is re-runnable, so a regenerated migration does not fail", () => {
    const sql = updatedAtTrigger(posts)

    expect(sql).toContain("create extension if not exists moddatetime")
    expect(sql).toContain(
      'drop trigger if exists "handle_updated_at" on "public"."posts"'
    )
  })

  it("takes a column, trigger name and extension schema", () => {
    const sql = updatedAtTrigger(posts, {
      column: "modified_at",
      extensionSchema: "public",
      name: "posts_touch",
    })

    expect(sql).toContain('create trigger "posts_touch"')
    expect(sql).toContain('execute function "public".moddatetime')
    expect(sql).toContain('("modified_at")')
  })

  it("can leave the extension to a migration of its own", () => {
    expect(updatedAtTrigger(posts, { createExtension: false })).not.toContain(
      "create extension"
    )
    expect(moddatetimeExtension()).toBe(
      'create extension if not exists moddatetime with schema "extensions";'
    )
  })

  it("escapes a quote in an identifier rather than closing it early", () => {
    expect(updatedAtTrigger('we"ird')).toContain('"public"."we""ird"')
  })
})

describe("updatedByTrigger", () => {
  const posts = table("posts", { ...timestamps() })

  it("stamps the column with auth.uid() before every update", () => {
    const sql = updatedByTrigger(posts)

    expect(sql).toContain('new."updated_by" = (select auth.uid());')
    expect(sql).toContain('before update on "public"."posts"')
    expect(sql).toContain('execute function "public"."set_updated_by"()')
  })

  it("creates the function with no privileges of its own", () => {
    const sql = updatedByTrigger(posts)

    // auth.uid() reads a transaction-local setting, so invoker rights are both
    // sufficient and the safer default.
    expect(sql).toContain("security invoker")
    expect(sql).toContain("set search_path = ''")
  })

  it("is re-runnable", () => {
    const sql = updatedByTrigger(posts)

    expect(sql).toContain("create or replace function")
    expect(sql).toContain(
      'drop trigger if exists "handle_updated_by" on "public"."posts"'
    )
  })

  it("takes a column, trigger name and function schema", () => {
    const sql = updatedByTrigger(posts, {
      column: "last_editor",
      functionSchema: "audit",
      name: "posts_touch_editor",
    })

    expect(sql).toContain('create trigger "posts_touch_editor"')
    expect(sql).toContain('"audit"."set_last_editor"()')
    expect(sql).toContain('new."last_editor" = (select auth.uid());')
  })

  it("can leave the function to a migration of its own", () => {
    expect(updatedByTrigger(posts, { createFunction: false })).not.toContain(
      "create or replace function"
    )
  })
})

describe("auditTriggers", () => {
  it("emits both update triggers auditColumns needs", () => {
    const posts = table("posts", { ...timestamps() })
    const sql = auditTriggers(posts)

    expect(sql).toContain('create trigger "handle_updated_at"')
    expect(sql).toContain('create trigger "handle_updated_by"')
    expect(sql).toContain("moddatetime")
    expect(sql).toContain("(select auth.uid())")
  })
})
