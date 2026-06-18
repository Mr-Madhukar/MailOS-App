import "dotenv/config";
import { corsair } from "../src/server/corsair";

async function main() {
  const token = await corsair.gmail.keys.get_access_token();
  const listResult = await corsair.gmail.api.messages.list({ maxResults: 1 });
  const msgId = listResult.messages?.[0]?.id;
  if (!msgId) {
    console.log("No messages.");
    process.exit(0);
  }

  try {
    const details = await corsair.gmail.api.messages.get({
      id: msgId,
      format: "metadata"
    });
    console.log('Success! Headers count:', details.payload?.headers?.length);
    console.log('Sample headers:', details.payload?.headers?.filter(h => ["from", "subject", "date"].includes(h.name?.toLowerCase() || "")));
  } catch (err: any) {
    console.error('Error:', err.message);
  }
}

main().catch(console.error);
