import { type NextRequest } from "next/server";

import { proxyAuthGet } from "~/lib/proxy-auth-route";

/** Proxy Google OAuth login initiation so the backend can set cookies and generate the auth URL. */
export async function GET(request: NextRequest) {
  return proxyAuthGet(request, "/auth/google");
}
