import { NextResponse } from "next/server";
import { db } from "@/server/corsair";
import { users } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { signJwt } from "@/lib/jwt";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Verify user exists in the database
    const user = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .then((rows) => rows[0]);

    if (!user) {
      return NextResponse.json(
        { error: "No account found with this email address" },
        { status: 404 }
      );
    }

    // Generate JWT reset token valid for 15 minutes
    const token = signJwt({
      email: normalizedEmail,
      purpose: "password-reset",
      exp: Math.floor(Date.now() / 1000) + 15 * 60, // 15 minutes
    });

    const resetUrl = `/reset-password?token=${token}`;

    // Log the link to the server console for debugging
    console.log(`\n=== PASSWORD RESET REQUEST ===`);
    console.log(`User: ${normalizedEmail}`);
    console.log(`Reset Token: ${token}`);
    console.log(`Reset Link: http://localhost:3000${resetUrl}`);
    console.log(`==============================\n`);

    return NextResponse.json({
      success: true,
      message: "Reset link generated successfully",
      resetUrl,
    });
  } catch (error: any) {
    console.error("Forgot password API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
