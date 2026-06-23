//#region src/next-image-loader.ts
/**
* Creates a `next/image` loader that builds Supabase Storage transformation URLs.
* Point `images.loaderFile` at a local file that default-exports the loader (see the README).
*/
function createSupabaseImageLoader(options) {
	const projectId = options?.projectId ?? process.env.NEXT_PUBLIC_SUPABASE_STORAGE_PROJECT_ID ?? process.env.NEXT_PUBLIC_SUPABASE_PROJECT_ID;
	const defaultQuality = options?.defaultQuality ?? 75;
	return ({ quality, src, width }) => {
		if (src.startsWith("http")) return src;
		if (!projectId) throw new Error("Missing Supabase project id environment variable");
		return `https://${projectId}.supabase.co/storage/v1/object/public/${src}?width=${width}&quality=${quality ?? defaultQuality}`;
	};
}
/** Env-configured loader; resolves the project id at import time. */
const supabaseImageLoader = createSupabaseImageLoader();
//#endregion
export { createSupabaseImageLoader, supabaseImageLoader };
