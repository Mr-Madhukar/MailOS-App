import { NextResponse } from "next/server";

export async function GET() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI || "http://localhost:3000/api/auth/callback";

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
