import { defineConfig } from "@playwright/test"
import { baseConfig } from "@zeno-lib/e2e/config"

export default defineConfig({
  ...baseConfig,
  testDir: "./tests",
  webServer: [
    {
      command: "cd ../../apps/docs && npm run start -- -p 5002",
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
      url: "http://localhost:5002",
    },
  ],
})
