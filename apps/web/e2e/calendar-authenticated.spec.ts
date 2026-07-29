import { expect, test } from "@playwright/test";

test("calendar page loads after demo login", async ({ page }) => {
  if (process.env.DEMO_LOGIN_ENABLED !== "true") {
    test.skip(true, "DEMO_LOGIN_ENABLED is not set");
    return;
  }

  await page.goto("/api-auth/demo?next=/calendar", { waitUntil: "commit" });
  await page.waitForURL(/\/calendar/, { timeout: 45_000 });
  console.log("CALENDAR PAGE URL:", page.url());
  const bodyText = await page.innerText("body");
  console.log("CALENDAR PAGE BODY TEXT:", bodyText.slice(0, 300));
  await expect(page.locator("body")).toBeVisible();
});
