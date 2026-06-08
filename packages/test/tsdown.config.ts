import { defineConfig } from "tsdown"

export default defineConfig({
  clean: true,
  dts: true,
  entry: {
    "configs/index": "src/configs/index.ts",
    "testing-library": "src/testing-library.ts",
    "user-event": "src/user-event.ts",
    vitest: "src/vitest.ts",
  },
  fixedExtension: false,
  format: "esm",
  outExtensions: () => ({
    dts: ".d.ts",
    js: ".js",
  }),
})
