//#region src/image-loader.ts
function createSupabaseImageLoader(options) {
	const projectId = options?.projectId ?? process.env.NEXT_PUBLIC_SUPABASE_STORAGE_PROJECT_ID ?? process.env.NEXT_PUBLIC_SUPABASE_PROJECT_ID;
	return ({ quality, src, width }) => {
		if (src.startsWith("http")) return src;
		if (!projectId) throw new Error("Missing Supabase project id environment variable");
		return `https://${projectId}.supabase.co/storage/v1/object/public/${src}?width=${width}&quality=${quality || 75}`;
	};
}
/** Env-configured loader; resolves the project id at import time. */
const supabaseImageLoader = createSupabaseImageLoader();
//#endregion
export { createSupabaseImageLoader, supabaseImageLoader };
