import { defineConfig } from "tsdown"

export default defineConfig({
  clean: true,
  dts: true,
  entry: {
    cli: "src/cli.ts",
    config: "src/config.ts",
    "verify-deps": "src/verify-deps.ts",
  },
})
