import { NextResponse } from "next/server";
import { corsair } from "@/server/corsair";
import { ensureIntegrationAndAccount } from "@/server/db/ensure";

export async function GET() {
  try {
    await ensureIntegrationAndAccount("gmail");
    await ensureIntegrationAndAccount("googlecalendar");

    const gmailClientId = await corsair.keys.gmail.get_client_id();
    const gmailClientSecret = await corsair.keys.gmail.get_client_secret();
    const gmailRedirectUrl = await corsair.keys.gmail.get_redirect_url();

    const calendarClientId = await corsair.keys.googlecalendar.get_client_id();
    const calendarClientSecret = await corsair.keys.googlecalendar.get_client_secret();
    const calendarRedirectUrl = await corsair.keys.googlecalendar.get_redirect_url();

    let gmailConnected = false;
    let gmailEmailAddress = "";
    let calendarConnected = false;
    try {
      const gmailToken = await corsair.gmail.keys.get_access_token();
      gmailConnected = !!gmailToken;
      if (gmailConnected) {
        const profileRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
          headers: { Authorization: `Bearer ${gmailToken}` },
        });
        if (profileRes.ok) {
          const profile = await profileRes.json();
          gmailEmailAddress = profile.emailAddress || "";
        }
      }
    } catch {}

    try {
      const calendarToken = await corsair.googlecalendar.keys.get_access_token();
      calendarConnected = !!calendarToken;
    } catch {}

    return NextResponse.json({
      gmail: {
        clientId: gmailClientId || "",
        clientSecret: gmailClientSecret ? "••••••••" : "",
        redirectUrl: gmailRedirectUrl || "",
        connected: gmailConnected,
        emailAddress: gmailEmailAddress,
      },
      googlecalendar: {
        clientId: calendarClientId || "",
        clientSecret: calendarClientSecret ? "••••••••" : "",
        redirectUrl: calendarRedirectUrl || "",
        connected: calendarConnected,
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await ensureIntegrationAndAccount("gmail");
    await ensureIntegrationAndAccount("googlecalendar");

    const { gmail, googlecalendar: calendar } = await req.json();

    if (gmail) {
      if (gmail.clientId) await corsair.keys.gmail.set_client_id(gmail.clientId);
      if (gmail.clientSecret) await corsair.keys.gmail.set_client_secret(gmail.clientSecret);
      await corsair.keys.gmail.set_redirect_url(gmail.redirectUrl || "http://localhost:3000/api/auth/callback");
    }

    if (calendar) {
      if (calendar.clientId) await corsair.keys.googlecalendar.set_client_id(calendar.clientId);
      if (calendar.clientSecret) await corsair.keys.googlecalendar.set_client_secret(calendar.clientSecret);
      await corsair.keys.googlecalendar.set_redirect_url(calendar.redirectUrl || "http://localhost:3000/api/auth/callback");
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
