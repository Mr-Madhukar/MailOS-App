import { env } from "../env";

function resolveSameSite(explicitSame?: string): "none" | "lax" | "strict" {
  if (explicitSame === "none" || explicitSame === "lax" || explicitSame === "strict") {
    return explicitSame;
  }
  if (env.NODE_ENV === "production" || env.NODE_ENV === "prod" || env.JWT_COOKIE_SAMESITE === "none") {
    return "none";
  }
  return "lax";
}

export function getJwtCookieOptions() {
  const explicitSame = env.JWT_COOKIE_SAMESITE?.toLowerCase();
  const sameSite = resolveSameSite(explicitSame);

  let secure: boolean;
  if (env.JWT_COOKIE_SECURE === "true") {
    secure = true;
  } else if (env.JWT_COOKIE_SECURE === "false") {
    secure = false;
  } else {
    secure = sameSite === "none" || env.NODE_ENV === "production" || env.NODE_ENV === "prod";
  }

  return {
    httpOnly: true,
    sameSite: sameSite as "lax" | "strict" | "none",
    secure,
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: "/",
  };
}

export function getClearJwtCookieOptions() {
  const { sameSite, secure } = getJwtCookieOptions();
  return {
    httpOnly: true,
    sameSite,
    secure,
    expires: new Date(0),
    path: "/",
  };
}
