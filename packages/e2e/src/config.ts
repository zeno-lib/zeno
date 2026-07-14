import { devices, type PlaywrightTestConfig } from "@playwright/test"

/**
 * Shared, app-agnostic Playwright defaults.
 *
 * Spread this into your own config and supply the app-specific `testDir` and
 * `webServer`, which are intentionally omitted here:
 *
 * ```ts
 * import { defineConfig } from "@playwright/test"
 * import { baseConfig } from "@zeno-lib/e2e/config"
 *
 * export default defineConfig({
 *   ...baseConfig,
 *   webServer: {
 *   webServer: { command: "npm run start", url: "http://localhost:3000" },
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
