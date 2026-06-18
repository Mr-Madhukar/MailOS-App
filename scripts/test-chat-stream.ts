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
  "Content-Type": "application/json",
};

async function main() {
  console.log("=== Testing /api/ai/chat Stream ===");
  try {
    const res = await fetch("http://localhost:3000/api/ai/chat", {
      method: "POST",
      headers,
      body: JSON.stringify({
        messages: [
          {
            role: "user",
            content: "Send a calendar invite to madhukar212005@gmail.com at 9 AM next Thursday.",
          },
        ],
      }),
    });

    if (!res.ok) {
      console.error(`HTTP Error: ${res.status} - ${await res.text()}`);
      return;
    }

    console.log("Reading response stream...");
    const reader = res.body?.getReader();
    if (!reader) {
      console.error("No stream reader available");
      return;
    }

    const decoder = new TextDecoder();
    let done = false;
    let text = "";

    while (!done) {
      const { value, done: doneReading } = await reader.read();
      done = doneReading;
      if (value) {
        const chunk = decoder.decode(value, { stream: !done });
        text += chunk;
        process.stdout.write(chunk);
      }
    }
    console.log("\n=== Stream Finished ===");
  } catch (err: any) {
    console.error("Error:", err.message);
  }
}

main().catch(console.error);
