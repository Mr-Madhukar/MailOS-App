/** Strip Domain= from upstream Set-Cookie so cookies bind to the web app host (Vercel). */
export function sanitizeProxiedSetCookie(setCookie: string): string {
  return setCookie
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !/^domain=/i.test(part))
    .join("; ");
}

export function appendProxiedSetCookies(
  response: Headers,
  upstream: Headers | Record<string, string | string[] | undefined>,
) {
  if (upstream && "getSetCookie" in upstream && typeof upstream.getSetCookie === "function") {
    const setCookies = upstream.getSetCookie();
    if (setCookies.length > 0) {
      for (const setCookie of setCookies) {
        response.append("set-cookie", sanitizeProxiedSetCookie(setCookie));
      }
      return;
    }
  }

  if (upstream && "get" in upstream && typeof upstream.get === "function") {
    const single = (upstream as Headers).get("set-cookie");
    if (single) response.set("set-cookie", sanitizeProxiedSetCookie(single));
    return;
  }

  // Fallback for Node.js http.IncomingHttpHeaders object
  const nodeCookies = (upstream as Record<string, string | string[] | undefined>)?.["set-cookie"];
  if (Array.isArray(nodeCookies)) {
    for (const cookie of nodeCookies) {
      response.append("set-cookie", sanitizeProxiedSetCookie(cookie));
    }
  } else if (typeof nodeCookies === "string") {
    response.set("set-cookie", sanitizeProxiedSetCookie(nodeCookies));
  }
}
