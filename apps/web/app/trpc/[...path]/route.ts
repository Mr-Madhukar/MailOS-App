import { type NextRequest, NextResponse } from "next/server";

function getApiBase() {
  const url = process.env.API_INTERNAL_URL ?? "http://127.0.0.1:8000";
  return url.trim().replace(/\/$/, "");
}

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ATTEMPTS = 3;
const ATTEMPT_TIMEOUT_MS = 90_000;
const MUTATION_TIMEOUT_MS = 120_000;

function buildUpstreamHeaders(request: NextRequest): Headers {
  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);

  const requestCookies = request.cookies.getAll();
  const cookieHeader =
    requestCookies.length > 0
      ? requestCookies.map((c) => `${c.name}=${c.value}`).join("; ")
      : request.headers.get("cookie");

  if (cookieHeader) headers.set("cookie", cookieHeader);

  const origin = request.headers.get("origin");
  if (origin) headers.set("origin", origin);
  const referer = request.headers.get("referer");
  if (referer) headers.set("referer", referer);
  if (cookieHeader) {
    headers.set("x-thread-csrf", "1");
  }
  const accept = request.headers.get("accept");
  if (accept) headers.set("accept", accept);
  headers.set("accept-encoding", "identity");
  return headers;
}

function makeTimeoutResponse(): NextResponse {
  return NextResponse.json(
    {
      error: {
        message: "API is waking up — please try again in a few seconds.",
        code: -32004,
        data: { code: "TIMEOUT" },
      },
    },
    { status: 503 },
  );
}

async function fetchWithRetry(
  upstream: string,
  request: NextRequest,
  headers: Headers,
  body: ArrayBuffer | undefined,
  attempt = 0,
): Promise<Response | null> {
  const isMutation = request.method !== "GET" && request.method !== "HEAD";
  const maxAttempts = isMutation ? 1 : ATTEMPTS;
  const timeoutMs = isMutation ? MUTATION_TIMEOUT_MS : ATTEMPT_TIMEOUT_MS;

  try {
    const res = await fetch(upstream, {
      method: request.method,
      headers,
      body,
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (res.status < 500 || attempt >= maxAttempts - 1) {
      return res;
    }
  } catch {
    if (attempt >= maxAttempts - 1) {
      return null;
    }
  }

  await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)));
  return fetchWithRetry(upstream, request, headers, body, attempt + 1);
}

function createProxyResponse(bodyText: string, contentType: string, status: number, statusText: string): NextResponse {
  if (contentType.includes("application/json")) {
    try {
      const json = JSON.parse(bodyText) as unknown;
      return NextResponse.json(json, { status, statusText });
    } catch {
      // Fall through to plain text response on JSON parse failure
    }
  }

  return new NextResponse(bodyText, {
    status,
    statusText,
    headers: { "content-type": contentType },
  });
}

function parseCookiePart(part: string, cookie: { httpOnly: boolean; path: string; maxAge?: number }) {
  if (/^httponly$/i.test(part)) {
    cookie.httpOnly = true;
  } else if (/^path=/i.test(part)) {
    cookie.path = part.substring(5).trim();
  } else if (/^max-age=/i.test(part)) {
    const parsed = Number.parseInt(part.substring(8).trim(), 10);
    if (!Number.isNaN(parsed)) {
      cookie.maxAge = parsed;
    }
  }
}

type ProxyCookie = {
  name: string;
  value: string;
  httpOnly: boolean;
  path: string;
  maxAge?: number;
  sameSite: "lax";
};

function parseSingleCookie(headerStr: string): ProxyCookie | null {
  const parts = headerStr.split(";").map((p) => p.trim());
  const firstPart = parts[0];
  if (!firstPart) return null;

  const eqIdx = firstPart.indexOf("=");
  if (eqIdx === -1) return null;

  const cookie: { httpOnly: boolean; path: string; maxAge?: number } = {
    httpOnly: false,
    path: "/",
  };

  for (const part of parts.slice(1)) {
    if (part) parseCookiePart(part, cookie);
  }

  return {
    name: firstPart.substring(0, eqIdx).trim(),
    value: firstPart.substring(eqIdx + 1).trim(),
    httpOnly: cookie.httpOnly,
    path: cookie.path,
    ...(cookie.maxAge !== undefined ? { maxAge: cookie.maxAge } : {}),
    sameSite: "lax",
  };
}

function forwardCookies(upstreamRes: Response, response: NextResponse) {
  const rawSetCookie = upstreamRes.headers.get("set-cookie");
  if (!rawSetCookie) return;

  const setCookieHeaders = rawSetCookie.split(/,\s*(?=[a-zA-Z0-9_-]+=)/);
  for (const headerStr of setCookieHeaders) {
    const parsed = parseSingleCookie(headerStr);
    if (parsed) {
      response.cookies.set(parsed);
    }
  }
}

/** Proxy tRPC so auth Set-Cookie headers reach the browser (rewrites drop them). */
async function proxyTrpc(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const pathname = path.join("/");
  const apiBase = getApiBase();
  const upstream = `${apiBase}/trpc/${pathname}${request.nextUrl.search}`;
  console.log("[TRPC PROXY ROUTE] url:", upstream, "cookies:", request.cookies.getAll().map((c) => `${c.name}=${c.value}`));
  const headers = buildUpstreamHeaders(request);

  const body =
    request.method !== "GET" && request.method !== "HEAD" ? await request.arrayBuffer() : undefined;

  const upstreamRes = await fetchWithRetry(upstream, request, headers, body);
  if (!upstreamRes) {
    return makeTimeoutResponse();
  }

  const bodyText = await upstreamRes.text();
  const contentType = upstreamRes.headers.get("content-type") ?? "application/json";

  const response = createProxyResponse(bodyText, contentType, upstreamRes.status, upstreamRes.statusText);

  // Prevent Vercel/CDN from gzip-transforming a plain body (ERR_CONTENT_DECODING_FAILED).
  response.headers.set("Cache-Control", "no-store, no-transform");
  response.headers.delete("content-encoding");

  forwardCookies(upstreamRes, response);

  return response;
}

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyTrpc(request, context);
}

export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyTrpc(request, context);
}
