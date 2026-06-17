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

export type SupabaseImageLoaderOptions = {
  /**
   * Supabase Storage project id. Defaults to
   * `NEXT_PUBLIC_SUPABASE_STORAGE_PROJECT_ID` ?? `NEXT_PUBLIC_SUPABASE_PROJECT_ID`.
   */
  projectId?: string
}

export function createSupabaseImageLoader(
  options?: SupabaseImageLoaderOptions
) {
  const projectId =
    options?.projectId ??
    process.env.NEXT_PUBLIC_SUPABASE_STORAGE_PROJECT_ID ??
    process.env.NEXT_PUBLIC_SUPABASE_PROJECT_ID

  return ({
    quality,
    src,
    width,
  }: {
    quality?: number
    src: string
    width: number
  }) => {
    if (src.startsWith("http")) {
      return src
    }
    if (!projectId) {
      throw new Error("Missing Supabase project id environment variable")
    }
    return `https://${projectId}.supabase.co/storage/v1/object/public/${src}?width=${width}&quality=${quality || 75}`
  }
}

/** Env-configured loader; resolves the project id at import time. */
export const supabaseImageLoader = createSupabaseImageLoader()
