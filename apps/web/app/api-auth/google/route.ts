import { type NextRequest, NextResponse } from "next/server";

import { appendProxiedSetCookies } from "~/lib/proxied-set-cookie";

const API_BASE = process.env.API_INTERNAL_URL ?? "http://127.0.0.1:8000";

/** Proxy Google OAuth login initiation so the backend can set cookies and generate the auth URL. */
export async function GET(request: NextRequest) {
  const upstream = `${API_BASE}/auth/google${request.nextUrl.search}`;

  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(upstream, {
      redirect: "manual",
      headers: {
        cookie: request.headers.get("cookie") ?? "",
      },
    });
  } catch {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set(
      "error",
      "Backend API is not running. Run pnpm run dev from the repo root and try again.",
    );
    return NextResponse.redirect(signInUrl);
  }

  const location = upstreamRes.headers.get("location");
  const response = location
    ? NextResponse.redirect(location)
    : new NextResponse(upstreamRes.body, { status: upstreamRes.status });

  appendProxiedSetCookies(response.headers, upstreamRes.headers);

  return response;
}
