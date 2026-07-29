import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const apiURL = process.env.E2E_API_URL ?? "http://127.0.0.1:8000";

process.env.API_INTERNAL_URL = apiURL;
process.env.DEMO_LOGIN_ENABLED = process.env.DEMO_LOGIN_ENABLED ?? "true";
process.env.THREAD_E2E_MOCK_GMAIL = process.env.THREAD_E2E_MOCK_GMAIL ?? "true";
process.env.E2E_GMAIL_AVAILABLE = process.env.E2E_GMAIL_AVAILABLE ?? "true";
process.env.DOCS_SECRET = process.env.DOCS_SECRET ?? "docs-secret-test-12345";
process.env.OPENAPI_DOCS_SECRET = process.env.OPENAPI_DOCS_SECRET ?? "docs-secret-test-12345";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: process.env.PLAYWRIGHT_TEST_BASE_URL
    ? undefined
    : {
        command: "node scripts/start-e2e-servers.mjs",
        cwd: "../..",
        url: `${apiURL}/health`,
        reuseExistingServer: true,
        timeout: 120_000,
        env: {
          ...process.env,
          NODE_ENV: "test",
          PLAYWRIGHT: "true",
          API_INTERNAL_URL: apiURL,
          CLIENT_URL: baseURL,
          BASE_URL: apiURL,
          DEMO_LOGIN_ENABLED: process.env.DEMO_LOGIN_ENABLED ?? "true",
          NEXT_PUBLIC_DEMO_LOGIN_ENABLED: process.env.DEMO_LOGIN_ENABLED ?? "true",
          THREAD_E2E_MOCK_GMAIL: process.env.THREAD_E2E_MOCK_GMAIL ?? "true",
          DEMO_USER_EMAIL: process.env.DEMO_USER_EMAIL ?? process.env.SEED_USER_EMAIL ?? "demo@mailos.dev",
          DEMO_USER_PASSWORD:
            process.env.DEMO_USER_PASSWORD ?? process.env.SEED_DEMO_PASSWORD ?? "DemoPass123!",
        },
      },
  metadata: {
    apiURL,
  },
});
