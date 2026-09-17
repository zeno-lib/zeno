import { createServerClient } from "@supabase/ssr";
//#region src/next-server.d.ts
/**
 * Server Supabase client backed by the cookie session (`@supabase/ssr`); async — `await` it.
 * Use it in Server Components, Route Handlers, and Server Actions.
 * For Client Components use the `next-client` factory.
 */
declare function createClient<Database>(
/** Supabase project URL. Defaults to `NEXT_PUBLIC_SUPABASE_URL`. */
supabaseUrl?: string,
/** Supabase publishable key. Defaults to `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. */
supabaseKey?: string,
/** Options forwarded to `createServerClient`; cookie wiring defaults to `next/headers`. */
options?: Partial<Parameters<typeof createServerClient>[2]>): Promise<import("@supabase/supabase-js").SupabaseClient<Database, "public" extends Exclude<keyof Database, "__InternalSupabase"> ? Exclude<keyof Database, "__InternalSupabase"> & "public" : string & Exclude<keyof Database, "__InternalSupabase">, ("public" extends Exclude<keyof Database, "__InternalSupabase"> ? Exclude<keyof Database, "__InternalSupabase"> & "public" : string & Exclude<keyof Database, "__InternalSupabase">) extends (infer T) ? T extends ("public" extends Exclude<keyof Database, "__InternalSupabase"> ? Exclude<keyof Database, "__InternalSupabase"> & "public" : string & Exclude<keyof Database, "__InternalSupabase">) ? T extends string & Exclude<keyof Database, "__InternalSupabase"> ? T : "public" extends Exclude<keyof Database, "__InternalSupabase"> ? Exclude<keyof Database, "__InternalSupabase"> & "public" : string & Exclude<Exclude<keyof Database, "__InternalSupabase">, "__InternalSupabase"> : never : never, Omit<Database, "__InternalSupabase">[("public" extends Exclude<keyof Database, "__InternalSupabase"> ? Exclude<keyof Database, "__InternalSupabase"> & "public" : string & Exclude<keyof Database, "__InternalSupabase">) extends (infer T) ? T extends ("public" extends Exclude<keyof Database, "__InternalSupabase"> ? Exclude<keyof Database, "__InternalSupabase"> & "public" : string & Exclude<keyof Database, "__InternalSupabase">) ? T extends string & Exclude<keyof Database, "__InternalSupabase"> ? T : "public" extends Exclude<keyof Database, "__InternalSupabase"> ? Exclude<keyof Database, "__InternalSupabase"> & "public" : string & Exclude<Exclude<keyof Database, "__InternalSupabase">, "__InternalSupabase"> : never : never] extends {
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
} ? T_1 : never : never : never>>;
//#endregion
export { createClient };