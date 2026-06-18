export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { corsair } from "@/server/corsair";
import { cookies } from "next/headers";
import { verifyJwt } from "@/lib/jwt";

export async function POST(req: Request) {
  try {
    const token = cookies().get("mailos_token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const payload = verifyJwt(token);
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const userId = payload.userId;
    const { plugin } = await req.json();

    if (plugin !== "gmail" && plugin !== "googlecalendar") {
      return NextResponse.json({ error: "Invalid plugin name" }, { status: 400 });
    }

    const userCorsair = corsair.withTenant(userId);
    
    if (plugin === "gmail") {
      await userCorsair.gmail.keys.set_access_token("");
      await userCorsair.gmail.keys.set_refresh_token("");
      await userCorsair.gmail.keys.set_expires_at("");
    } else {
      await userCorsair.googlecalendar.keys.set_access_token("");
      await userCorsair.googlecalendar.keys.set_refresh_token("");
      await userCorsair.googlecalendar.keys.set_expires_at("");
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Disconnect API Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
