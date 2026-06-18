export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { corsair } from "@/server/corsair";
import { cookies } from "next/headers";
import { verifyJwt } from "@/lib/jwt";

export async function GET(req: Request) {
  try {
    // Authenticate user
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

    const url = new URL(req.url);
    const from = url.searchParams.get("from") || undefined;
    const subject = url.searchParams.get("subject") || undefined;
    const snippet = url.searchParams.get("snippet") || undefined;
    const priority = url.searchParams.get("priority") || undefined;
    const unread = url.searchParams.get("unread");

    // Build the search options matching Corsair's DB search shape
    const searchOptions: any = {
      data: {},
      limit: 100,
    };

    if (from) {
      searchOptions.data.from = { contains: from };
    }
    if (subject) {
      searchOptions.data.subject = { contains: subject };
    }
    if (snippet) {
      searchOptions.data.snippet = { contains: snippet };
    }
    if (priority && priority !== "all") {
      searchOptions.data.priority = priority;
    }
    if (unread !== null && unread !== undefined && unread !== "all") {
      searchOptions.data.labelIds = unread === "true" ? { contains: "UNREAD" } : undefined;
    }

    console.log(`[Advanced Search] Querying local DB for user ${userId} with:`, searchOptions.data);

    // Call Corsair's search API
    const cachedEntities = await userCorsair.gmail.db.messages.search(searchOptions);

    // Format events for UI
    const formattedEmails = cachedEntities.map((item: any) => {
      const details = item.data;
      const headers = details.payload?.headers || [];
      const fromHeader = headers.find((h: any) => h.name?.toLowerCase() === "from")?.value || "Unknown";
      const subjectHeader = headers.find((h: any) => h.name?.toLowerCase() === "subject")?.value || "No Subject";
      const dateHeader = headers.find((h: any) => h.name?.toLowerCase() === "date")?.value || "";

      // Format Date
      let displayDate = "Just now";
      if (dateHeader) {
        try {
          const dateObj = new Date(dateHeader);
          const diffMs = Date.now() - dateObj.getTime();
          const diffMins = Math.floor(diffMs / 60000);
          const diffHours = Math.floor(diffMins / 60);

          if (diffMins < 60) {
            displayDate = diffMins <= 0 ? "Just now" : `${diffMins}m ago`;
          } else if (diffHours < 24) {
            displayDate = `${diffHours}h ago`;
          } else {
            displayDate = dateObj.toLocaleDateString(undefined, { month: "short", day: "numeric" });
          }
        } catch {
          displayDate = dateHeader;
        }
      }

      return {
        id: item.entityId,
        from: fromHeader,
        subject: subjectHeader,
        snippet: details.snippet || "",
        date: displayDate,
        priority: details.priority || "low",
        unread: details.labelIds?.includes("UNREAD") || false,
        labelIds: details.labelIds || [],
      };
    });

    return NextResponse.json({
      success: true,
      emails: formattedEmails,
    });
  } catch (error: any) {
    console.error("Advanced Search API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
