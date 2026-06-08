import { defineConfig } from "vitest/config";
import { loadEnv, mergeConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import react from "@vitejs/plugin-react";
export * from "vitest/config";
//#region src/configs/default.ts
var default_default = defineConfig({
	plugins: [tsconfigPaths()],
	test: {
		env: loadEnv("test", process.cwd(), ""),
		globals: false,
		include: ["{src,test,tests}/**/*.test.ts"],
		typecheck: {
			enabled: true,
			include: ["{src,test,tests}/**/*.test-d.ts"],
			tsconfig: "./tsconfig.json"
		}
	}
});
//#endregion
//#region src/configs/react.ts
var react_default = mergeConfig(default_default, {
	esbuild: {
		jsx: "automatic",
		jsxImportSource: "react"
	},
	plugins: [tsconfigPaths(), react({ jsxRuntime: "automatic" })],
	test: {
		environment: "jsdom",
		include: ["{src,test,tests}/**/*.test.{ts,tsx}"]
	}
});
//#endregion
export { default_default as defaultConfig, react_default as reactConfig };
