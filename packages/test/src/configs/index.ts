/** biome-ignore-all lint/performance/noBarrelFile: re-exporting for convenience */
export * from "vitest/config"
export { default as defaultConfig } from "./default.ts"
export { default as reactConfig } from "./react.ts"
