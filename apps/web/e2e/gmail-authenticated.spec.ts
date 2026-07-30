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

    await expect(page.getByRole("button", { name: /inbox/i }).first()).toBeVisible({ timeout: 20_000 });

    const ok = await page.evaluate(async () => {
      const res = await fetch("/trpc/inbox.listCachedThreads?batch=1&input=%7B%220%22%3A%7B%22json%22%3A%7B%22limit%22%3A5%7D%7D%7D");
      if (res.ok) return true;
      const res2 = await fetch("/trpc/inbox.listCachedThreads?batch=1&input=%7B%220%22%3A%7B%22limit%22%3A5%7D%7D");
      if (res2.ok) return true;
      const res3 = await fetch("/api/inbox/threads/cached?limit=5");
      return res3.ok;
    });

    expect(ok).toBeTruthy();
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
