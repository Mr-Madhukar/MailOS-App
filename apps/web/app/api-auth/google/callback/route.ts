import { type NextRequest } from "next/server";

import { proxyAuthGet } from "~/lib/proxy-auth-route";

/** Proxy Google OAuth callback so Set-Cookie headers reach the browser on :3000. */
export async function GET(request: NextRequest) {
  return proxyAuthGet(request, "/auth/google/callback");
}
