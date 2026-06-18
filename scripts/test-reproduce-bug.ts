import "dotenv/config";
import { corsair } from "../src/server/corsair";

const userId = "fe41bc13-82ce-4f8f-b31c-03e068b807d5";
const userCorsair = corsair.withTenant(userId);

async function testCalendarRobust(startDateTime: string, endDateTime: string) {
  console.log(`\n--- Testing Calendar Robust Start: "${startDateTime}" | End: "${endDateTime}" ---`);
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const parseToDate = (dt: string): Date | null => {
      if (!dt) return null;
      const parsed = new Date(dt);
      return isNaN(parsed.getTime()) ? null : parsed;
    };

    const start = parseToDate(startDateTime);
    if (!start) {
      throw new Error(`Invalid start date/time format: "${startDateTime}"`);
    }

    let end = parseToDate(endDateTime);
    if (!end || end.getTime() <= start.getTime()) {
      end = new Date(start.getTime() + 60 * 60 * 1000);
    }

    const eventBody: any = {
      summary: "Test Robust Meeting",
      description: "Testing robust parsing logic",
      start: {
        dateTime: start.toISOString(),
        timeZone: tz,
      },
      end: {
        dateTime: end.toISOString(),
        timeZone: tz,
      },
    };

    const result = await userCorsair.googlecalendar.api.events.create({
      calendarId: "primary",
      event: eventBody,
    });
    console.log("✅ Success! Event ID:", result.id);
  } catch (error: any) {
    const detail = error.body ? JSON.stringify(error.body) : error.message;
    console.error("❌ Failed:", detail);
  }
}

async function testGmailToRobust(to: string) {
  console.log(`\n--- Testing Gmail To Robust: "${to}" ---`);
  try {
    const emailMatch = to.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    const cleanTo = emailMatch ? emailMatch[0] : to;
    console.log("cleanTo:", cleanTo);

    const headers = [
      `To: ${cleanTo}`,
      `Subject: Test Subject`,
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=utf-8",
    ];
    const rawEmail = [...headers, "", "Test Body"].join("\r\n");
    const encodedMessage = Buffer.from(rawEmail)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const result = await userCorsair.gmail.api.messages.send({
      raw: encodedMessage,
    });
    console.log("✅ Success! Message ID:", result.id);
  } catch (error: any) {
    const detail = error.body ? JSON.stringify(error.body) : error.message;
    console.error("❌ Failed:", detail);
  }
}

async function main() {
  // Should succeed now even though endDateTime is before startDateTime or date-only
  await testCalendarRobust("2026-06-25T09:00:00Z", "2026-06-25");
  
  // Should succeed now even though recipient is malformed
  await testGmailToRobust("friend@corsair.dev at 9 AM next Thursday");
  
  process.exit(0);
}

main().catch(console.error);
