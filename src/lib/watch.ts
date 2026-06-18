import crypto from "crypto";

/**
 * Registers Google Calendar events watch (webhook).
 */
export async function registerCalendarWatch(userId: string, accessToken: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  if (appUrl.includes("localhost")) {
    console.warn("[Watch] Cannot register Calendar watch with a localhost address:", appUrl);
    return;
  }

  try {
    const channelId = crypto.randomUUID();
    const webhookUrl = `${appUrl}/api/webhook?tenantId=${encodeURIComponent(userId)}`;
    
    console.log(`[Watch] Registering Calendar watch for user ${userId} at ${webhookUrl}`);
    
    const watchRes = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events/watch",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: channelId,
          type: "web_hook",
          address: webhookUrl,
        }),
      }
    );

    if (watchRes.ok) {
      const data = await watchRes.json();
      console.log(`[Watch] Calendar watch registered successfully:`, data);
    } else {
      console.error(`[Watch] Calendar watch registration failed:`, await watchRes.text());
    }
  } catch (error) {
    console.error(`[Watch] Error registering Calendar watch:`, error);
  }
}

/**
 * Registers Gmail watch (push notifications) via Google Pub/Sub topic.
 */
export async function registerGmailWatch(accessToken: string) {
  const topicName = process.env.GMAIL_PUBSUB_TOPIC;
  if (!topicName) {
    console.log("[Watch] GMAIL_PUBSUB_TOPIC not configured. Skipping Gmail watch registration.");
    return;
  }

  try {
    console.log(`[Watch] Registering Gmail watch with topic ${topicName}`);
    
    const watchRes = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/watch",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topicName: topicName,
          labelIds: ["INBOX"],
        }),
      }
    );

    if (watchRes.ok) {
      const data = await watchRes.json();
      console.log(`[Watch] Gmail watch registered successfully:`, data);
    } else {
      console.error(`[Watch] Gmail watch registration failed:`, await watchRes.text());
    }
  } catch (error) {
    console.error(`[Watch] Error registering Gmail watch:`, error);
  }
}
