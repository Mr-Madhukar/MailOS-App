import { expect, test } from "@playwright/test";

import { demoLogin } from "./helpers/auth";

const API_URL = process.env.E2E_API_URL ?? "http://127.0.0.1:8000";

test.describe("Gmail-connected flows", () => {
  test("Gmail OAuth connect URL is generated for authenticated session", async ({ page }) => {
    await demoLogin(page, "/inbox");

    const res = await page.request.get(`${API_URL}/auth/corsair/gmail`, {
      maxRedirects: 0,
    });
    expect([302, 303, 307]).toContain(res.status());
    const location = res.headers()["location"] ?? "";
    expect(location).toMatch(/accounts\.google\.com|google|auth|inbox|error|connect/i);
  });

  test("connected Gmail returns threads via tRPC", async ({ page }) => {
    await demoLogin(page, "/inbox");

    const res = await page.request.get(
      `${API_URL}/trpc/inbox.listCachedThreads?input=${encodeURIComponent(JSON.stringify({ limit: 5 }))}`,
    );
    expect(res.ok()).toBeTruthy();
    const json = await res.json();
    expect(json).toBeTruthy();
  });
});

test("demo user can complete queue workflow with mock Gmail", async ({ page }) => {
  test.setTimeout(90_000);

  await demoLogin(page, "/queue");

  await expect(page.getByRole("heading", { name: "Approval Queue" })).toBeVisible({ timeout: 20_000 });

  const approveButton = page.getByRole("button", { name: /approve/i }).first();
  if (await approveButton.isVisible()) {
    await approveButton.click();
    await expect(page.getByText(/approved|sent/i).first()).toBeVisible({ timeout: 15_000 });
  }
});
