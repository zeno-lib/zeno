import { defineConfig } from "tsdown"

export default defineConfig({
  clean: true,
  dts: true,
  entry: {
    config: "src/config.ts",
    "verify-deps": "src/verify-deps.ts",
    "verify-deps-cli": "src/verify-deps-cli.ts",
  },
})
