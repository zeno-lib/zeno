import { defineConfig } from "tsdown"

export default defineConfig({
  clean: true,
  // `@sentry/nextjs` resolves to a different build per runtime (browser, Node.js, edge); a bundled
  // copy would pin one. A copy whose version differs from the app's also keeps its own scopes, so
  // the `digest` tag would miss the app's events.
  deps: { neverBundle: [/^@sentry\//u] },
  dts: true,
  entry: {
    "before-send": "src/before-send.ts",
    options: "src/options.ts",
    "request-error": "src/request-error.ts",
  },
})
