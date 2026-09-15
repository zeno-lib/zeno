-- Generated with `auditTriggers(posts)` from @zeno-lib/db/triggers.
-- drizzle-kit emits no trigger DDL, so this is a `--custom` migration. It is
-- still tracked: its snapshot links into the chain like any other.
--
-- Without these, updated_at and updated_by keep their insert values forever.

create extension if not exists moddatetime with schema "extensions";

drop trigger if exists "handle_updated_at" on "public"."posts";
create trigger "handle_updated_at"
  before update on "public"."posts"
  for each row
  execute function "extensions".moddatetime ("updated_at");

create or replace function "public"."set_updated_by"()
  returns trigger
  language plpgsql
  security invoker
  set search_path = ''
as $$
begin
  new."updated_by" = (select auth.uid());
  return new;
end;
$$;

drop trigger if exists "handle_updated_by" on "public"."posts";
create trigger "handle_updated_by"
  before update on "public"."posts"
  for each row
  execute function "public"."set_updated_by"();
