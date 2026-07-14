import { devices, type PlaywrightTestConfig } from "@playwright/test"

/**
 * Shared, app-agnostic Playwright defaults.
 *
 * Spread this into your own config and add a `webServer` (`webServer` defines how to start your apps).
 * `testDir` defaults to `./tests`; override it if your specs live elsewhere.
 *
 * ```ts
 * import { defineConfig } from "@playwright/test"
 * import { baseConfig } from "@zeno-lib/e2e/config"
 *
 * export default defineConfig({
 *   ...baseConfig,
 *   webServer: {
 *     command: "pnpm --filter @yourorg/webapp start",
 *     url: "http://localhost:3000",
 *   },
 * })
 * ```
 *
 * CI-aware values (`forbidOnly`, `retries`, `timeout`, `reporter`) are read from
 * `process.env.CI` at run time, so they resolve in the consumer's environment.
 */
export const baseConfig: PlaywrightTestConfig = {
  forbidOnly: !!process.env.CI,
  fullyParallel: true,
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  reporter: process.env.CI ? "html" : "list",
  retries: process.env.CI ? 3 : 0,
  testDir: "./tests",
  timeout: process.env.CI ? 30_000 : 120_000,
  use: { trace: "on-first-retry" },
}
