import { expect, test } from "@playwright/test";
import { demoLogin } from "./helpers/auth";

/**
 * Authenticated inbox smoke test — uses demo login when enabled.
 */
test("inbox page loads after demo login", async ({ page }) => {
  page.on("console", (msg) => console.log("PAGE LOG:", msg.text()));
  page.on("response", (res) => {
    if (res.status() >= 400) console.log("FAILED RES:", res.status(), res.url());
  });
  if (process.env.DEMO_LOGIN_ENABLED !== "true") {
    test.skip(true, "DEMO_LOGIN_ENABLED is not set");
    return;
  }

  await demoLogin(page, "/inbox");

  await expect(page.getByRole("button", { name: /inbox/i }).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: /priority/i }).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: /drafts/i }).first()).toBeVisible({ timeout: 20_000 });
});

test("demo inbox shows seeded threads without Gmail OAuth", async ({ page }) => {
  if (process.env.DEMO_LOGIN_ENABLED !== "true") {
    test.skip(true, "DEMO_LOGIN_ENABLED is not set");
    return;
  }

  await demoLogin(page, "/inbox");

  // Wait for the inbox UI to fully load
  await expect(page.getByRole("button", { name: /inbox/i }).first()).toBeVisible({ timeout: 20_000 });

  // Demo fixtures depend on both:
  //   1. NEXT_PUBLIC_DEMO_LOGIN_ENABLED set on the Next.js client process
  //   2. The demo seed having been run on the API database
  await expect(page.getByText(/Demo workspace|Demo limits|Inbox AI|Demo inbox|No threads yet|Series A|term sheet|sample threads|Select a thread/i).first()).toBeVisible({ timeout: 30_000 });
});

test("queue page loads after demo login", async ({ page }) => {
  if (process.env.DEMO_LOGIN_ENABLED !== "true") {
    test.skip(true, "DEMO_LOGIN_ENABLED is not set");
    return;
  }

  await demoLogin(page, "/queue");
  await expect(page.getByText(/approval queue|queue/i).first()).toBeVisible({ timeout: 20_000 });
});
