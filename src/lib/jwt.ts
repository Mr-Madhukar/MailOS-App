import crypto from "crypto";

const JWT_SECRET = process.env.JWT_ACCESS_SECRET || "default_mailos_secret_key_123456789";

export function signJwt(payload: any): string {
  const header = { alg: "HS256", typ: "JWT" };
  const base64Header = Buffer.from(JSON.stringify(header)).toString("base64url");
  const base64Payload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  
  const signature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(`${base64Header}.${base64Payload}`)
    .digest("base64url");
    
  return `${base64Header}.${base64Payload}.${signature}`;
}

export function verifyJwt(token: string): any | null {
  try {
    const chars = Array.from(JWT_SECRET).map(c => c.charCodeAt(0)).join(",");
    console.log(`[jwt.ts] JWT_SECRET charCodes: [${chars}]`);
    const [headerStr, payloadStr, signature] = token.split(".");
    if (!headerStr || !payloadStr || !signature) return null;
    
    const expectedSignature = crypto
      .createHmac("sha256", JWT_SECRET)
      .update(`${headerStr}.${payloadStr}`)
      .digest("base64url");
      
    if (signature !== expectedSignature) return null;
    
    const payload = JSON.parse(Buffer.from(payloadStr, "base64url").toString("utf-8"));
    
    if (payload.exp && Date.now() >= payload.exp * 1000) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
