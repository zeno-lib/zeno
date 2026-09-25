import { ComponentPropsWithoutRef } from "react";
//#region src/query-suspense-loading.d.ts
type QuerySuspenseLoadingProps = ComponentPropsWithoutRef<"div">;
/**
 * Single layout root for Suspense loading UI: set `className` and children here so `aria-busy` /
 * `aria-live` apply to the same element as your skeleton stack (no inner wrapper div). Accepts
 * all `div` props; the `aria-busy` and `aria-live` defaults can be overridden.
 */
declare function QuerySuspenseLoading({ "aria-busy": ariaBusy, "aria-live": ariaLive, children, ...props }: QuerySuspenseLoadingProps): import("react/jsx-runtime").JSX.Element;
//#endregion
export { QuerySuspenseLoading, QuerySuspenseLoadingProps };