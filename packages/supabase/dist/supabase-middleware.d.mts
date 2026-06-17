import { NextRequest, NextResponse } from "next/server";

//#region src/supabase-middleware.d.ts
type UpdateSessionOptions = {
  /** Supabase project URL. Defaults to `NEXT_PUBLIC_SUPABASE_URL`. */supabaseUrl?: string; /** Supabase anon key. Defaults to `NEXT_PUBLIC_SUPABASE_ANON_KEY`. */
  supabaseKey?: string; /** Where to redirect unauthenticated requests. Defaults to `/sign-in`. */
  signInPath?: string; /** Path prefixes that skip the auth check. Defaults to `["/sign-in", "/auth"]`. */
  publicPaths?: string[];
};
declare function updateSession(request: NextRequest, options?: UpdateSessionOptions): Promise<NextResponse<unknown>>;
//#endregion
export { UpdateSessionOptions, updateSession };