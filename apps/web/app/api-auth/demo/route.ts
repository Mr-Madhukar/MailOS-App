export const dynamic = "force-dynamic";

import http from "node:http";
import https from "node:https";
import { type NextRequest, NextResponse } from "next/server";

import { sanitizeRedirectPath } from "@repo/services/auth/safe-redirect";

function getApiBase() {
  const url = process.env.API_INTERNAL_URL ?? "http://127.0.0.1:8000";
  return url.trim().replace(/\/$/, "");
}

function demoErrorRedirect(request: NextRequest, message: string) {
  const signInUrl = new URL("/sign-in", request.url);
  signInUrl.searchParams.set("error", message);
  return NextResponse.redirect(signInUrl);
}

interface UpstreamResult {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: string;
}

function postJson(urlStr: string, timeoutMs = 30000): Promise<UpstreamResult> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const client = url.protocol === "https:" ? https : http;
    const req = client.request(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": "2",
        },
        timeout: timeoutMs,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          resolve({
            status: res.statusCode ?? 500,
            headers: res.headers,
            body: data,
          });
        });
      },
    );

    req.on("error", (err) => reject(err));
    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`HTTP request to ${urlStr} timed out after ${timeoutMs}ms`));
    });
    req.write("{}");
    req.end();
  });
}

function handleDemoUpstreamError(
  upstreamRes: UpstreamResult,
  request: NextRequest,
): NextResponse | null {
  if (upstreamRes.status >= 200 && upstreamRes.status < 300) {
    return null;
  }
  if (upstreamRes.status >= 500) {
    return demoErrorRedirect(
      request,
      `Demo login unavailable — API 500 error: ${upstreamRes.body ?? "unknown"}`,
    );
  }
  if (upstreamRes.status === 403) {
    return demoErrorRedirect(
      request,
      "Demo login disabled on API. Set DEMO_LOGIN_ENABLED=true on thread-api-smoky and redeploy.",
    );
  }
  return demoErrorRedirect(
    request,
    `Demo login failed (HTTP ${upstreamRes.status}). Verify demo account exists on API backend.`,
  );
}

function parseSingleCookieHeader(headerStr: string): {
  name: string;
  value: string;
  options: { path: string; httpOnly: boolean; sameSite: "lax"; maxAge?: number };
} | null {
  const parts = headerStr.split(";").map((p) => p.trim());
  const cookiePair = parts[0];
  if (!cookiePair) return null;
  const eqIdx = cookiePair.indexOf("=");
  if (eqIdx === -1) return null;
  const name = cookiePair.substring(0, eqIdx).trim();
  const value = cookiePair.substring(eqIdx + 1).trim();
  if (!name || !value) return null;

  let httpOnly = false;
  let maxAge: number | undefined;

  for (let i = 1; i < parts.length; i++) {
    const p = parts[i];
    if (!p) continue;
    if (/^httponly$/i.test(p)) httpOnly = true;
    if (/^max-age=/i.test(p)) {
      const parsed = Number.parseInt(p.substring(8).trim(), 10);
      if (!Number.isNaN(parsed)) maxAge = parsed;
    }
  }

  return {
    name,
    value,
    options: {
      path: "/",
      httpOnly,
      sameSite: "lax",
      ...(maxAge !== undefined ? { maxAge } : {}),
    },
  };
}

function normalizeCookieHeaders(rawSetCookie: string | string[] | undefined): string[] {
  if (Array.isArray(rawSetCookie)) return rawSetCookie;
  if (rawSetCookie) return [rawSetCookie];
  return [];
}

function applySetCookieHeaders(
  response: NextResponse,
  rawSetCookie: string | string[] | undefined,
): void {
  const setCookieHeaders = normalizeCookieHeaders(rawSetCookie);

  console.log("[DEMO ROUTE] Parsed setCookieHeaders:", setCookieHeaders);

  for (const headerStr of setCookieHeaders) {
    const parsed = parseSingleCookieHeader(headerStr);
    if (parsed) {
      response.cookies.set(parsed.name, parsed.value, parsed.options);
    }
  }
}

export async function GET(request: NextRequest) {
  if ((process.env.DEMO_LOGIN_ENABLED ?? "true") !== "true") {
    return demoErrorRedirect(request, "Demo login is not enabled.");
  }

  const nextPath = sanitizeRedirectPath(request.nextUrl.searchParams.get("next"));

  try {
    const apiBase = getApiBase();
    console.log("[DEMO ROUTE] Fetching demo sign-in at:", `${apiBase}/trpc/auth.demoSignIn`);
    const upstreamRes = await postJson(`${apiBase}/trpc/auth.demoSignIn`, 30000);
    console.log("[DEMO ROUTE] upstreamRes status:", upstreamRes.status, "body:", upstreamRes.body);

    const errorRedirect = handleDemoUpstreamError(upstreamRes, request);
    if (errorRedirect) {
      return errorRedirect;
    }

    const html = `<!DOCTYPE html>
<html>
  <head>
    <meta http-equiv="refresh" content="0;url=${nextPath}" />
  </head>
  <body>
    <script>window.location.href = ${JSON.stringify(nextPath)};</script>
  </body>
</html>`;

    const response = new NextResponse(html, {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });

    applySetCookieHeaders(response, upstreamRes.headers["set-cookie"]);

    return response;
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Network error";
    console.error("[DEMO ROUTE] Demo login fetch failed:", error);
    return demoErrorRedirect(
      request,
      `Demo login unavailable — cannot reach API (${detail}). Check API_INTERNAL_URL on thread-web.`,
    );
  }
}
