import { NextResponse } from "next/server";
import { db } from "@/server/corsair";
import { users } from "@/server/db/schema";
import { hashPassword } from "@/lib/password";
import { signJwt } from "@/lib/jwt";
import { eq } from "drizzle-orm";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const { email, password, name } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .then((rows) => rows[0]);

    if (existingUser) {
      return NextResponse.json({ error: "User already exists with this email" }, { status: 400 });
    }

    const passwordHash = hashPassword(password);
    const userId = crypto.randomUUID();

    // Create user
    await db.insert(users).values({
      id: userId,
      email: normalizedEmail,
      passwordHash,
      name: name || null,
    });

    // Generate JWT (valid for 7 days)
    const token = signJwt({
      userId,
      email: normalizedEmail,
      name: name || null,
      exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
    });

    const response = NextResponse.json({
      success: true,
      user: { id: userId, email: normalizedEmail, name },
    });

    // Set cookie
    response.cookies.set("mailos_token", token, {
      httpOnly: true,
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    return response;
  } catch (error: any) {
    console.error("Signup error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
