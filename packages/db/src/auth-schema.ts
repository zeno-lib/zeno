// Supabase's auth.users, generated with `drizzle-kit pull` against the local
// stack. Do not hand-edit; regenerate with the procedure in AGENTS.md.
//
// Pinned to: Supabase CLI 2.84.1, Postgres 17.6.1.095, GoTrue v2.188.1,
// auth.schema_migrations 20260302000000.
//
// drizzle-orm/supabase ships 8 of these 35 columns, so putting `auth` in
// `schemaFilter` made drizzle-kit want to drop the other 27, and anyone needing
// a foreign key into auth.users hand-wrote the table instead.
//
// This is deliberately NOT exported from `@zeno-lib/db/schema`. drizzle-kit
// `generate` applies no entity filter at all: it passes `() => true` and its
// config accepts neither `schemaFilter` nor `entities`, so neither
// `pgSchema("auth").existing()` below nor a `schemaFilter` in your drizzle
// config stops it emitting `CREATE TABLE "auth"."users"`. The only thing that
// does is the table never reaching the files your `schema` glob reads, which is
// why it lives behind its own entrypoint rather than in the barrel you
// re-export. Verified against drizzle-kit@1.0.0-rc.3.
//
// The auth enums are deliberately absent too. auth.users uses none of them (they
// belong to the mfa_*, oauth_* and sso_* tables), and drizzle-kit never filters
// enums, so an exported one is guaranteed DDL in every command.
//
// Indexes, unique constraints and checks are omitted for the same reason they
// cannot help: this table is never migrated from here. Columns are what a
// consumer needs for a foreign key and for typed reads.
import { sql } from "drizzle-orm"
import {
  boolean,
  jsonb,
  pgSchema,
  smallint,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"

// `.existing()` stops `CREATE SCHEMA "auth"` everywhere, and stops
// `drizzle-kit push` touching the schema. It does not bind `generate`.
export const authSchema = pgSchema("auth").existing()

/**
 * Supabase's `auth.users`, in full.
 *
 * Reading it needs an RLS-bypassing client, and several columns hold credential
 * material (`encryptedPassword`, the `*Token` columns). Select the columns you
 * need rather than `select()`.
 */
export const authUsers = authSchema.table.withRLS("users", {
  aud: varchar({ length: 255 }),
  bannedUntil: timestamp("banned_until", { withTimezone: true }),
  confirmationSentAt: timestamp("confirmation_sent_at", { withTimezone: true }),
  confirmationToken: varchar("confirmation_token", { length: 255 }),
  confirmedAt: timestamp("confirmed_at", {
    withTimezone: true,
  }).generatedAlwaysAs(sql`LEAST(email_confirmed_at, phone_confirmed_at)`),
  createdAt: timestamp("created_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  email: varchar({ length: 255 }),
  emailChange: varchar("email_change", { length: 255 }),
  emailChangeConfirmStatus: smallint("email_change_confirm_status").default(0),
  emailChangeSentAt: timestamp("email_change_sent_at", { withTimezone: true }),
  emailChangeTokenCurrent: varchar("email_change_token_current", {
    length: 255,
  }).default(""),
  emailChangeTokenNew: varchar("email_change_token_new", { length: 255 }),
  emailConfirmedAt: timestamp("email_confirmed_at", { withTimezone: true }),
  encryptedPassword: varchar("encrypted_password", { length: 255 }),
  id: uuid().primaryKey(),
  instanceId: uuid("instance_id"),
  invitedAt: timestamp("invited_at", { withTimezone: true }),
  isAnonymous: boolean("is_anonymous").default(false).notNull(),
  isSsoUser: boolean("is_sso_user").default(false).notNull(),
  isSuperAdmin: boolean("is_super_admin"),
  lastSignInAt: timestamp("last_sign_in_at", { withTimezone: true }),
  phone: text().default(sql`NULL`),
  phoneChange: text("phone_change").default(""),
  phoneChangeSentAt: timestamp("phone_change_sent_at", { withTimezone: true }),
  phoneChangeToken: varchar("phone_change_token", { length: 255 }).default(""),
  phoneConfirmedAt: timestamp("phone_confirmed_at", { withTimezone: true }),
  rawAppMetaData: jsonb("raw_app_meta_data"),
  rawUserMetaData: jsonb("raw_user_meta_data"),
  reauthenticationSentAt: timestamp("reauthentication_sent_at", {
    withTimezone: true,
  }),
  reauthenticationToken: varchar("reauthentication_token", {
    length: 255,
  }).default(""),
  recoverySentAt: timestamp("recovery_sent_at", { withTimezone: true }),
  recoveryToken: varchar("recovery_token", { length: 255 }),
  role: varchar({ length: 255 }),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
})
