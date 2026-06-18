import "dotenv/config";
import { corsair } from "../src/server/corsair";

async function main() {
  console.log("=== RUNNING POST-PATCH CALENDAR TEST ===");
  try {
    const timeMin = new Date();
    timeMin.setDate(timeMin.getDate() - 30);
    const timeMax = new Date();
    timeMax.setDate(timeMax.getDate() + 30);

    const listResult = await corsair.googlecalendar.api.events.getMany({
      calendarId: "primary",
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
    });
    console.log("✅ Success! Calendar Events List Found:", listResult?.items?.length || 0, "events");
  } catch (e: any) {
    console.error("❌ Calendar list error:", e);
  }
  process.exit(0);
}

main().catch(console.error);
