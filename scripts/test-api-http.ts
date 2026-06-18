import "dotenv/config";
import { signJwt } from "../src/lib/jwt";

// Generate a valid JWT token for the user who connected Google credentials
const token = signJwt({
  userId: "fe41bc13-82ce-4f8f-b31c-03e068b807d5",
  email: "madhukar200202@gmail.com",
  name: "Madhukar",
  exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
});

const headers = {
  Cookie: `mailos_token=${token}`,
};

async function testPort(port: number) {
  console.log(`\n=== Testing localhost:${port} with Token ===`);
  
  // Test Settings
  try {
    const res = await fetch(`http://localhost:${port}/api/settings`, { headers });
    if (res.ok) {
      const data = await res.json();
      console.log(`[${port}] GET /api/settings:`, JSON.stringify(data, null, 2));
    } else {
      console.log(`[${port}] GET /api/settings failed: ${res.status} - ${await res.text()}`);
    }
  } catch (err: any) {
    console.log(`[${port}] GET /api/settings error:`, err.message);
  }

  // Test Emails
  try {
    const start = Date.now();
    const res = await fetch(`http://localhost:${port}/api/emails`, { headers });
    const elapsed = Date.now() - start;
    if (res.ok) {
      const data = await res.json();
      console.log(`[${port}] GET /api/emails: demo = ${data.demo}, emails count = ${data.emails?.length || 0}, time = ${elapsed}ms`);
      if (data.error) console.log(`[${port}] GET /api/emails error field:`, data.error);
      if (data.emails && data.emails.length > 0) {
        console.log(`[${port}] First email from: "${data.emails[0].from}", subject: "${data.emails[0].subject}", snippet: "${data.emails[0].snippet?.substring(0, 50)}..."`);
      }
    } else {
      console.log(`[${port}] GET /api/emails failed: ${res.status} - ${await res.text()}`);
    }
  } catch (err: any) {
    console.log(`[${port}] GET /api/emails error:`, err.message);
  }

  // Test Calendar
  try {
    const res = await fetch(`http://localhost:${port}/api/calendar`, { headers });
    if (res.ok) {
      const data = await res.json();
      console.log(`[${port}] GET /api/calendar: demo = ${data.demo}, events count = ${data.events?.length || 0}`);
      if (data.error) console.log(`[${port}] GET /api/calendar error field:`, data.error);
      if (data.events && data.events.length > 0) {
        console.log(`[${port}] First calendar event: "${data.events[0].summary}" (date: ${data.events[0].date})`);
      }
    } else {
      console.log(`[${port}] GET /api/calendar failed: ${res.status} - ${await res.text()}`);
    }
  } catch (err: any) {
    console.log(`[${port}] GET /api/calendar error:`, err.message);
  }
}

async function main() {
  await testPort(3001);
  process.exit(0);
}

main().catch(console.error);
