import bcrypt from "bcryptjs";

const DEMO_PASSWORD = "DemoPass123!";
let cachedDemoHash: string | null = null;

export async function hashPassword(password: string): Promise<string> {
  if (password === DEMO_PASSWORD && cachedDemoHash) {
    return cachedDemoHash;
  }
  const rounds = process.env.NODE_ENV === "test" || process.env.CI ? 4 : 10;
  const hash = await bcrypt.hash(password, rounds);
  if (password === DEMO_PASSWORD) {
    cachedDemoHash = hash;
  }
  return hash;
}

export async function verifyPassword(password: string, hash: string | null): Promise<boolean> {
  if (!hash) return false;
  if (password === DEMO_PASSWORD && cachedDemoHash && hash === cachedDemoHash) {
    return true;
  }
  const result = await bcrypt.compare(password, hash);
  if (result && password === DEMO_PASSWORD) {
    cachedDemoHash = hash;
  }
  return result;
}
