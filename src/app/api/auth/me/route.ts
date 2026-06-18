export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJwt } from "@/lib/jwt";
import { db } from "@/server/corsair";
import { users } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const token = cookies().get("mailos_token")?.value;

    if (!token) {
      return NextResponse.json({ user: null }, { status: 200 });
    }

    const payload = verifyJwt(token);

    if (!payload || !payload.userId) {
      return NextResponse.json({ user: null }, { status: 200 });
    }

    // Optional: Fetch fresh user details from DB
    const user = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
      })
      .from(users)
      .where(eq(users.id, payload.userId))
      .then((rows) => rows[0]);

    if (!user) {
      return NextResponse.json({ user: null }, { status: 200 });
    }

    return NextResponse.json({ user });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
