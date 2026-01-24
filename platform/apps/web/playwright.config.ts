import type { PlaywrightTestConfig } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";

const config: PlaywrightTestConfig = {
  timeout: 30_000,
  testDir: "./e2e",
  retries: 0,
  use: {
    baseURL,
    headless: true,
    trace: "on-first-retry",
  },
  reporter: [["list"]],
  webServer: {
    command: "pnpm start",
    port: 3000,
    reuseExistingServer: !process.env.CI,
    cwd: __dirname,
    env: {
      ...process.env,
      AUTH_TRUST_HOST: process.env.AUTH_TRUST_HOST ?? "true",
      AUTH_URL: process.env.AUTH_URL ?? baseURL,
      NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? baseURL,
      E2E_BYPASS_AUTH: process.env.E2E_BYPASS_AUTH ?? "true",
    },
  },
};

export default config;
