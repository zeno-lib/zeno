-- Generated with `updatedAtTrigger(posts)` from @zeno-lib/db/triggers.
-- drizzle-kit emits no trigger DDL, so this is a `--custom` migration. It is
-- still tracked: its snapshot links into the chain like any other.
create extension if not exists moddatetime with schema "extensions";

drop trigger if exists "handle_updated_at" on "public"."posts";
create trigger "handle_updated_at"
  before update on "public"."posts"
  for each row
  execute function "extensions".moddatetime ("updated_at");
