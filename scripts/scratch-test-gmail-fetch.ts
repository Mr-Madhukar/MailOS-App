import "dotenv/config";
import { corsair } from "../src/server/corsair";

async function main() {
  const userId = "fe41bc13-82ce-4f8f-b31c-03e068b807d5";
  const userCorsair = corsair.withTenant(userId);

  try {
    const startToken = Date.now();
    const accessToken = await userCorsair.gmail.keys.get_access_token();
    console.log(`Retrieved access token in ${Date.now() - startToken}ms. Token length: ${accessToken?.length}`);

    if (!accessToken) {
      console.log("No access token found.");
      process.exit(1);
    }

    const startList = Date.now();
    const listRes = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=100",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    console.log(`Listed messages in ${Date.now() - startList}ms. Status: ${listRes.status}`);
    if (!listRes.ok) {
      console.log("Error response:", await listRes.text());
      process.exit(1);
    }
    const listData = await listRes.json();
    const messages = listData.messages || [];
    console.log(`Found ${messages.length} messages.`);

    if (messages.length > 0) {
      const firstMsg = messages[0];
      const startDetail = Date.now();
      const detailRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${firstMsg.id}?format=metadata`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
      console.log(`Fetched details for first message in ${Date.now() - startDetail}ms. Status: ${detailRes.status}`);
      if (detailRes.ok) {
        const detailData = await detailRes.json();
        console.log("Details keys:", Object.keys(detailData));
        console.log("Snippet:", detailData.snippet);
        const headers = detailData.payload?.headers || [];
        const fromHeader = headers.find((h: any) => h.name?.toLowerCase() === "from")?.value;
        const subjectHeader = headers.find((h: any) => h.name?.toLowerCase() === "subject")?.value;
        console.log("From:", fromHeader);
        console.log("Subject:", subjectHeader);
      }
    }
  } catch (e: any) {
    console.error("Error:", e);
  }
  process.exit(0);
}

main().catch(console.error);
