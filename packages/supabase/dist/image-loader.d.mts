//#region src/image-loader.d.ts
/**
 * https://supabase.com/docs/guides/storage/serving/image-transformations#nextjs-loader
 *
 * Next's `images.loaderFile` must point at a project-relative file that
 * default-exports the loader, so re-export the loader as the default from a
 * local file and reference that file in `next.config`:
 *
 * ```ts
 * // image-loader.ts
 * export { supabaseImageLoader as default } from "@zeno-lib/supabase/image-loader"
 * ```
 *
 * ```js
 * // next.config.mjs
 * images: { loader: "custom", loaderFile: "./image-loader.ts" },
 * ```
 *
 * Use `createSupabaseImageLoader({ projectId })` instead when the project id is
 * not available via environment variables at import time.
 */
type SupabaseImageLoaderOptions = {
  /**
   * Supabase Storage project id. Defaults to
   * `NEXT_PUBLIC_SUPABASE_STORAGE_PROJECT_ID` ?? `NEXT_PUBLIC_SUPABASE_PROJECT_ID`.
   */
  projectId?: string;
};
declare function createSupabaseImageLoader(options?: SupabaseImageLoaderOptions): ({
  quality,
  src,
  width
}: {
  quality?: number;
  src: string;
  width: number;
}) => string;
/** Env-configured loader; resolves the project id at import time. */
declare const supabaseImageLoader: ({
  quality,
  src,
  width
}: {
  quality?: number;
  src: string;
  width: number;
}) => string;
//#endregion
export { SupabaseImageLoaderOptions, createSupabaseImageLoader, supabaseImageLoader };