import { describe, expect, it } from "vitest"
import { schema, table, timestamps } from "./schema.ts"
import { moddatetimeExtension, updatedAtTrigger } from "./triggers.ts"

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
