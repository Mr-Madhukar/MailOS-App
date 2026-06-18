import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  
  let redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI || "http://localhost:3000/api/auth/callback";
  try {
    const currentUrl = new URL(req.url);
    if (currentUrl.hostname === "localhost") {
      redirectUri = "http://localhost:3000/api/auth/callback";
    } else {
      redirectUri = `${currentUrl.origin}/api/auth/callback`;
    }
  } catch {}

  if (!clientId) {
    return NextResponse.json({ error: "Google OAuth Client ID not configured" }, { status: 500 });
  }

  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state: "google_login",
    prompt: "select_account",
  }).toString();

  return NextResponse.json({ url: googleAuthUrl });
}
