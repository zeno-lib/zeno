import { jsx } from "react/jsx-runtime";
//#region src/query-suspense-loading.tsx
/**
* Single layout root for Suspense loading UI: set `className` and children here so `aria-busy` /
* `aria-live` apply to the same element as your skeleton stack (no inner wrapper div). Accepts
* all `div` props; the `aria-busy` and `aria-live` defaults can be overridden.
*/
function QuerySuspenseLoading({ "aria-busy": ariaBusy = true, "aria-live": ariaLive = "polite", children, ...props }) {
	return /* @__PURE__ */ jsx("div", {
		"aria-busy": ariaBusy,
		"aria-live": ariaLive,
		...props,
		children
	});
}
//#endregion
export { QuerySuspenseLoading };
