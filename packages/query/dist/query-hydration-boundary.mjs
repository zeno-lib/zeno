import { PrefetchedQueries } from "./prefetched-queries.mjs";
import { QueryClient, dehydrate } from "@tanstack/react-query";
import { jsx } from "react/jsx-runtime";
//#region src/query-hydration-boundary.tsx
/**
* Async **server component**: runs `prefetch` against a fresh `QueryClient` and dehydrates the
* result into `PrefetchedQueries`, so the suspense queries below resolve from the cache in the
* server render *and* in the browser. That is what lets a `QuerySuspense` subtree render real
* HTML instead of holding its fallback until hydration.
*
* ```tsx
* <QueryHydrationBoundary
*   prefetch={(queryClient) => queryClient.fetchQuery(dealsQueryOptions(filters))}
* >
*   <Deals />
* </QueryHydrationBoundary>
* ```
*/
async function QueryHydrationBoundary({ children, createQueryClient = () => new QueryClient(), dehydrateOptions, prefetch }) {
	const queryClient = createQueryClient();
	await prefetch(queryClient);
	return /* @__PURE__ */ jsx(PrefetchedQueries, {
		state: dehydrate(queryClient, dehydrateOptions),
		children
	});
}
//#endregion
export { QueryHydrationBoundary };
