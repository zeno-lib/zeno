import { defineConfig } from "tsdown"

export default defineConfig({
  clean: true,
  // `@sentry/nextjs` resolves to a different build per runtime (browser, Node.js, edge). A bundled
  // copy would pin one build and run a second SDK beside the app's, with its own scope.
  deps: { neverBundle: [/^@sentry\//u] },
  dts: true,
  entry: {
    "before-send": "src/before-send.ts",
    options: "src/options.ts",
    "request-error": "src/request-error.ts",
  },
})
