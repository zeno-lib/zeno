// https://supabase.com/docs/guides/storage/serving/image-transformations#nextjs-loader

export type SupabaseImageLoaderOptions = {
  /** Supabase Storage project id. Defaults to `NEXT_PUBLIC_SUPABASE_STORAGE_PROJECT_ID`, then `NEXT_PUBLIC_SUPABASE_PROJECT_ID`. */
  projectId?: string
  /** Quality used when `next/image` doesn't request one. Defaults to `75`. */
  defaultQuality?: number
}

/**
 * Creates a `next/image` loader that builds Supabase Storage transformation URLs.
 * Point `images.loaderFile` at a local file that default-exports the loader (see the README).
 */
export function createSupabaseImageLoader(
  options?: SupabaseImageLoaderOptions
) {
  const projectId =
    options?.projectId ??
    process.env.NEXT_PUBLIC_SUPABASE_STORAGE_PROJECT_ID ??
    process.env.NEXT_PUBLIC_SUPABASE_PROJECT_ID
  const defaultQuality = options?.defaultQuality ?? 75

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
    return `https://${projectId}.supabase.co/storage/v1/object/public/${src}?width=${width}&quality=${quality ?? defaultQuality}`
  }
}

/** Env-configured loader; resolves the project id at import time. */
export const supabaseImageLoader = createSupabaseImageLoader()
