export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { processWebhook } from "corsair";
import { corsair, db } from "@/server/corsair";
import { corsairEntities } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { classifyEmailPriority } from "@/lib/priority";
import { getEmbedding } from "@/lib/embeddings";

export async function POST(req: Request) {
  try {
    const headers = Object.fromEntries(req.headers.entries());
    let body: any;
    
    // Read raw body first to log or parse
    const rawBody = await req.text();
    try {
      body = JSON.parse(rawBody);
    } catch {
      body = rawBody;
    }

    const url = new URL(req.url);
    const tenantId = url.searchParams.get("tenantId") || undefined;

    console.log(`[Webhook] Incoming webhook for tenant: ${tenantId}`);

    // Call Corsair to process and verify the webhook
    const result = await processWebhook(corsair, headers, body, { tenantId });

    if (!result.plugin) {
      console.log("[Webhook] Webhook did not match any plugin");
      return NextResponse.json(result.response || { success: true });
    }

    console.log(`[Webhook] Handled by ${result.plugin}.${result.action}`);

    // Post-processing: Generate embeddings and determine priority level
    const responsePayload = result.response as any;
    
    if (result.plugin === "gmail" && responsePayload?.success && responsePayload?.corsairEntityId) {
      const entityId = responsePayload.corsairEntityId;
      const msg = responsePayload.data?.message;

      if (msg) {
        const msgHeaders = msg.payload?.headers || [];
        const fromHeader = msgHeaders.find((h: any) => h.name?.toLowerCase() === "from")?.value || "Unknown";
        const subjectHeader = msgHeaders.find((h: any) => h.name?.toLowerCase() === "subject")?.value || "No Subject";
        const snippet = msg.snippet || "";

        console.log(`[Webhook] Classifying and embedding new email: "${subjectHeader}"`);

        // Run LLM classification and generate embedding concurrently
        const [priority, embedding] = await Promise.all([
          classifyEmailPriority(fromHeader, subjectHeader, snippet),
          getEmbedding(`From: ${fromHeader}\nSubject: ${subjectHeader}\nSnippet: ${snippet}`),
        ]);

        // Fetch current entity data to merge
        const existing = await db
          .select()
          .from(corsairEntities)
          .where(eq(corsairEntities.id, entityId))
          .then((rows) => rows[0]);

        if (existing) {
          const updatedData = { ...(existing.data as any), priority };
          await db
            .update(corsairEntities)
            .set({
              data: updatedData,
              embedding,
              updatedAt: new Date(),
            })
            .where(eq(corsairEntities.id, entityId));
          console.log(`[Webhook] Email updated: id=${entityId}, priority=${priority}`);
        }
      }
    } else if (result.plugin === "googlecalendar" && responsePayload?.success && responsePayload?.corsairEntityId) {
      const entityId = responsePayload.corsairEntityId;
      const event = responsePayload.data?.event;

      if (event) {
        const summary = event.summary || "Untitled Event";
        const description = event.description || "";
        const location = event.location || "";

        console.log(`[Webhook] Embedding new calendar event: "${summary}"`);

        const embeddingText = `Event: ${summary}\nDescription: ${description}\nLocation: ${location}`;
        const embedding = await getEmbedding(embeddingText);

        await db
          .update(corsairEntities)
          .set({
            embedding,
            updatedAt: new Date(),
          })
          .where(eq(corsairEntities.id, entityId));
        console.log(`[Webhook] Calendar event updated: id=${entityId}`);
      }
    }

    return NextResponse.json(result.response || { success: true });
  } catch (error: any) {
    console.error("[Webhook Error]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
