import { NextResponse } from "next/server";
import { corsair } from "@/server/corsair";
import { gmail } from "@corsair-dev/gmail";
import { googlecalendar } from "@corsair-dev/googlecalendar";
import { ensureIntegrationAndAccount } from "@/server/db/ensure";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const pluginId = url.searchParams.get("plugin");

    if (pluginId !== "gmail" && pluginId !== "googlecalendar") {
      return NextResponse.json({ error: "Invalid or missing plugin ID" }, { status: 400 });
    }

    await ensureIntegrationAndAccount(pluginId);

    let clientId: string | null = null;
    let redirectUrl: string | null = null;

    if (pluginId === "gmail") {
      clientId = await corsair.keys.gmail.get_client_id();
      redirectUrl = await corsair.keys.gmail.get_redirect_url();
    } else {
      clientId = await corsair.keys.googlecalendar.get_client_id();
      redirectUrl = await corsair.keys.googlecalendar.get_redirect_url();
    }

    if (!clientId) {
      return NextResponse.json({
        error: `Client ID not configured for ${pluginId}. Please configure it in Settings.`
      }, { status: 400 });
    }

    const pluginObj = pluginId === "gmail" ? gmail() : googlecalendar();
    const oauthCfg = pluginObj.oauthConfig;

    if (!oauthCfg) {
      return NextResponse.json({ error: `No oauthConfig found for ${pluginId}` }, { status: 500 });
    }

    const redirectUri = redirectUrl || "http://localhost:3000/api/auth/callback";
    
    // Build parameters explicitly
    const authParams: Record<string, string> = {
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: oauthCfg.scopes.join(" "),
      state: pluginId,
    };

    if (oauthCfg.authParams) {
      for (const [k, v] of Object.entries(oauthCfg.authParams)) {
        authParams[k] = v;
      }
    }

    const authUrl = `${oauthCfg.authUrl}?${new URLSearchParams(authParams).toString()}`;

    return NextResponse.json({ url: authUrl });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
