import { NextResponse } from "next/server";
import { db } from "@/server/corsair";
import { users } from "@/server/db/schema";
import { verifyPassword } from "@/lib/password";
import { signJwt } from "@/lib/jwt";
import { eq } from "drizzle-orm";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Find user
    const user = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .then((rows) => rows[0]);

    if (!user) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    // Verify password
    const isPasswordValid = verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    // Generate JWT (valid for 7 days)
    const token = signJwt({
      userId: user.id,
      email: user.email,
      name: user.name,
      exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
    });

    const response = NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name },
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
    console.error("Login error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
