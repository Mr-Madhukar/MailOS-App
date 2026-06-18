export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/server/corsair";
import { corsairAccounts } from "@/server/db/schema";
import { cookies } from "next/headers";
import { verifyJwt } from "@/lib/jwt";
import { getEmbedding } from "@/lib/embeddings";
import { eq, sql } from "drizzle-orm";

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

    const url = new URL(req.url);
    const query = url.searchParams.get("q");

    if (!query) {
      return NextResponse.json({ success: true, results: [] });
    }

    console.log(`[Semantic Search] Generating embedding for query: "${query}"`);
    const queryEmbedding = await getEmbedding(query);

    // Get the user's account IDs
    const userAccounts = await db
      .select({ id: corsairAccounts.id })
      .from(corsairAccounts)
      .where(eq(corsairAccounts.tenantId, userId));

    const accountIds = userAccounts.map((a) => a.id);

    if (accountIds.length === 0) {
      return NextResponse.json({ success: true, results: [] });
    }

    console.log(`[Semantic Search] Querying pgvector for user ${userId} across accounts:`, accountIds);

    // Perform pgvector cosine similarity search
    const dbResults = await db.execute(sql`
      SELECT id, entity_id, entity_type, data,
             1 - (embedding <=> ${JSON.stringify(queryEmbedding)}::vector) as similarity
      FROM corsair_entities
      WHERE account_id = ANY(${accountIds})
        AND embedding IS NOT NULL
        AND (1 - (embedding <=> ${JSON.stringify(queryEmbedding)}::vector)) > 0.1
      ORDER BY embedding <=> ${JSON.stringify(queryEmbedding)}::vector
      LIMIT 25
    `);

    const rows = dbResults.rows as any[];

    const formattedResults = rows.map((row) => {
      const data = row.data;
      const similarity = parseFloat(row.similarity);

      if (row.entity_type === "messages") {
        // Format Email
        const headers = data.payload?.headers || [];
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
          type: "email",
          id: row.entity_id,
          from: fromHeader,
          subject: subjectHeader,
          snippet: data.snippet || "",
          date: displayDate,
          priority: data.priority || "low",
          unread: data.labelIds?.includes("UNREAD") || false,
          labelIds: data.labelIds || [],
          similarity,
        };
      } else {
        // Format Calendar Event
        const startDateTime = data.start?.dateTime || data.start?.date || "";
        const endDateTime = data.end?.dateTime || data.end?.date || "";
        
        let startStr = "";
        let endStr = "";
        let timeRaw = "All day";
        let dateGroup = "today";

        if (startDateTime) {
          const startD = new Date(startDateTime);
          const endD = endDateTime ? new Date(endDateTime) : null;
          
          const today = new Date();
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);

          if (startD.getDate() === tomorrow.getDate() && startD.getMonth() === tomorrow.getMonth()) {
            dateGroup = "tomorrow";
          }

          if (data.start?.dateTime) {
            startStr = startD.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
            if (endD && data.end?.dateTime) {
              endStr = endD.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
              timeRaw = `${startStr} – ${endStr}`;
            } else {
              timeRaw = startStr;
            }
          }
        }

        let eventType = "alert";
        let details = data.location || "";
        let color = "#378add";

        if (data.hangoutLink) {
          eventType = "video";
          details = "Google Meet";
          color = "#1d9e75";
        } else if (data.attendees && data.attendees.length > 0) {
          eventType = "users";
          details = data.attendees
            .map((a: any) => a.displayName || a.email?.split("@")[0] || "")
            .slice(0, 2)
            .join(", ") + (data.attendees.length > 2 ? " + team" : "");
          color = "#7c6af7";
        }

        return {
          type: "event",
          id: row.entity_id,
          summary: data.summary || "Untitled Event",
          start: startStr,
          end: endStr,
          timeRaw,
          date: dateGroup,
          eventType,
          details,
          color,
          startDateTime,
          endDateTime,
          similarity,
        };
      }
    });

    return NextResponse.json({
      success: true,
      results: formattedResults,
    });
  } catch (error: any) {
    console.error("Semantic Search API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
