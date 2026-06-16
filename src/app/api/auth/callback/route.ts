import { NextResponse } from "next/server";
import { corsair } from "@/server/corsair";
import { gmail } from "@corsair-dev/gmail";
import { googlecalendar } from "@corsair-dev/googlecalendar";
import { exchangeCodeForTokens } from "corsair/core";
import { ensureIntegrationAndAccount } from "@/server/db/ensure";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");

    if (!code) {
      return NextResponse.json({ error: "Missing code parameter" }, { status: 400 });
    }

    // State format: "pluginId" or "pluginId:origin" (e.g., "gmail:signup")
    const rawState = url.searchParams.get("state") || "";
    const [pluginId, origin] = rawState.split(":");

    if (pluginId !== "gmail" && pluginId !== "googlecalendar") {
      return NextResponse.json({ error: "Invalid state parameter" }, { status: 400 });
    }

    // 1. Ensure integration and account exist in DB
    await ensureIntegrationAndAccount(pluginId);

    // 2. Get client_id, client_secret, and redirect_url from DB
    let clientId: string | null = null;
    let clientSecret: string | null = null;
    let redirectUrl: string | null = null;

    if (pluginId === "gmail") {
      clientId = await corsair.keys.gmail.get_client_id();
      clientSecret = await corsair.keys.gmail.get_client_secret();
      redirectUrl = await corsair.keys.gmail.get_redirect_url();
    } else {
      clientId = await corsair.keys.googlecalendar.get_client_id();
      clientSecret = await corsair.keys.googlecalendar.get_client_secret();
      redirectUrl = await corsair.keys.googlecalendar.get_redirect_url();
    }

    if (!clientId || !clientSecret) {
      return NextResponse.json({ error: `Client credentials not configured for ${pluginId}` }, { status: 400 });
    }

    // 3. Resolve OAuth config from the plugin
    const pluginObj = pluginId === "gmail" ? gmail() : googlecalendar();
    const oauthCfg = pluginObj.oauthConfig;

    if (!oauthCfg) {
      return NextResponse.json({ error: `No oauthConfig found for ${pluginId}` }, { status: 500 });
    }

    // 4. Exchange code for tokens
    const redirectUri = redirectUrl || "http://localhost:3000/api/auth/callback";
    const tokens = await exchangeCodeForTokens(code, clientId, clientSecret, oauthCfg, redirectUri);

    if (!tokens.access_token) {
      return NextResponse.json({ error: "Failed to exchange code for access token" }, { status: 500 });
    }

    // 5. Store tokens in account key manager
    if (pluginId === "gmail") {
      await corsair.gmail.keys.set_access_token(tokens.access_token);
      if (tokens.refresh_token) {
        await corsair.gmail.keys.set_refresh_token(tokens.refresh_token);
      }
      if (tokens.expires_in) {
        const expiresAt = (Math.floor(Date.now() / 1000) + tokens.expires_in).toString();
        await corsair.gmail.keys.set_expires_at(expiresAt);
      }
    } else {
      await corsair.googlecalendar.keys.set_access_token(tokens.access_token);
      if (tokens.refresh_token) {
        await corsair.googlecalendar.keys.set_refresh_token(tokens.refresh_token);
      }
      if (tokens.expires_in) {
        const expiresAt = (Math.floor(Date.now() / 1000) + tokens.expires_in).toString();
        await corsair.googlecalendar.keys.set_expires_at(expiresAt);
      }
    }

    // Redirect based on origin
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const redirectBase = origin === "signup" ? "/signup" : "/dashboard";
    return NextResponse.redirect(`${appUrl}${redirectBase}?connected=${pluginId}`);
  } catch (error: any) {
    console.error("OAuth Callback Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
