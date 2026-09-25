"use client";
import { useHasPrefetchedQueries } from "./prefetched-queries.mjs";
import { QueryErrorResetBoundary } from "@tanstack/react-query";
import { Component, Suspense, useSyncExternalStore } from "react";
import { Fragment, jsx } from "react/jsx-runtime";
//#region src/query-suspense.tsx
const debugStateEnabled = process.env.NODE_ENV !== "production";
const subscribeToNothing = () => () => {};
const useIsHydrated = () => useSyncExternalStore(subscribeToNothing, () => true, () => false);
const debugError = Object.freeze(/* @__PURE__ */ new Error("QuerySuspense: debugState=\"error\" (development / test only; for screenshots)"));
const noop = () => {};
/** Next.js control-flow errors (`notFound()`, `redirect()`, …) carry a `NEXT_`-prefixed digest. */
const isNextControlFlowError = (error) => typeof error === "object" && error !== null && "digest" in error && typeof error.digest === "string" && error.digest.startsWith("NEXT_");
var QueryErrorBoundary = class extends Component {
	constructor(props) {
		super(props);
		this.handleRetry = () => {
			this.props.onQueryReset();
			this.setState({ error: null });
		};
		this.state = { error: null };
	}
	static getDerivedStateFromError(error) {
		if (isNextControlFlowError(error)) throw error;
		return { error };
	}
	componentDidCatch(error) {
		console.error("QueryErrorBoundary:", error);
	}
	render() {
		if (this.state.error) return this.props.errorFallback({
			error: this.state.error,
			onRetry: this.handleRetry
		});
		return this.props.children;
	}
};
/**
* TanStack's recommended suspense stack (`QueryErrorResetBoundary` → error boundary →
* `Suspense`, see https://tanstack.com/query/v5/docs/framework/react/guides/suspense), plus a
* hydration gate: `fallback` is all it renders on the server and through hydration, unless a
* `PrefetchedQueries` (e.g. from `QueryHydrationBoundary`) above it was handed dehydrated queries.
*/
function QuerySuspense({ children, errorFallback, fallback, debugState }) {
	const isHydrated = useIsHydrated();
	const hasPrefetchedQueries = useHasPrefetchedQueries();
	if (debugStateEnabled && debugState === "loading") return /* @__PURE__ */ jsx(Fragment, { children: fallback });
	if (debugStateEnabled && debugState === "error") return /* @__PURE__ */ jsx(Fragment, { children: errorFallback({
		error: debugError,
		onRetry: noop
	}) });
	if (!(isHydrated || hasPrefetchedQueries)) return /* @__PURE__ */ jsx(Fragment, { children: fallback });
	return /* @__PURE__ */ jsx(QueryErrorResetBoundary, { children: ({ reset }) => /* @__PURE__ */ jsx(QueryErrorBoundary, {
		errorFallback,
		onQueryReset: reset,
		children: /* @__PURE__ */ jsx(Suspense, {
			fallback,
			children
		})
	}) });
}
//#endregion
export { QuerySuspense };
