import { loadEnv } from "vite"
import tsconfigPaths from "vite-tsconfig-paths"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    env: loadEnv("test", process.cwd(), ""),
    globals: false,
    include: ["{src,test,tests}/**/*.test.ts"],
    typecheck: {
      enabled: true,
      include: ["{src,test,tests}/**/*.test-d.ts"],
      tsconfig: "./tsconfig.json",
    },
  },
})
