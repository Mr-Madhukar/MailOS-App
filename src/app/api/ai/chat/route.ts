// @ts-nocheck
import { streamText, tool, stepCountIs } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { z } from "zod";
import { cookies } from "next/headers";
import { verifyJwt } from "@/lib/jwt";
import { corsair, getFreshGmailAccessToken } from "@/server/corsair";

// Initialize OpenRouter provider
const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

// System prompt that gives the AI full context about MailOS
const SYSTEM_PROMPT = `You are the MailOS AI Assistant — a smart, concise, and helpful email & calendar agent embedded in a keyboard-first productivity app.

## Your Capabilities
You can perform real actions on the user's behalf:
- **Send emails** via Gmail
- **Create calendar events** on Google Calendar
- **Search and list emails** from the inbox
- **List upcoming calendar events**
- **Archive emails**
- **Star/unstar emails**

## Your Personality
- Be concise and direct. No fluff.
- Use clean formatting with bullet points and bold text when listing things.
- When you perform an action (send email, create event), confirm what you did clearly.
- If information is missing (e.g., no recipient for an email), ask for it politely.
- Always respond in a professional but friendly tone.

## Important Rules
- When sending an email, always confirm the recipient, subject, and a brief summary of the body before sending.
- When creating a calendar event, confirm the title, date/time, and any attendees.
- For date/time references like "tomorrow", "next Monday", etc., use the current date context provided.
- Never make up email addresses — always ask if not provided.
- If Gmail or Calendar is not connected, let the user know they need to connect it in Settings.

## Current Context
- Current date/time: ${new Date().toLocaleString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" })}
- Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}
- App: MailOS — Keyboard-First AI Command Center
- Platform: Web (Next.js)

## IMPORTANT: DateTime Format for Calendar Events
When creating calendar events, ALWAYS generate dateTime values in full ISO 8601 format with timezone offset. Example: "2026-06-25T09:00:00+05:30". NEVER omit the timezone offset.`;

export async function POST(req: Request) {
  try {
    // Authenticate user
    const token = cookies().get("mailos_token")?.value;
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    const payload = verifyJwt(token);
    if (!payload || !payload.userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    const userId = payload.userId;
    const userCorsair = corsair.withTenant(userId);

    // Parse request body
    const { messages } = await req.json();

    // Check connection status for context
    let gmailConnected = false;
    let calendarConnected = false;
    let gmailAccessToken: string | null = null;
    let calendarAccessToken: string | null = null;

    try {
      gmailAccessToken = await getFreshGmailAccessToken(userId);
      gmailConnected = !!gmailAccessToken;
    } catch {}

    try {
      calendarAccessToken = await userCorsair.googlecalendar.keys.get_access_token();
      calendarConnected = !!calendarAccessToken;
    } catch {}

    // Define tools the AI can use
    const aiTools = {
      send_email: tool({
        description:
          "Send an email via Gmail. Use this when the user asks to send, compose, or draft an email to someone.",
        parameters: z.object({
          to: z.string().optional().describe("Recipient email address"),
          subject: z.string().optional().describe("Email subject line"),
          body: z.string().optional().describe("Email body content in plain text"),
        }).passthrough(),
        execute: async (args: any) => {
          if (!gmailConnected || !gmailAccessToken) {
            return {
              success: false,
              error: "Gmail is not connected. Please connect Gmail in Settings first.",
            };
          }
          try {
            // Resolve parameters dynamically supporting variations
            const to = args.to || args.recipient || args.email || args.toEmail;
            const subject = args.subject || args.title || "No Subject";
            const body = args.body || args.message || args.content || "";

            if (!to) {
              return {
                success: false,
                error: "Failed to send email: Recipient email address is required.",
              };
            }

            // Extract the first valid email address from the to field in case the model included extra text
            const emailMatch = to.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
            const cleanTo = emailMatch ? emailMatch[0] : to;

            // Fetch the user's email address for the From header (required by Gmail API)
            let fromEmail = "";
            try {
              const profileRes = await fetch(
                "https://gmail.googleapis.com/gmail/v1/users/me/profile",
                { headers: { Authorization: `Bearer ${gmailAccessToken}` } }
              );
              if (profileRes.ok) {
                const profile = await profileRes.json();
                fromEmail = profile.emailAddress || "";
              }
            } catch {}

            const headers = [
              `To: ${cleanTo}`,
              `Subject: ${subject}`,
              "MIME-Version: 1.0",
              "Content-Type: text/plain; charset=utf-8",
            ];
            if (fromEmail) {
              headers.unshift(`From: ${fromEmail}`);
            }

            const rawEmail = [...headers, "", body || ""].join("\r\n");

            const encodedMessage = Buffer.from(rawEmail)
              .toString("base64")
              .replace(/\+/g, "-")
              .replace(/\//g, "_")
              .replace(/=+$/, "");

            await userCorsair.gmail.api.messages.send({
              raw: encodedMessage,
            });

            return {
              success: true,
              message: `Email sent to ${cleanTo} with subject "${subject}"`,
            };
          } catch (error: any) {
            const detail = error.body ? JSON.stringify(error.body) : error.message;
            console.error("AI send_email error detail:", detail, error);
            return {
              success: false,
              error: `Failed to send email: ${detail}`,
            };
          }
        },
      }),

      create_event: tool({
        description:
          "Create a Google Calendar event. Use when the user asks to schedule a meeting, create an event, or add something to their calendar.",
        parameters: z.object({
          summary: z.string().optional().describe("Event title"),
          startDateTime: z
            .string()
            .optional()
            .describe("Start date/time in ISO 8601 format with timezone offset (e.g., 2026-06-19T15:00:00+05:30). MUST include timezone offset."),
          endDateTime: z
            .string()
            .optional()
            .describe("Optional end date/time in ISO 8601 format. If missing or invalid, defaults to 1 hour after startDateTime."),
          description: z.string().optional().default("").describe("Optional event description"),
          attendees: z
            .array(z.string())
            .optional()
            .default([])
            .describe("Optional array of attendee email addresses"),
        }).passthrough(),
        execute: async (args: any) => {
          if (!calendarConnected) {
            return {
              success: false,
              error:
                "Google Calendar is not connected. Please connect Calendar in Settings first.",
            };
          }
          try {
            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

            // Resolve the event parameters dynamically supporting both camelCase and snake_case naming conventions
            const summary = args.summary || args.title || "Meeting";
            const startDateTime = args.startDateTime || args.start_time || args.startTime;
            const endDateTime = args.endDateTime || args.end_time || args.endTime;
            const description = args.description || "";
            const attendees = args.attendees || [];

            // Helper to parse date/time string robustly
            const parseToDate = (dt: string): Date | null => {
              if (!dt) return null;
              const parsed = new Date(dt);
              return isNaN(parsed.getTime()) ? null : parsed;
            };

            const start = parseToDate(startDateTime);
            if (!start) {
              return {
                success: false,
                error: `Failed to create event: Invalid start date/time "${startDateTime}"`,
              };
            }

            let end = parseToDate(endDateTime || "");
            // Default end to 1 hour after start if missing, invalid, or before/equal to start
            if (!end || end.getTime() <= start.getTime()) {
              end = new Date(start.getTime() + 60 * 60 * 1000);
            }

            const eventBody: any = {
              summary,
              description: description || "",
              start: {
                dateTime: start.toISOString(),
                timeZone: tz,
              },
              end: {
                dateTime: end.toISOString(),
                timeZone: tz,
              },
            };

            if (attendees && attendees.length > 0) {
              eventBody.attendees = attendees.map((email: string) => ({ email }));
            }

            console.log("[AI create_event] Creating event with body:", JSON.stringify(eventBody));

            const result = await userCorsair.googlecalendar.api.events.create({
              calendarId: "primary",
              event: eventBody,
            });

            return {
              success: true,
              message: `Event "${summary}" created on ${new Date(start).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} at ${new Date(start).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`,
              eventId: result?.id,
            };
          } catch (error: any) {
            const detail = error.body ? JSON.stringify(error.body) : error.message;
            console.error("AI create_event error detail:", detail, error);
            return {
              success: false,
              error: `Failed to create event: ${detail}`,
            };
          }
        },
      }),

      list_emails: tool({
        description:
          "List recent emails from the inbox. Use when the user asks about their emails, wants a summary, or asks what's in their inbox.",
        parameters: z.object({
          maxResults: z
            .number()
            .optional()
            .default(10)
            .describe("Maximum number of emails to fetch (default 10)"),
        }),
        execute: async ({ maxResults }) => {
          if (!gmailConnected || !gmailAccessToken) {
            return {
              success: false,
              error: "Gmail is not connected. Showing demo data.",
              demo: true,
              emails: [
                { from: "Dev Kumar", subject: "Re: MCP integration", snippet: "Just reviewed the new schemas...", date: "2m ago" },
                { from: "Priya Sharma", subject: "Hackathon submission", snippet: "Reminder that portal closes tomorrow...", date: "18m ago" },
                { from: "GitHub", subject: "[mailos] PR #14 approved", snippet: "corsairdev approved pull request...", date: "1h ago" },
              ],
            };
          }
          try {
            const listRes = await fetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}`,
              { headers: { Authorization: `Bearer ${gmailAccessToken}` } }
            );

            if (!listRes.ok) throw new Error(`Gmail API failed: ${listRes.status}`);

            const listData = await listRes.json();
            const messageIds = listData.messages || [];

            // Fetch details for each (limited concurrency)
            const emails = await Promise.all(
              messageIds.slice(0, maxResults).map(async (msg: any) => {
                try {
                  const res = await fetch(
                    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata`,
                    { headers: { Authorization: `Bearer ${gmailAccessToken}` } }
                  );
                  const details = await res.json();
                  const headers = details.payload?.headers || [];
                  const from =
                    headers.find((h: any) => h.name?.toLowerCase() === "from")?.value || "Unknown";
                  const subject =
                    headers.find((h: any) => h.name?.toLowerCase() === "subject")?.value ||
                    "No Subject";

                  return {
                    id: msg.id,
                    from,
                    subject,
                    snippet: details.snippet || "",
                    unread: details.labelIds?.includes("UNREAD") || false,
                  };
                } catch {
                  return { id: msg.id, from: "Unknown", subject: "Error loading", snippet: "" };
                }
              })
            );

            return { success: true, emails, count: emails.length };
          } catch (error: any) {
            return { success: false, error: `Failed to list emails: ${error.message}` };
          }
        },
      }),

      list_events: tool({
        description:
          "List upcoming calendar events. Use when the user asks about their schedule, meetings, or what's on their calendar.",
        parameters: z.object({
          days: z
            .number()
            .optional()
            .default(7)
            .describe("Number of days ahead to look (default 7)"),
        }),
        execute: async ({ days }) => {
          if (!calendarConnected) {
            return {
              success: false,
              error: "Google Calendar is not connected. Showing demo data.",
              demo: true,
              events: [
                { summary: "Corsair MCP standup", time: "9:00 – 9:30 AM", date: "Today" },
                { summary: "Hackathon demo review", time: "2:00 – 3:00 PM", date: "Today" },
                { summary: "Submission deadline", time: "11:59 PM", date: "Tomorrow" },
              ],
            };
          }
          try {
            const timeMin = new Date();
            const timeMax = new Date();
            timeMax.setDate(timeMax.getDate() + days);

            const listResult = await userCorsair.googlecalendar.api.events.getMany({
              calendarId: "primary",
              timeMin: timeMin.toISOString(),
              timeMax: timeMax.toISOString(),
              singleEvents: true,
              orderBy: "startTime",
            });

            const items = listResult.items || [];
            const events = items.map((item: any) => ({
              summary: item.summary || "Untitled",
              start: item.start?.dateTime || item.start?.date || "",
              end: item.end?.dateTime || item.end?.date || "",
              attendees: item.attendees?.map((a: any) => a.email).slice(0, 3) || [],
              location: item.location || "",
            }));

            return { success: true, events, count: events.length };
          } catch (error: any) {
            return { success: false, error: `Failed to list events: ${error.message}` };
          }
        },
      }),

      search_emails: tool({
        description:
          "Search emails by a query string. Use when the user wants to find specific emails.",
        parameters: z.object({
          query: z.string().describe("Search query (Gmail search syntax)"),
          maxResults: z.number().optional().default(5),
        }),
        execute: async ({ query, maxResults }) => {
          if (!gmailConnected || !gmailAccessToken) {
            return { success: false, error: "Gmail is not connected." };
          }
          try {
            const res = await fetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`,
              { headers: { Authorization: `Bearer ${gmailAccessToken}` } }
            );

            if (!res.ok) throw new Error(`Search failed: ${res.status}`);

            const data = await res.json();
            const messageIds = data.messages || [];

            const emails = await Promise.all(
              messageIds.map(async (msg: any) => {
                try {
                  const detailRes = await fetch(
                    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata`,
                    { headers: { Authorization: `Bearer ${gmailAccessToken}` } }
                  );
                  const details = await detailRes.json();
                  const headers = details.payload?.headers || [];
                  return {
                    id: msg.id,
                    from:
                      headers.find((h: any) => h.name?.toLowerCase() === "from")?.value ||
                      "Unknown",
                    subject:
                      headers.find((h: any) => h.name?.toLowerCase() === "subject")?.value ||
                      "No Subject",
                    snippet: details.snippet || "",
                  };
                } catch {
                  return { id: msg.id, from: "Unknown", subject: "Error", snippet: "" };
                }
              })
            );

            return { success: true, emails, count: emails.length };
          } catch (error: any) {
            return { success: false, error: `Search failed: ${error.message}` };
          }
        },
      }),
    };

    // Stream the response
    const result = streamText({
      model: openrouter("google/gemma-4-31b-it:free"),
      system: SYSTEM_PROMPT + `\n\n## Connection Status\n- Gmail: ${gmailConnected ? "✅ Connected" : "❌ Not connected"}\n- Google Calendar: ${calendarConnected ? "✅ Connected" : "❌ Not connected"}`,
      messages,
      tools: aiTools,
      maxOutputTokens: 2048,
      stopWhen: stepCountIs(5),
    });

    return result.toUIMessageStreamResponse();
  } catch (error: any) {
    console.error("AI Chat Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
