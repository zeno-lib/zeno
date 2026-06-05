import react from "@vitejs/plugin-react"
import { mergeConfig } from "vite"
import tsconfigPaths from "vite-tsconfig-paths"
import defaultConfig from "./default.ts"

export default mergeConfig(defaultConfig, {
  esbuild: { jsx: "automatic", jsxImportSource: "react" },
  plugins: [tsconfigPaths(), react({ jsxRuntime: "automatic" })],
  test: {
    environment: "jsdom",
    include: ["{src,test,tests}/**/*.test.{ts,tsx}"],
  },
})
