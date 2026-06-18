import "dotenv/config";
import { corsair } from "../src/server/corsair";

async function main() {
  try {
    const listResult = await corsair.gmail.api.messages.list({ maxResults: 1 });
    const msg = listResult.messages?.[0];
    if (!msg) {
      console.log("No messages found.");
      process.exit(0);
    }
    
    console.log("Fetching details with format: 'metadata'...");
    const details = await corsair.gmail.api.messages.get({
      id: msg.id!,
      format: "metadata",
      metadataHeaders: ["From", "Subject", "Date"],
    });

    console.log("Details keys:", Object.keys(details));
    console.log("Details labelIds:", details.labelIds);
    console.log("Details payload:", details.payload);
    if (details.payload) {
      console.log("Details payload keys:", Object.keys(details.payload));
      console.log("Details payload headers:", details.payload.headers);
    }
  } catch (e: any) {
    console.error("Error:", e);
  }
  process.exit(0);
}

main().catch(console.error);
