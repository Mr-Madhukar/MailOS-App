import { NextResponse } from "next/server";
import { corsair } from "@/server/corsair";
import { cookies } from "next/headers";
import { verifyJwt } from "@/lib/jwt";

// POST /api/emails/:id/reply — Reply to an email
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { body } = await req.json();

    if (!body) {
      return NextResponse.json(
        { error: "Reply body is required" },
        { status: 400 }
      );
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

    const userCorsair = corsair.withTenant(userId);

    let isConnected = false;
    try {
      const accessToken = await userCorsair.gmail.keys.get_access_token();
      isConnected = !!accessToken;
    } catch {}

    if (!isConnected) {
      return NextResponse.json({ demo: true, success: true });
    }

    // Get original message details for reply headers (omit metadataHeaders to avoid comma-joining bug)
    const original = await userCorsair.gmail.api.messages.get({
      id,
      format: "metadata",
    });

    const headers = original.payload?.headers || [];
    const fromHeader = headers.find((h) => h.name?.toLowerCase() === "from")?.value || "";
    const subjectHeader = headers.find((h) => h.name?.toLowerCase() === "subject")?.value || "";
    const messageId = headers.find((h) => h.name?.toLowerCase() === "message-id")?.value || "";
    const references = headers.find((h) => h.name?.toLowerCase() === "references")?.value || "";

    const replySubject = subjectHeader.startsWith("Re:") ? subjectHeader : `Re: ${subjectHeader}`;

    // Build the raw email
    const rawEmail = [
      `To: ${fromHeader}`,
      `Subject: ${replySubject}`,
      `In-Reply-To: ${messageId}`,
      `References: ${references ? `${references} ${messageId}` : messageId}`,
      "Content-Type: text/plain; charset=utf-8",
      "",
      body,
    ].join("\r\n");

    const encodedMessage = Buffer.from(rawEmail)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    await userCorsair.gmail.api.messages.send({
      raw: encodedMessage,
      threadId: original.threadId,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Reply Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
