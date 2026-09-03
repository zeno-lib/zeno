//#region src/next-image-loader.d.ts
type SupabaseImageLoaderOptions = {
  /** Supabase Storage project id. Defaults to `NEXT_PUBLIC_SUPABASE_STORAGE_PROJECT_ID`, then `NEXT_PUBLIC_SUPABASE_PROJECT_ID`. */
  projectId?: string;
  /** Quality used when `next/image` doesn't request one. Defaults to `75`. */
  defaultQuality?: number;
};
/**
 * Creates a `next/image` loader that builds Supabase Storage transformation URLs.
 * Point `images.loaderFile` at a local file that default-exports the loader (see the README).
 */
declare function createSupabaseImageLoader(options?: SupabaseImageLoaderOptions): ({ quality, src, width }: {
  quality?: number;
  src: string;
  width: number;
}) => string;
/** Env-configured loader; resolves the project id at import time. */
declare const supabaseImageLoader: ({ quality, src, width }: {
  quality?: number;
  src: string;
  width: number;
}) => string;
//#endregion
export { SupabaseImageLoaderOptions, createSupabaseImageLoader, supabaseImageLoader };