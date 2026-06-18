export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { corsair, db } from "@/server/corsair";
import { gmail } from "@corsair-dev/gmail";
import { googlecalendar } from "@corsair-dev/googlecalendar";
import { exchangeCodeForTokens } from "corsair/core";
import { ensureIntegrationAndAccount } from "@/server/db/ensure";
import { users } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { signJwt, verifyJwt } from "@/lib/jwt";
import { cookies } from "next/headers";
import crypto from "crypto";
import { registerCalendarWatch, registerGmailWatch } from "@/lib/watch";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const pluginId = url.searchParams.get("state"); // We stored the pluginId in state

    if (!code || !pluginId) {
      return NextResponse.json({ error: "Missing code or state parameter" }, { status: 400 });
    }

    if (pluginId === "google_login" || pluginId === "google-login") {
      // Dynamically detect Google login redirect URI from the incoming request URL
      let googleRedirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI || "http://localhost:3000/api/auth/callback";
      try {
        const currentUrl = new URL(req.url);
        if (currentUrl.hostname === "localhost") {
          googleRedirectUri = "http://localhost:3000/api/auth/callback";
        } else {
          googleRedirectUri = `${currentUrl.origin}/api/auth/callback`;
        }
      } catch {}

      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
          client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
          redirect_uri: googleRedirectUri,
          grant_type: "authorization_code",
        }),
      });

      const tokens = await tokenResponse.json();
      if (!tokens.access_token) {
        return NextResponse.json({ error: "Failed to exchange code for tokens", details: tokens }, { status: 500 });
      }

      // 2. Fetch user profile
      const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const userInfo = await userInfoResponse.json();

      if (!userInfo.email) {
        return NextResponse.json({ error: "Failed to retrieve user email from Google" }, { status: 500 });
      }

      const email = userInfo.email.toLowerCase().trim();
      const name = userInfo.name || userInfo.given_name || "Google User";

      // 3. Find or register user
      let user = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .then((rows) => rows[0]);

      if (!user) {
        const userId = crypto.randomUUID();
        await db.insert(users).values({
          id: userId,
          email,
          name,
          passwordHash: "", // Google accounts do not use password logins by default
        });
        user = {
          id: userId,
          email,
          name,
          passwordHash: "",
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }

      // 4. Generate JWT (valid for 7 days)
      const token = signJwt({
        userId: user.id,
        email: user.email,
        name: user.name,
        exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
      });

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const response = NextResponse.redirect(`${appUrl}/dashboard`);

      // 5. Set session cookie
      response.cookies.set("mailos_token", token, {
        httpOnly: true,
        path: "/",
        maxAge: 7 * 24 * 60 * 60,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });

      return response;
    }

    if (pluginId !== "gmail" && pluginId !== "googlecalendar") {
      return NextResponse.json({ error: "Invalid state parameter" }, { status: 400 });
    }

    const token = cookies().get("mailos_token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const payload = verifyJwt(token);
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = payload.userId;

    // 1. Ensure integration and account exist in DB
    await ensureIntegrationAndAccount(pluginId, userId);

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

    // 4. Exchange code for tokens (dynamically computed to handle Vercel vs localhost mismatches)
    let redirectUri = redirectUrl;
    try {
      const currentUrl = new URL(req.url);
      if (redirectUrl) {
        const configRedirect = new URL(redirectUrl);
        if (currentUrl.host !== configRedirect.host) {
          redirectUri = `${currentUrl.origin}/api/auth/callback`;
        }
      }
    } catch {}

    if (!redirectUri) {
      redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI || "http://localhost:3000/api/auth/callback";
    }

    const tokens = await exchangeCodeForTokens(code, clientId, clientSecret, oauthCfg, redirectUri);

    if (!tokens.access_token) {
      return NextResponse.json({ error: "Failed to exchange code for access token" }, { status: 500 });
    }

    // 5. Store tokens in account key manager
    const userCorsair = corsair.withTenant(userId);
    if (pluginId === "gmail") {
      await userCorsair.gmail.keys.set_access_token(tokens.access_token);
      if (tokens.refresh_token) {
        await userCorsair.gmail.keys.set_refresh_token(tokens.refresh_token);
      }
      if (tokens.expires_in) {
        const expiresAt = (Math.floor(Date.now() / 1000) + tokens.expires_in).toString();
        await userCorsair.gmail.keys.set_expires_at(expiresAt);
      }
      // Register Gmail push notifications (optional Pub/Sub topic)
      registerGmailWatch(tokens.access_token).catch(err => {
        console.error("Failed to register Gmail watch:", err);
      });
    } else {
      await userCorsair.googlecalendar.keys.set_access_token(tokens.access_token);
      if (tokens.refresh_token) {
        await userCorsair.googlecalendar.keys.set_refresh_token(tokens.refresh_token);
      }
      if (tokens.expires_in) {
        const expiresAt = (Math.floor(Date.now() / 1000) + tokens.expires_in).toString();
        await userCorsair.googlecalendar.keys.set_expires_at(expiresAt);
      }
      // Register Calendar webhook watch channel
      registerCalendarWatch(userId, tokens.access_token).catch(err => {
        console.error("Failed to register Calendar watch:", err);
      });
    }

    // Redirect to dashboard page
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    return NextResponse.redirect(`${appUrl}/dashboard?connected=${pluginId}`);
  } catch (error: any) {
    console.error("OAuth Callback Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
