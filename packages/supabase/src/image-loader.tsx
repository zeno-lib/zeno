/**
 * https://supabase.com/docs/guides/storage/serving/image-transformations#nextjs-loader
 *
 * In order to use this loader, add the following to your `next.config.mjs` file:
 *
 * ```js
 * images: {
 *   loader: "custom",
 *   loaderFile: "@zeno-lib/supabase/image-loader.tsx",
 * },
 * ```
 */

const projectId =
  process.env.NEXT_PUBLIC_SUPABASE_STORAGE_PROJECT_ID ??
  process.env.NEXT_PUBLIC_SUPABASE_PROJECT_ID

export const supabaseImageLoader = ({
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
