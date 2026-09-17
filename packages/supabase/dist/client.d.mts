import { createClient as createClient$1 } from "@supabase/supabase-js";
//#region src/client.d.ts
/**
 * Plain `@supabase/supabase-js` client with no cookie/session wiring.
 * Use it for backend, API, or script contexts that don't need the user's session.
 * Takes the URL and key explicitly; use `createAnonClient` / `createAdminClient` for environment-based defaults.
 */
declare function createClient<Database>(
/** Supabase project URL. */
supabaseUrl: string,
/** Supabase API key. */
supabaseKey: string,
/** Options forwarded to the client; `auth.persistSession` defaults to `false`. */
options?: Parameters<typeof createClient$1>[2]): import("@supabase/supabase-js").SupabaseClient<Database, "public" extends Exclude<keyof Database, "__InternalSupabase"> ? Exclude<keyof Database, "__InternalSupabase"> & "public" : string & Exclude<keyof Database, "__InternalSupabase">, ("public" extends Exclude<keyof Database, "__InternalSupabase"> ? Exclude<keyof Database, "__InternalSupabase"> & "public" : string & Exclude<keyof Database, "__InternalSupabase">) extends (infer T) ? T extends ("public" extends Exclude<keyof Database, "__InternalSupabase"> ? Exclude<keyof Database, "__InternalSupabase"> & "public" : string & Exclude<keyof Database, "__InternalSupabase">) ? T extends string & Exclude<keyof Database, "__InternalSupabase"> ? T : "public" extends Exclude<keyof Database, "__InternalSupabase"> ? Exclude<keyof Database, "__InternalSupabase"> & "public" : string & Exclude<Exclude<keyof Database, "__InternalSupabase">, "__InternalSupabase"> : never : never, Omit<Database, "__InternalSupabase">[("public" extends Exclude<keyof Database, "__InternalSupabase"> ? Exclude<keyof Database, "__InternalSupabase"> & "public" : string & Exclude<keyof Database, "__InternalSupabase">) extends (infer T) ? T extends ("public" extends Exclude<keyof Database, "__InternalSupabase"> ? Exclude<keyof Database, "__InternalSupabase"> & "public" : string & Exclude<keyof Database, "__InternalSupabase">) ? T extends string & Exclude<keyof Database, "__InternalSupabase"> ? T : "public" extends Exclude<keyof Database, "__InternalSupabase"> ? Exclude<keyof Database, "__InternalSupabase"> & "public" : string & Exclude<Exclude<keyof Database, "__InternalSupabase">, "__InternalSupabase"> : never : never] extends {
  Tables: Record<string, {
    Row: Record<string, unknown>;
    Insert: Record<string, unknown>;
    Update: Record<string, unknown>;
    Relationships: {
      foreignKeyName: string;
      columns: string[];
      isOneToOne?: boolean;
      referencedRelation: string;
      referencedColumns: string[];
    }[];
  }>;
  Views: Record<string, {
    Row: Record<string, unknown>;
    Relationships: {
      foreignKeyName: string;
      columns: string[];
      isOneToOne?: boolean;
      referencedRelation: string;
      referencedColumns: string[];
    }[];
  } | {
    Row: Record<string, unknown>;
    Insert: Record<string, unknown>;
    Update: Record<string, unknown>;
    Relationships: {
      foreignKeyName: string;
      columns: string[];
      isOneToOne?: boolean;
      referencedRelation: string;
      referencedColumns: string[];
    }[];
  }>;
  Functions: Record<string, {
    Args: Record<string, unknown> | never;
    Returns: unknown;
    SetofOptions?: {
      isSetofReturn?: boolean | undefined;
      isOneToOne?: boolean | undefined;
      isNotNullable?: boolean | undefined;
      to: string;
      from: string;
    };
  }>;
} ? Omit<Database, "__InternalSupabase">[("public" extends Exclude<keyof Database, "__InternalSupabase"> ? Exclude<keyof Database, "__InternalSupabase"> & "public" : string & Exclude<keyof Database, "__InternalSupabase">) extends (infer T) ? T extends ("public" extends Exclude<keyof Database, "__InternalSupabase"> ? Exclude<keyof Database, "__InternalSupabase"> & "public" : string & Exclude<keyof Database, "__InternalSupabase">) ? T extends string & Exclude<keyof Database, "__InternalSupabase"> ? T : "public" extends Exclude<keyof Database, "__InternalSupabase"> ? Exclude<keyof Database, "__InternalSupabase"> & "public" : string & Exclude<Exclude<keyof Database, "__InternalSupabase">, "__InternalSupabase"> : never : never] : never, ("public" extends Exclude<keyof Database, "__InternalSupabase"> ? Exclude<keyof Database, "__InternalSupabase"> & "public" : string & Exclude<keyof Database, "__InternalSupabase">) extends (infer T_1) ? T_1 extends ("public" extends Exclude<keyof Database, "__InternalSupabase"> ? Exclude<keyof Database, "__InternalSupabase"> & "public" : string & Exclude<keyof Database, "__InternalSupabase">) ? T_1 extends string & Exclude<keyof Database, "__InternalSupabase"> ? Database extends {
  __InternalSupabase: {
    PostgrestVersion: string;
  };
} ? Database["__InternalSupabase"] : {
  PostgrestVersion: '12';
} : T_1 extends {
  PostgrestVersion: string;
} ? T_1 : never : never : never>;
/**
 * Plain client using the publishable (anon) key by default, so it honors Row Level Security.
 * Use it for untrusted or client-safe data access.
 * For service-role access use the `createAdminClient` factory.
 */
declare function createAnonClient<Database>(
/** Supabase project URL. Defaults to `SUPABASE_URL`, then `NEXT_PUBLIC_SUPABASE_URL`. */
supabaseUrl?: string,
/** Supabase publishable key. Defaults to `SUPABASE_PUBLISHABLE_KEY`, then `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. */
supabaseKey?: string,
/** Options forwarded to the client; `auth.persistSession` defaults to `false`. */
options?: Parameters<typeof createClient$1>[2]): import("@supabase/supabase-js").SupabaseClient<Database, "public" extends Exclude<keyof Database, "__InternalSupabase"> ? Exclude<keyof Database, "__InternalSupabase"> & "public" : string & Exclude<keyof Database, "__InternalSupabase">, ("public" extends Exclude<keyof Database, "__InternalSupabase"> ? Exclude<keyof Database, "__InternalSupabase"> & "public" : string & Exclude<keyof Database, "__InternalSupabase">) extends (infer T) ? T extends ("public" extends Exclude<keyof Database, "__InternalSupabase"> ? Exclude<keyof Database, "__InternalSupabase"> & "public" : string & Exclude<keyof Database, "__InternalSupabase">) ? T extends string & Exclude<keyof Database, "__InternalSupabase"> ? T : "public" extends Exclude<keyof Database, "__InternalSupabase"> ? Exclude<keyof Database, "__InternalSupabase"> & "public" : string & Exclude<Exclude<keyof Database, "__InternalSupabase">, "__InternalSupabase"> : never : never, Omit<Database, "__InternalSupabase">[("public" extends Exclude<keyof Database, "__InternalSupabase"> ? Exclude<keyof Database, "__InternalSupabase"> & "public" : string & Exclude<keyof Database, "__InternalSupabase">) extends (infer T) ? T extends ("public" extends Exclude<keyof Database, "__InternalSupabase"> ? Exclude<keyof Database, "__InternalSupabase"> & "public" : string & Exclude<keyof Database, "__InternalSupabase">) ? T extends string & Exclude<keyof Database, "__InternalSupabase"> ? T : "public" extends Exclude<keyof Database, "__InternalSupabase"> ? Exclude<keyof Database, "__InternalSupabase"> & "public" : string & Exclude<Exclude<keyof Database, "__InternalSupabase">, "__InternalSupabase"> : never : never] extends {
  Tables: Record<string, {
    Row: Record<string, unknown>;
    Insert: Record<string, unknown>;
    Update: Record<string, unknown>;
    Relationships: {
      foreignKeyName: string;
      columns: string[];
      isOneToOne?: boolean;
      referencedRelation: string;
      referencedColumns: string[];
    }[];
  }>;
  Views: Record<string, {
    Row: Record<string, unknown>;
    Relationships: {
      foreignKeyName: string;
      columns: string[];
      isOneToOne?: boolean;
      referencedRelation: string;
      referencedColumns: string[];
    }[];
  } | {
    Row: Record<string, unknown>;
    Insert: Record<string, unknown>;
    Update: Record<string, unknown>;
    Relationships: {
      foreignKeyName: string;
      columns: string[];
      isOneToOne?: boolean;
      referencedRelation: string;
      referencedColumns: string[];
    }[];
  }>;
  Functions: Record<string, {
    Args: Record<string, unknown> | never;
    Returns: unknown;
    SetofOptions?: {
      isSetofReturn?: boolean | undefined;
      isOneToOne?: boolean | undefined;
      isNotNullable?: boolean | undefined;
      to: string;
      from: string;
    };
  }>;
} ? Omit<Database, "__InternalSupabase">[("public" extends Exclude<keyof Database, "__InternalSupabase"> ? Exclude<keyof Database, "__InternalSupabase"> & "public" : string & Exclude<keyof Database, "__InternalSupabase">) extends (infer T) ? T extends ("public" extends Exclude<keyof Database, "__InternalSupabase"> ? Exclude<keyof Database, "__InternalSupabase"> & "public" : string & Exclude<keyof Database, "__InternalSupabase">) ? T extends string & Exclude<keyof Database, "__InternalSupabase"> ? T : "public" extends Exclude<keyof Database, "__InternalSupabase"> ? Exclude<keyof Database, "__InternalSupabase"> & "public" : string & Exclude<Exclude<keyof Database, "__InternalSupabase">, "__InternalSupabase"> : never : never] : never, ("public" extends Exclude<keyof Database, "__InternalSupabase"> ? Exclude<keyof Database, "__InternalSupabase"> & "public" : string & Exclude<keyof Database, "__InternalSupabase">) extends (infer T_1) ? T_1 extends ("public" extends Exclude<keyof Database, "__InternalSupabase"> ? Exclude<keyof Database, "__InternalSupabase"> & "public" : string & Exclude<keyof Database, "__InternalSupabase">) ? T_1 extends string & Exclude<keyof Database, "__InternalSupabase"> ? Database extends {
  __InternalSupabase: {
    PostgrestVersion: string;
  };
} ? Database["__InternalSupabase"] : {
  PostgrestVersion: '12';
} : T_1 extends {
  PostgrestVersion: string;
} ? T_1 : never : never : never>;
/**
 * Plain client using the secret (service-role) key by default, so it bypasses Row Level Security.
 * Use it server-side only; it can read or write any row.
 * For RLS-scoped access use the `createAnonClient` factory.
 */
declare function createAdminClient<Database>(
/** Supabase project URL. Defaults to `SUPABASE_URL`, then `NEXT_PUBLIC_SUPABASE_URL`. */
supabaseUrl?: string,
/** Supabase secret key. Defaults to `SUPABASE_SECRET_KEY`. */
supabaseKey?: string,
/** Options forwarded to the client; `auth.persistSession` defaults to `false`. */
options?: Parameters<typeof createClient$1>[2]): import("@supabase/supabase-js").SupabaseClient<Database, "public" extends Exclude<keyof Database, "__InternalSupabase"> ? Exclude<keyof Database, "__InternalSupabase"> & "public" : string & Exclude<keyof Database, "__InternalSupabase">, ("public" extends Exclude<keyof Database, "__InternalSupabase"> ? Exclude<keyof Database, "__InternalSupabase"> & "public" : string & Exclude<keyof Database, "__InternalSupabase">) extends (infer T) ? T extends ("public" extends Exclude<keyof Database, "__InternalSupabase"> ? Exclude<keyof Database, "__InternalSupabase"> & "public" : string & Exclude<keyof Database, "__InternalSupabase">) ? T extends string & Exclude<keyof Database, "__InternalSupabase"> ? T : "public" extends Exclude<keyof Database, "__InternalSupabase"> ? Exclude<keyof Database, "__InternalSupabase"> & "public" : string & Exclude<Exclude<keyof Database, "__InternalSupabase">, "__InternalSupabase"> : never : never, Omit<Database, "__InternalSupabase">[("public" extends Exclude<keyof Database, "__InternalSupabase"> ? Exclude<keyof Database, "__InternalSupabase"> & "public" : string & Exclude<keyof Database, "__InternalSupabase">) extends (infer T) ? T extends ("public" extends Exclude<keyof Database, "__InternalSupabase"> ? Exclude<keyof Database, "__InternalSupabase"> & "public" : string & Exclude<keyof Database, "__InternalSupabase">) ? T extends string & Exclude<keyof Database, "__InternalSupabase"> ? T : "public" extends Exclude<keyof Database, "__InternalSupabase"> ? Exclude<keyof Database, "__InternalSupabase"> & "public" : string & Exclude<Exclude<keyof Database, "__InternalSupabase">, "__InternalSupabase"> : never : never] extends {
  Tables: Record<string, {
    Row: Record<string, unknown>;
    Insert: Record<string, unknown>;
    Update: Record<string, unknown>;
    Relationships: {
      foreignKeyName: string;
      columns: string[];
      isOneToOne?: boolean;
      referencedRelation: string;
      referencedColumns: string[];
    }[];
  }>;
  Views: Record<string, {
    Row: Record<string, unknown>;
    Relationships: {
      foreignKeyName: string;
      columns: string[];
      isOneToOne?: boolean;
      referencedRelation: string;
      referencedColumns: string[];
    }[];
  } | {
    Row: Record<string, unknown>;
    Insert: Record<string, unknown>;
    Update: Record<string, unknown>;
    Relationships: {
      foreignKeyName: string;
      columns: string[];
      isOneToOne?: boolean;
      referencedRelation: string;
      referencedColumns: string[];
    }[];
  }>;
  Functions: Record<string, {
    Args: Record<string, unknown> | never;
    Returns: unknown;
    SetofOptions?: {
      isSetofReturn?: boolean | undefined;
      isOneToOne?: boolean | undefined;
      isNotNullable?: boolean | undefined;
      to: string;
      from: string;
    };
  }>;
} ? Omit<Database, "__InternalSupabase">[("public" extends Exclude<keyof Database, "__InternalSupabase"> ? Exclude<keyof Database, "__InternalSupabase"> & "public" : string & Exclude<keyof Database, "__InternalSupabase">) extends (infer T) ? T extends ("public" extends Exclude<keyof Database, "__InternalSupabase"> ? Exclude<keyof Database, "__InternalSupabase"> & "public" : string & Exclude<keyof Database, "__InternalSupabase">) ? T extends string & Exclude<keyof Database, "__InternalSupabase"> ? T : "public" extends Exclude<keyof Database, "__InternalSupabase"> ? Exclude<keyof Database, "__InternalSupabase"> & "public" : string & Exclude<Exclude<keyof Database, "__InternalSupabase">, "__InternalSupabase"> : never : never] : never, ("public" extends Exclude<keyof Database, "__InternalSupabase"> ? Exclude<keyof Database, "__InternalSupabase"> & "public" : string & Exclude<keyof Database, "__InternalSupabase">) extends (infer T_1) ? T_1 extends ("public" extends Exclude<keyof Database, "__InternalSupabase"> ? Exclude<keyof Database, "__InternalSupabase"> & "public" : string & Exclude<keyof Database, "__InternalSupabase">) ? T_1 extends string & Exclude<keyof Database, "__InternalSupabase"> ? Database extends {
  __InternalSupabase: {
    PostgrestVersion: string;
  };
} ? Database["__InternalSupabase"] : {
  PostgrestVersion: '12';
} : T_1 extends {
  PostgrestVersion: string;
} ? T_1 : never : never : never>;
//#endregion
export { createAdminClient, createAnonClient, createClient };