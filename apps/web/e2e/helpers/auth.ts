import { type APIRequestContext, type Page } from "@playwright/test";

const API_URL = process.env.E2E_API_URL ?? "http://127.0.0.1:8000";

export async function demoLogin(page: Page, next = "/inbox") {
  await page.goto(`/api-auth/demo?next=${encodeURIComponent(next)}`, { waitUntil: "domcontentloaded" });
  await page.waitForURL(new RegExp(next.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), { timeout: 45_000 });
}

export async function getDemoSessionCookie(request: APIRequestContext): Promise<string> {
  const envCookie = process.env.E2E_SESSION_COOKIE?.trim();
  if (envCookie) return envCookie;

  const res = await request.post(`${API_URL}/trpc/auth.demoSignIn`, {
    data: {},
    headers: { "Content-Type": "application/json" },
  });
  const headers = res.headersArray();
  const cookies = headers
    .filter((h) => h.name.toLowerCase() === "set-cookie")
    .map((h) => h.value.split(";")[0]);
  return cookies.join("; ");
}

export function skipUnlessDemoLogin(test: { skip: (condition: boolean, reason: string) => void }) {
  if (process.env.DEMO_LOGIN_ENABLED !== "true") {
    test.skip(true, "DEMO_LOGIN_ENABLED is not set");
  }
}
