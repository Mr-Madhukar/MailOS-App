import { NextResponse } from "next/server";
import { corsair } from "@/server/corsair";

// GET /api/emails/:id — Fetch a single email with full body
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    let isConnected = false;
    try {
      const accessToken = await corsair.gmail.keys.get_access_token();
      isConnected = !!accessToken;
    } catch {}

    if (!isConnected) {
      // Return mock email detail for demo mode
      return NextResponse.json({
        demo: true,
        email: {
          id,
          from: "Demo Sender",
          subject: "Demo Email",
          body: "<p>This is a demo email. Connect your Gmail account to see real emails.</p>",
          snippet: "This is a demo email...",
          date: "Just now",
          priority: "low",
          unread: false,
          labelIds: ["INBOX"],
        },
      });
    }

    const details = await corsair.gmail.api.messages.get({
      id,
      format: "full",
    });

    const headers = details.payload?.headers || [];
    const fromHeader =
      headers.find((h) => h.name?.toLowerCase() === "from")?.value || "Unknown";
    const subjectHeader =
      headers.find((h) => h.name?.toLowerCase() === "subject")?.value ||
      "No Subject";
    const dateHeader =
      headers.find((h) => h.name?.toLowerCase() === "date")?.value || "";

    // Extract body
    let body = "";
    if (details.payload?.body?.data) {
      body = Buffer.from(details.payload.body.data, "base64").toString("utf-8");
    } else if (details.payload?.parts) {
      const htmlPart = details.payload.parts.find(
        (p) => p.mimeType === "text/html"
      );
      const textPart = details.payload.parts.find(
        (p) => p.mimeType === "text/plain"
      );
      const part = htmlPart || textPart;
      if (part?.body?.data) {
        body = Buffer.from(part.body.data, "base64").toString("utf-8");
      }
    }

    return NextResponse.json({
      demo: false,
      email: {
        id: details.id,
        threadId: details.threadId,
        from: fromHeader,
        subject: subjectHeader,
        body,
        snippet: details.snippet || "",
        date: dateHeader,
        labelIds: details.labelIds || [],
        unread: details.labelIds?.includes("UNREAD") || false,
      },
    });
  } catch (error: any) {
    console.error("Fetch Email Detail Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/emails/:id — Modify email labels (archive, star, read)
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { action } = await req.json();

    let isConnected = false;
    try {
      const accessToken = await corsair.gmail.keys.get_access_token();
      isConnected = !!accessToken;
    } catch {}

    if (!isConnected) {
      return NextResponse.json({ demo: true, success: true });
    }

    let addLabelIds: string[] = [];
    let removeLabelIds: string[] = [];

    switch (action) {
      case "archive":
        removeLabelIds = ["INBOX"];
        break;
      case "unarchive":
        addLabelIds = ["INBOX"];
        break;
      case "star":
        addLabelIds = ["STARRED"];
        break;
      case "unstar":
        removeLabelIds = ["STARRED"];
        break;
      case "markRead":
        removeLabelIds = ["UNREAD"];
        break;
      case "markUnread":
        addLabelIds = ["UNREAD"];
        break;
      default:
        return NextResponse.json(
          { error: "Invalid action" },
          { status: 400 }
        );
    }

    await corsair.gmail.api.messages.modify({
      id,
      addLabelIds,
      removeLabelIds,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Modify Email Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/emails/:id — Trash an email
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    let isConnected = false;
    try {
      const accessToken = await corsair.gmail.keys.get_access_token();
      isConnected = !!accessToken;
    } catch {}

    if (!isConnected) {
      return NextResponse.json({ demo: true, success: true });
    }

    await corsair.gmail.api.messages.trash({ id });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Delete Email Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
