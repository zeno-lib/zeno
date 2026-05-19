import react from "@vitejs/plugin-react"
import { loadEnv } from "vite"
import tsconfigPaths from "vite-tsconfig-paths"
import type { UserConfig } from "vitest/config"
import { defineConfig, mergeConfig } from "vitest/config"

const base = defineConfig({
  esbuild: { jsx: "automatic", jsxImportSource: "react" },
  plugins: [tsconfigPaths(), react({ jsxRuntime: "automatic" })],
  test: {
    env: loadEnv("test", process.cwd(), ""),
    environment: "jsdom",
    globals: false,
    include: ["src/**/*.test.{ts,tsx}"],
    typecheck: {
      enabled: true,
      include: ["src/**/*.test-d.ts"],
      tsconfig: "./tsconfig.json",
    },
  },
})

export function defineReactConfig(overrides?: UserConfig) {
  return mergeConfig(base, overrides ?? {})
}
