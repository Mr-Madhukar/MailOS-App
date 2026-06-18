import 'dotenv/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { createCorsair } from 'corsair';
import { googlecalendar } from '@corsair-dev/googlecalendar';
import { gmail } from '@corsair-dev/gmail';

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool);

export const corsair = createCorsair({
    plugins: [googlecalendar(), gmail()],
    database: pool,
    kek: process.env.CORSAIR_KEK!,
    multiTenancy: true,
});

export async function getFreshGmailAccessToken(userId: string): Promise<string | null> {
  const userCorsair = corsair.withTenant(userId);
  
  // Get token expiry and values
  let accessToken = await userCorsair.gmail.keys.get_access_token();
  const expiresAtStr = await userCorsair.gmail.keys.get_expires_at();
  const refreshToken = await userCorsair.gmail.keys.get_refresh_token();
  
  if (!accessToken) {
    return null;
  }
  
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = expiresAtStr ? parseInt(expiresAtStr) : 0;
  
  // If token is expired or expiring in under 2 minutes, and we have a refresh token, refresh it
  if (refreshToken && (expiresAt === 0 || expiresAt < now + 120)) {
    try {
      const clientId = await corsair.keys.gmail.get_client_id();
      const clientSecret = await corsair.keys.gmail.get_client_secret();
      
      if (clientId && clientSecret) {
        const response = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            grant_type: "refresh_token",
          }),
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.access_token) {
            accessToken = data.access_token;
            await userCorsair.gmail.keys.set_access_token(data.access_token);
            if (data.expires_in) {
              const newExpiresAt = (Math.floor(Date.now() / 1000) + data.expires_in).toString();
              await userCorsair.gmail.keys.set_expires_at(newExpiresAt);
            }
            console.log(`Successfully refreshed Gmail access token for user ${userId}`);
          }
        } else {
          console.error("Failed to refresh Gmail token, status:", response.status, await response.text());
        }
      }
    } catch (err) {
      console.error("Error refreshing Gmail access token:", err);
    }
  }
  
  return accessToken;
}