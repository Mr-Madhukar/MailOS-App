import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const JWT_SECRET = process.env.JWT_ACCESS_SECRET || "default_mailos_secret_key_123456789";

async function verifyToken(token: string): Promise<boolean> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const [headerStr, payloadStr, signature] = parts;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(JWT_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const data = encoder.encode(`${headerStr}.${payloadStr}`);
    
    // Decode base64url signature
    const sigBuf = base64urlToUint8Array(signature);
    
    return await crypto.subtle.verify("HMAC", key, sigBuf as any, data as any);
  } catch (err: any) {
    console.error("[Middleware] verifyToken error:", err);
    return false;
  }
}

function base64urlToUint8Array(base64url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64url.length % 4)) % 4);
  const base64 = base64url
    .replace(/-/g, "+")
    .replace(/_/g, "/") + padding;
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function middleware(req: NextRequest) {
  const token = req.cookies.get("mailos_token")?.value;
  const path = req.nextUrl.pathname;

  const isProtectedRoute = path.startsWith("/dashboard");
  
  // Protect API routes
  const isApiRoute = 
    path.startsWith("/api/emails") || 
    path.startsWith("/api/calendar") || 
    path.startsWith("/api/settings");

  const secretChars = Array.from(JWT_SECRET).map(c => c.charCodeAt(0)).join(",");
  console.log(`[Middleware] Path: ${path}, hasToken: ${!!token}, isProtectedRoute: ${isProtectedRoute}, isApiRoute: ${isApiRoute}, secretPrefix: "${JWT_SECRET.substring(0, 6)}...", charCodes: [${secretChars}]`);

  if (isProtectedRoute || isApiRoute) {
    if (!token) {
      console.log(`[Middleware] Redirecting to /login because token is missing for path: ${path}`);
      if (isApiRoute) {
        return new NextResponse(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
      return NextResponse.redirect(new URL("/login", req.url));
    }

    const isValid = await verifyToken(token);
    console.log(`[Middleware] Token validation result: ${isValid}`);
    if (!isValid) {
      console.log(`[Middleware] Redirecting to /login because token is invalid for path: ${path}`);
      if (isApiRoute) {
        return new NextResponse(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
      const response = NextResponse.redirect(new URL("/login", req.url));
      response.cookies.delete("mailos_token");
      return response;
    }
  }

  // Redirect logged-in users away from auth pages
  if ((path === "/login" || path === "/signup") && token) {
    const isValid = await verifyToken(token);
    if (isValid) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/emails/:path*",
    "/api/calendar/:path*",
    "/api/settings/:path*",
    "/login",
    "/signup",
  ],
};
