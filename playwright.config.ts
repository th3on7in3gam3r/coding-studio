import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  timeout: 60000,
  workers: 1,
  use: {
    baseURL: "http://localhost:3000",
    headless: true,
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
      args: ["--no-sandbox"],
    },
  },
  webServer: {
    command: "npm run start -- --hostname 0.0.0.0",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 30000,
  },
});
