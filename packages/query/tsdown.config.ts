import { defineConfig } from "tsdown"

export default defineConfig({
  clean: true,
  dts: true,
  entry: {
    "prefetched-queries": "src/prefetched-queries.tsx",
    "query-defaults": "src/query-defaults.ts",
    "query-hydration-boundary": "src/query-hydration-boundary.tsx",
    "query-suspense": "src/query-suspense.tsx",
    "query-suspense-loading": "src/query-suspense-loading.tsx",
  },
  // Peers stay bare specifiers: a bundled second copy of React or TanStack Query would give the
  // context `QuerySuspense` reads (and the QueryClient context) a different identity from the app's.
  external: [/^@tanstack\//, /^react(\/|$)/, /^react-dom(\/|$)/],
  // The registry-only `query-error-fallback.tsx` and the tests reach into `packages/ui` through
  // tsconfig `paths`; leave them out of the dts program or it emits `.d.ts` files next to that source.
  tsconfig: "tsconfig.build.json",
})
